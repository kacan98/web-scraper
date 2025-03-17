import { Locator, Page } from "@playwright/test";
import { log } from "console";
import { login } from "src/instagram/instagram-utils";
import {
  extractText,
  tryToFindElementFromSelectors,
  tryToFindElementsFromSelectors,
} from "src/searchForElements";
import { waitForever } from "src/utils";
import { markJobAsInSearch, saveLinkedinJobInDb } from "./jobs.db";
import { LinkedinJobPost } from "db/schema/linkedin/linkedin-schema";
import { ScrapingSource } from "model";

const ONE_HOUR = 60 * 60 * 1000;

export const getJobsLinkedin = async (
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

  // Make sure that all jobs are loaded
  const paginationListSelector = ".artdeco-pagination__pages";
  await page.locator(paginationListSelector).scrollIntoViewIfNeeded();

  // Check if the selectors are still valid
  //testLinkedinJobSelectors(page);

  let jobItems = page.locator('a[href*="/jobs/view/"]');
  const jobs: LinkedinJobPost[] = [];
  let currentPage = 1;

  let jobsToProcess = await jobItems.all();
  while (jobsToProcess.length > 0) {
    for (let i = 0; i < jobsToProcess.length; i++) {
      const jobItem = jobsToProcess[i];

      if (jobItem) {
        await jobItem.click();
        await page.waitForTimeout(1750); // wait for the job details to load

        const job = await extractJob(page);
        const {id: jobId} = await saveLinkedinJobInDb(job);
        await markJobAsInSearch(jobId, searchId);

        // Refresh the list of job items every 5 iterations
        if ((i + 1) % 5 === 0) {
          jobsToProcess = await jobItems.all();
        }

        // Save the jobs to a file
        console.log("This is the job that I found: ", job);
      }
    }

    // Check if there is a next page
    const nextPageButton = await page.$(
      `button[aria-label="Page ${currentPage + 1}"]`
    );

    if (nextPageButton) {
      await nextPageButton.click();
      await page.waitForTimeout(3000); // wait for the next page to load
      jobsToProcess = await jobItems.all();
      currentPage++;
    } else {
      console.log("No more pages found");
      break; // No more pages
    }
  }

  log("Done. Found jobs: ", jobs.length);
};

const waitForAtLeastOneSelector = async (page: Page, selectors: string[]) => {
  const elements = await tryToFindElementFromSelectors(page, selectors);
  if (!elements) {
    throw new Error("No elements found");
  }

  await elements.waitFor({ state: "visible" });
};

const extractJob = async (page: Page): Promise<LinkedinJobPost> => {
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
    linkedinId: jobId,
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
