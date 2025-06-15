import { log } from "console";
import { JobPost } from "db/schema/generic/job-schema";
import { DEV_MODE } from "envVars";
import { ScrapingSource } from "model";
import { Page } from "playwright-core";
import { getCookies } from "src/login";
import {
  extractText,
  findFunctioningSelector,
  tryToFindElementFromSelectors,
  tryToFindElementsFromSelectors,
} from "src/searchForElements";
import { sleepApprox } from "src/utils";
import { markJobAsInSearch, saveJobInDb } from "../generic/job-db";

const ONE_HOUR = 60 * 60 * 1000;
const THREE_MINUTES = 3 * 60 * 1000;

export const scrapeJobsLinkedin = async (
  page: Page,
  {
    jobDescription,
    location,
    searchId,
    shouldLogin = false,
    postsMaxAgeSeconds
  }: {
    jobDescription: string;
    location: string;
    searchId: number;
    shouldLogin?: boolean;
    postsMaxAgeSeconds?: number;
  }
) => {
  page.setDefaultTimeout(THREE_MINUTES);

  // Always try to load saved cookies first
  log('Loading saved cookies and navigating to LinkedIn jobs...');
  try {
    const cookies = await getCookies({ platform: ScrapingSource.LinkedIn });
    await page.context().addCookies(cookies);
    log('Cookies loaded, navigating to jobs page');
  } catch (error) {
    log('No saved cookies found or error loading cookies:', error);
    if (shouldLogin) {
      log('Will proceed with manual login if needed');
    }
  }  // Navigate directly to LinkedIn jobs page
  await page.goto('https://www.linkedin.com/jobs/search/');
  console.log('🔍 Navigation completed, waiting for page load...');
  await page.waitForTimeout(1000);
  // Wait for the page to be fully loaded
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
    console.log('🔍 Page fully loaded');
  } catch (error) {
    console.log('⚠️ Page load timeout (3s), continuing anyway...');
  } console.log('🔍 Checking for dismiss button...');
  if (!shouldLogin) {
    // Dismiss prompt to log in if not using cookies
    try {
      await page.waitForSelector("button[aria-label='Dismiss']", { timeout: 5000 });
      const dismissButton = await page.$("button[aria-label='Dismiss']");
      if (dismissButton) {
        console.log('🔍 Found dismiss button, clicking...');
        await dismissButton.click();
      }
    } catch (error) {
      console.log('🔍 No dismiss button found or timed out');
    }
  }  console.log('🔍 Checking login status...');
  console.log('🔍 Current page URL:', page.url());
  console.log('🔍 Page title:', await page.title());
  
  // Take a screenshot for debugging if in dev mode
  if (DEV_MODE) {
    try {
      await page.screenshot({ path: 'linkedin-debug.png', fullPage: false });
      console.log('🔍 Debug screenshot saved as linkedin-debug.png');
    } catch (error) {
      console.log('🔍 Could not take screenshot:', error);
    }
  }
  
  // Check if we are logged in by searching for "Sign in" or "Continue with Google"
  let signInButton;
  try {
    await page.waitForSelector("button[aria-label='Sign in'], button[aria-label='Continue with Google'], a:has-text('Sign in')", { timeout: 5000 });
    signInButton = await page.$("button[aria-label='Sign in'], button[aria-label='Continue with Google'], a:has-text('Sign in')");
    console.log('🔍 Found sign-in button/link, not logged in');
  } catch (error) {
    console.log('🔍 No sign in button found, checking for other login indicators...');
    
    // Check for other login indicators
    const loginForm = await page.$('form[data-id="sign-in-form"]');
    const emailField = await page.$('input[type="email"], input[name="session_key"]');
    
    if (loginForm || emailField) {
      console.log('🔍 Found login form, not logged in');
      signInButton = true; // Treat as if sign-in button was found
    } else {
      console.log('🔍 No login indicators found, assuming logged in');
      signInButton = null;
    }
  }

  if (signInButton) {
    log("Not logged in. Please log in to LinkedIn.");
    return;
  }
  log("Login successful");

  console.log('🔍 About to call search function...'); await search(page, jobDescription, location, postsMaxAgeSeconds);
  log("Search done");

  await page.waitForTimeout(3000); // wait for the page to load

  let jobCardsSelector = await findFunctioningSelector(
    page,
    linkedinJobSelectors.jobCard
  );

  if (!jobCardsSelector) {
    throw new Error("No job cards found");
  }

  let totalCardsFound = 0;
  let totalNewJobsFound = 0;
  let currentPage = 1;

  let morePagesExist = true;
  while (morePagesExist) {
    const { cardsFound, newJobsFound } = await scrapeAllJobsOnPage(
      page,
      jobCardsSelector,
      searchId,
      totalNewJobsFound
    );
    totalCardsFound += cardsFound;
    totalNewJobsFound += newJobsFound;
    log(
      `Found ${cardsFound} cards on this page. In total ${totalCardsFound} found so far out of which ${totalNewJobsFound} are new.`
    );

    const nextPage = await findNextPageAndNavigateToItIfItExists(
      page,
      currentPage
    );
    if (nextPage) {
      log("Going to page", nextPage);
      currentPage = nextPage;
    } else {
      log("No more pages found.");
      morePagesExist = false;
    }
  }

  log("Done. Found ", totalCardsFound, " cards and ", totalNewJobsFound, " new jobs.");
};

