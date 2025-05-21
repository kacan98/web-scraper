import inquirer from "inquirer";
import { Page } from "playwright";
import { getElapsedTime, log, openPage } from "src/utils";
import yargs from "yargs";
import { scrapeJobsLinkedin } from "./jobs/scrape";
import { createNewJobSearch } from "./jobs/jobs.db";

export const karelSearchWords = [
  'Angular',
  'TypeScript',
  'JavaScript',
  'Web Developer'
]

const options = {
  searchTerms: {
    describe: "What is the job descriptions that you want to scrape? Separate them with a ';' if there is more then one.",
    default: "TypeScript",
  },
  location: {
    describe: "What is the location?",
    default: "Copenhagen",
  },
};

const argv = await yargs(process.argv.slice(2))
  .option("searchTerms", {
    alias: "s",
    describe: options.searchTerms.describe,
    type: "string",
  })
  .option("location", {
    alias: "l",
    describe: "Location to search for",
    type: "string",
  })
  .option("maxAge", {
    alias: "m",
    describe: "Max age of the job postings in seconds",
    type: "number",
  }).argv;

export const scrapeLinkedinJobs = async () => {
  const timeStarted = new Date();

  let searchTermsUnparsed = argv.searchTerms;
  let location = argv.location;
  const maxAge = argv.maxAge;

  if (!searchTermsUnparsed) {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "searchTerms",
        message: options.searchTerms.describe,
        default: options.searchTerms.default,
      },
    ]);
    searchTermsUnparsed = response.searchTerms;
  }

  if (!location) {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "location",
        message: options.location.describe,
        default: options.location.default,
      },
    ]);
    location = response.location;
  }

  if (!searchTermsUnparsed || !location) {
    throw new Error("Job description and location are required");
  }

  //check if searchTermsUnparsed is string
  if (typeof searchTermsUnparsed !== "string") {
    throw new Error("searchTermsUnparsed must be a string");
  }

  const searchTerms = searchTermsUnparsed.split(";");

  log(`I will search for "${searchTerms.join(', ')}" in ${location}`);

  for (let searchTerm of searchTerms) {
    const searchId = await createNewJobSearch(searchTerm, location);

    let page: Page;
    page = await openPage();
    // Don't need this. Never worked. Could be revived one day if I feel like it or need it.
    // await captureAndSaveResponses(page, ScrapingSource.LinkedIn);
    // await mockResponses(page, ScrapingSource.LinkedIn);

    await scrapeJobsLinkedin(page, {
      jobDescription: searchTerm,
      location,
      searchId,
      shouldLogin: true,
      postsMaxAgeSeconds: maxAge,
    });
  }

  console.log(`Scraping completed in ${getElapsedTime(timeStarted)}`);
};
