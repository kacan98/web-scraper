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
  }: {
    jobDescription: string;
    location: string;
    searchId: number;
    shouldLogin?: boolean;
  }
) => {
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

  await page.goto(`https://www.linkedin.com/jobs/search/`);

  await search(page, jobDescription, location);

  await page.waitForTimeout(3000);

  // Check if the selectors are still valid
  //testLinkedinJobSelectors(page);

  let jobCardsSelector = await findFunctioningSelector(
    page,
    linkedinJobSelectors.jobCard
  );

  if (!jobCardsSelector) {
    throw new Error("No job cards found");
  }

  let totalCardsFound = 0;
  let currentPage = 1;

  let morePagesExist = true;
  while (morePagesExist) {
    const { cardsFound } = await scrapeAllJobsOnPage(
      page,
      jobCardsSelector,
      searchId
    );
    totalCardsFound += cardsFound;
    log(
      `Found ${cardsFound} cards on this page. In total ${totalCardsFound} found so far.`
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

  log("Done. Found ", totalCardsFound, " jobs.");
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
  searchId: number
): Promise<{
  cardsFound: number;
}> => {
  let continueScrapingJobs = true;
  let cardsFoundOnCurrentPage = 0;
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
        await nextCard.click({ timeout: 5000 });
      } catch {
        throw endOfPageError;
      }
      log(`Found card nr ${cardsFoundOnCurrentPage}`);
      await sleepApprox(page, 1750); // wait for the job details to load

      const job = await extractJob(page);
      const { id: jobId } = await saveLinkedinJobInDb(job);
      await markJobAsInSearch(jobId, searchId);
      log("saved job with id", jobId);
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

  return { cardsFound: cardsFoundOnCurrentPage };
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
    await page.waitForTimeout(3000); // wait for the next page to load
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
    skills: [".job-details-how-you-match__skills-section-descriptive-skill"],
  },
  jobCard: [
    'a.job-card-container__link[href*="/jobs/view/"]',
    'a[data-control-id][href*="/jobs/view/"]',
    'a[aria-label][href*="/jobs/view/"]',
  ],
};

async function search(
  page: Page,
  _jobDescription: string,
  _location: string,
  loggedIn = true
) {
  if (loggedIn) {
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
    await locationInput.fill(_location);
    await searchButton.click();
  } else {
    const jobDescription = encodeURIComponent(_jobDescription);
    const location = encodeURIComponent(_location);
    //go to https://www.linkedin.com/jobs/search?keywords=Angular&location=Stockholm&geoId=&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0
    await page.goto(
      `https://www.linkedin.com/jobs/search?keywords=${jobDescription}&location=${location}&geoId=&trk=public_jobs_jobs-search-bar_search-submit&position=1&pageNum=0`
    );
  }
}