const waitForAtLeastOneSelector = async (page: Page, selectors: string[]) => {
  const elements = await tryToFindElementFromSelectors(page, selectors);
  if (!elements) {
    throw new Error("No elements found");
  }

  await elements.waitFor({ state: "visible" });
};

const endOfPageError = new Error('We likely got to the end of the page.');

const scrapeAllJobsOnPage = async (
  page: Page,
  cardSelector: string,
  searchId: number,
  newJobsFoundBefore: number
): Promise<{
  cardsFound: number;
  newJobsFound: number;
}> => {
  let continueScrapingJobs = true;
  let cardsFoundOnCurrentPage = 0;
  let newJobsFound = 0;
  while (continueScrapingJobs) {
    try {
      if (cardsFoundOnCurrentPage > 0) {
        // we have to scroll to the next card sometimes
        const previousCard = page
          .locator(cardSelector)
          .nth(cardsFoundOnCurrentPage - 1);
        previousCard.hover();
        await page.mouse.wheel(0, 250);
      }
      const nextCard = page.locator(cardSelector).nth(cardsFoundOnCurrentPage);

      cardsFoundOnCurrentPage++;

      try {
        await nextCard.click({ timeout: 15000 });
      } catch {
        if (cardsFoundOnCurrentPage > 1) {
          throw endOfPageError;
        } else {
          throw new Error('I only managed to find ' + cardsFoundOnCurrentPage + ' cards and then something went wrong.');
        }
      }

      await sleepApprox(page, 1500, false, 'for the job details to load');

      const job = await extractJob(page);
      const { upsertResult, insertedNewLine } = await saveJobInDb(job, 'linkedin');
      if (insertedNewLine) {
        newJobsFound++;
      }
      log(`${insertedNewLine ? '✨ Saved new' : "🔄 Updated"} job with id ${upsertResult.id}. (This page new: ${newJobsFound}, This page updated: ${cardsFoundOnCurrentPage - newJobsFound}), total new: ${newJobsFound + newJobsFoundBefore}`);
      await markJobAsInSearch(upsertResult.id, searchId);
    } catch (error: any) {
      if (error === endOfPageError) {
        log(endOfPageError.message);
      } else {
        console.error("Something went wrong with getting a job:", error);
        if (cardsFoundOnCurrentPage === 0)
          throw new Error("Something went wrong. No jobs found.");
      }
      continueScrapingJobs = false;
    }
  }

  return { cardsFound: cardsFoundOnCurrentPage, newJobsFound };
};

// returns page successfully navigated to
const findNextPageAndNavigateToItIfItExists = async (
  page: Page,
  currentPageNumber: number
): Promise<undefined | number> => {
  const nextPageNumber = currentPageNumber + 1;
  // Check if there is a next page
  const nextPageButton = await page.$(
    `button[aria-label="Page ${nextPageNumber}"]`
  );

  if (nextPageButton) {
    await nextPageButton.click();
    //sometimes failed at 300ms
    await page.waitForTimeout(5000); // wait for the next page to load
    return nextPageNumber;
  }
  console.log("No more pages found");
  return undefined;
};

const extractJob = async (page: Page): Promise<Omit<JobPost, 'id' | 'dateScraped' | 'sourceId'>> => {
  //wait until h1 is visible
  await waitForAtLeastOneSelector(
    page,
    linkedinJobSelectors.jobDetails.jobTitle
  );

  const { jobTitle, company, location, jobDetails, skills } =
    await tryToFindElementsFromSelectors(
      page,
      {
        jobTitle: linkedinJobSelectors.jobDetails.jobTitle,
        company: linkedinJobSelectors.jobDetails.company,
        location: linkedinJobSelectors.jobDetails.jobLocation,
        jobDetails: linkedinJobSelectors.jobDetails.jobDetails,
        skills: linkedinJobSelectors.jobDetails.skills,
      },
      {
        allOrNothing: false,
      }
    );

  const url = page.url();
  const urlParams = new URLSearchParams(new URL(url).search);
  const jobId = urlParams.get("currentJobId") || "";

  return {
    title: await extractText(jobTitle),
    company: await extractText(company),
    location: await extractText(location),
    jobDetails: await extractText(jobDetails),
    skills: await extractText(skills, false),
    externalId: jobId,
    originalUrl: url
  };
};

