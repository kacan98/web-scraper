import { Page } from "@playwright/test";
import { log } from "console";
import { LinkedinJobPostTable } from "db/schema/linkedin/linkedin-schema";
import { ScrapingSource } from "model";
import { login } from "src/instagram/instagram-utils";
import {
  extractText,
  findFunctioningSelector,
  tryToFindElementFromSelectors,
  tryToFindElementsFromSelectors,
} from "src/searchForElements";
import { markJobAsInSearch, saveLinkedinJobInDb } from "./jobs.db";
import { sleepApprox } from "src/utils";

const ONE_HOUR = 60 * 60 * 1000;

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
  log('Starting scraping jobs on LinkedIn');
  page.setDefaultTimeout(ONE_HOUR);
  if (shouldLogin) {
    await login({ page, platform: ScrapingSource.LinkedIn });
  } else {
    //dismiss prompt to log in
    //aria-label="Dismiss"
    const dismissButton = await page.$("button[aria-label='Dismiss']");
    if (dismissButton) {
      await dismissButton.click();
    }
  }

  log("Login successful");

  await page.goto(`https://www.linkedin.com/jobs/search/`);

  await search(page, jobDescription, location, postsMaxAgeSeconds);

  await page.waitForTimeout(3000);

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
      const { upsertResult, insertedNewLine } = await saveLinkedinJobInDb(job);
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

const extractJob = async (page: Page): Promise<Omit<LinkedinJobPostTable, 'id'>> => {
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
    linkedinId: jobId
  };
};

//The thought here was that the seletors change all the time,
// so we wanna store all of them and try to find at least one that works
export const linkedinJobSelectors = {
  searchInput: [
    '[aria-label="Search by title, skill, or company"]',
    'input[aria-label="Search job titles or companies"]',
  ],
  locationInput: ["input[aria-label='City, state, or zip code']"],
  buttonSearch: ["button.jobs-search-box__submit-button"],
  jobDetails: {
    jobTitle: ["h1"],
    company: ["div.job-details-jobs-unified-top-card__company-name"],
    jobLocation: [
      ".job-details-jobs-unified-top-card__primary-description-container",
    ],
    jobDetails: ["#job-details"],
    skills: ["#how-you-match-card-container", ".job-details-how-you-match__skills-section-descriptive-skill"],
  },
  jobCard: [
    'a.job-card-container__link[href*="/jobs/view/"]',
    'a[data-control-id][href*="/jobs/view/"]',
    'a[aria-label][href*="/jobs/view/"]',
  ],
};

const postAgeMap = {
  '24 hours': 86400,
  'week': 604800,
  'month': 2592000,
}

async function search(
  page: Page,
  _jobDescription: string,
  _location: string,
  postsMaxAgeSeconds: number = postAgeMap['week']
) {
  const elements = await tryToFindElementsFromSelectors(
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

  if (!elements) throw new Error("Search elements not found");

  const { searchInput, searchButton, locationInput } = elements;

  await searchInput.fill(_jobDescription);
  //fill in location a character at a time
  for (let i = 0; i < _location.length; i++) {
    await locationInput.fill(_location.slice(0, i + 1));
    await sleepApprox(page, 50);
  }
  //make sure that the location is found by linkedin
  await searchButton.click();

  //check if the first word of the search is in the url
  const firstWord = _jobDescription.split(" ")[0];
  const urlRegex = new RegExp(`.*${firstWord}.*`);
  await page.waitForURL(urlRegex, {
    timeout: 10000
  });


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
