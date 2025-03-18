import inquirer from "inquirer";
import { Page } from "playwright";
import { openPage } from "src/utils";
import yargs from "yargs";
import { scrapeJobsLinkedin } from "./jobs/get";
import { createNewJobSearch } from "./jobs/jobs.db";

const options = {
  searchTerm: {
    describe: "What is the job description that you want to scrape?",
    default: "Web Developer",
  },
  location: {
    describe: "What is the location?",
    default: "Stockholm",
  },
};

export const openLinkedinCmdMenu = async () => {
  const argv = await yargs(process.argv.slice(2))
    .option("searchTerm", {
      alias: "s",
      describe: options.searchTerm.describe,
      type: "string",
    })
    .option("location", {
      alias: "l",
      describe: "Location to search for",
      type: "string",
    }).argv;

  let searchTerm = argv.searchTerm;
  let location = argv.location;

  if (!searchTerm) {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "searchTerm",
        message: options.searchTerm.describe,
        default: "Web Developer",
      },
    ]);
    searchTerm = response.searchTerm;
  }

  if (!location) {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "location",
        message: options.location.describe,
        default: "Stockholm",
      },
    ]);
    location = response.location;
  }

  if (!searchTerm || !location) {
    throw new Error("Job description and location are required");
  }

  const searchId = await createNewJobSearch(searchTerm, location);

  let page: Page;
  page = await openPage();
  // Don't need this. Never worked. Could be revived one day if I feel like it or need it.
  // await captureAndSaveResponses(page, ScrapingSource.LinkedIn);
  // await mockResponses(page, ScrapingSource.LinkedIn);

  scrapeJobsLinkedin(page, {
    jobDescription: searchTerm,
    location,
    searchId,
    shouldLogin: true,
  });
};