//The thought here was that the seletors change all the time,
// so we wanna store all of them and try to find at least one that works
export const linkedinJobSelectors = {
  searchInput: [
    '[aria-label="Search by title, skill, or company"]',
    'input[aria-label="Search job titles or companies"]',
    'input[aria-label*="Search by title"]',
    'input[aria-label*="Search job titles"]',
    'input[placeholder*="Search job titles"]',
    'input[aria-label*="job title"]',
    'input[id*="jobs-search-box-keyword"]',
    '.jobs-search-box__text-input[aria-label*="Search"]',
    'input[data-test-id*="jobs-search-keywords"]'
  ],
  locationInput: [
    "input[aria-label='City, state, or zip code']",
    'input[aria-label*="City, state"]',
    'input[aria-label*="Location"]',
    'input[placeholder*="City, state"]',
    'input[id*="jobs-search-box-location"]',
    '.jobs-search-box__text-input[aria-label*="Location"]',
    'input[data-test-id*="jobs-search-location"]'
  ],
  buttonSearch: [
    "button.jobs-search-box__submit-button",
    'button[aria-label*="Search"]',
    'button[data-test-id*="jobs-search-submit"]',
    '.jobs-search-box__submit-button',
    'button:has-text("Search")',
    'button[type="submit"]',
    '.search-button',
    '[role="button"]:has-text("Search")'
  ],
  jobDetails: {
    jobTitle: ["h1"],
    company: ["div.job-details-jobs-unified-top-card__company-name"],
    jobLocation: [
      ".job-details-jobs-unified-top-card__primary-description-container",
    ],
    jobDetails: ["#job-details"],
    skills: ["#how-you-match-card-container", ".job-details-how-you-match__skills-section-descriptive-skill"],
  }, jobCard: [
    'a.job-card-container__link[href*="/jobs/view/"]',
    'a[data-control-id][href*="/jobs/view/"]',
    'a[aria-label][href*="/jobs/view/"]',
    '.job-card-container a[href*="/jobs/view/"]',
    '[data-entity-urn*="job"] a[href*="/jobs/view/"]',
    '.jobs-search-results-list a[href*="/jobs/view/"]'
  ],
};

const postAgeMap = {
  '24 hours': 86400,
  'week': 604800,
  'month': 2592000,
}

async function search(
  page: Page,
  jobDescription: string,
  location: string,
  postsMaxAgeSeconds: number = postAgeMap['24 hours']
) {  console.log('🔍 Starting search function...');
  console.log('🔍 Looking for search elements...');
  
  // Add a timeout wrapper for finding elements
  let elements;
  try {
    const timeoutPromise: Promise<never> = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout finding search elements')), 15000)
    );

    const findElementsPromise = tryToFindElementsFromSelectors(
      page,
      {
        searchInput: linkedinJobSelectors.searchInput,
        searchButton: linkedinJobSelectors.buttonSearch,
        locationInput: linkedinJobSelectors.locationInput,
      },
      {
        allOrNothing: true,
      }
    );

    elements = await Promise.race([findElementsPromise, timeoutPromise]);
  } catch (error) {
    console.error('🚫 Error finding search elements:', (error as Error).message);
    console.log('📄 Current page URL:', page.url());
    console.log('📄 Page title:', await page.title());
    throw error;
  }

  console.log('🔍 Elements found:', !!elements);

  if (!elements) throw new Error("Search elements not found");

  const { searchInput, searchButton, locationInput } = elements;

  console.log('Filling job description...')
  await searchInput.fill(jobDescription, {
    timeout: 10000,
  });
  console.log('Job description filled in');

  console.log('Filling location...')
  await locationInput.fill(location, {
    timeout: 10000,
  });
  console.log('Location filled in');

  console.log('Clicking search button...')
  await searchButton.click();

  // Check if the first word of the search is in the url
  const firstWord = jobDescription.split(" ")[0];
  const urlRegex = new RegExp(`.*${firstWord}.*`);

  try {
    await page.waitForURL(urlRegex, {
      timeout: 10000
    });
    console.log('✅ Search results loaded successfully');
  } catch (error) {
    console.log('⚠️ URL didn\'t change as expected, but continuing...');
  }

  if (postsMaxAgeSeconds) {
    try {
      const maxAgeTimeout = 30000;
      const defaultMaxAgeOptions = { timeout: maxAgeTimeout };

      // Build the query parameters directly
      // Note: using 'f_TPR=r604800' for an example of "Past week" filtering 
      const newUrl = `${page.url()}&f_TPR=r${postsMaxAgeSeconds}`;
      await page.goto(newUrl, defaultMaxAgeOptions);
    } catch (error) {
      console.error('something went wrong with selecting the max age', error)
    }
  }
}
