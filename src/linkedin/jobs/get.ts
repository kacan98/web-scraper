import { Page } from "@playwright/test";
import { log } from "console";
import { login } from "src/instagram/instagram-utils";
import { waitForever } from "src/utils";

export interface LinkedinJob {
  title: string;
  company: string;
  location: string;
  jobDetails: string;
  skills: string;
  id: string;
}

const ONE_HOUR = 60 * 60 * 1000;

export const getJobsLinkedin = async (
  page: Page,
  {
    jobDescription,
    location,
    shouldLogin = false,
  }: {
    jobDescription: string;
    location: string;
    shouldLogin?: boolean;
  }
) => {
  page.setDefaultTimeout(ONE_HOUR);
  if (shouldLogin) {
    await login({ page, platform: "linkedin" }); // Not needed to search for jobs
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
  // const paginationListSelector = ".artdeco-pagination__pages";
  // await page.locator(paginationListSelector).scrollIntoViewIfNeeded();

  // Check if the selectors are still valid
  //testLinkedinJobSelectors(page);

  let jobItems = await page.$$("li[data-occludable-job-id]");
  const jobs: LinkedinJob[] = [];
  let currentPage = 1;

  while (jobItems.length > 0) {
    for (let i = 0; i < jobItems.length; i++) {
      const jobItem = jobItems[i];
      const jobLink = await jobItem.$('a[href*="/jobs/view/"]');

      waitForever();

      if (jobLink) {
        await jobLink.click();
        await page.waitForTimeout(1750); // wait for the job details to load

        const job = await extractJob(page);
        jobs.push(job);

        // Refresh the list of job items every 5 iterations
        if ((i + 1) % 5 === 0) {
          jobItems = await page.$$("li[data-occludable-job-id]");
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
      jobItems = await page.$$("li[data-occludable-job-id]");
      currentPage++;
    } else {
      console.log("No more pages found");
      break; // No more pages
    }
  }

  log("Done. Found jobs: ", jobs.length);
};

const extractJob = async (page: Page): Promise<LinkedinJob> => {
  //wait until h1 is visible
  await page.waitForSelector(linkedinJobSelectors.jobTitle);

  return page.evaluate(
    ({ selectors }) => {
      function extractText(selector: string): string {
        const extracted = document.querySelector(selector);
        return extracted?.textContent?.trim() || "";
      }

      const url = window.location.href;
      const urlParams = new URLSearchParams(new URL(url).search);
      const jobId = urlParams.get("currentJobId") || "";

      const job: LinkedinJob = {
        title: extractText(selectors.jobTitle),
        company: extractText(selectors.company),
        location: extractText(selectors.location),
        jobDetails: extractText(selectors.jobDetails),
        skills: extractText(selectors.skills),
        id: jobId,
      };

      console.log(job);

      return job;
    },
    { selectors: linkedinJobSelectors }
  );
};

export const linkedinJobSelectors: { [key: string]: string } = {
  jobTitle: "h1",
  company: "div.job-details-jobs-unified-top-card__company-name",
  location: ".job-details-jobs-unified-top-card__primary-description-container",
  jobDetails: "#job-details",
  skills: ".job-details-how-you-match__skills-section-descriptive-skill",
};

async function search(page: Page, jobDescription: string, location: string) {
  await page.fill(
    "input[aria-label='Search by title, skill, or company']",
    jobDescription
  );
  await page.fill("input[aria-label='City, state, or zip code']", location);
  await page.click("button.jobs-search-box__submit-button");
}
