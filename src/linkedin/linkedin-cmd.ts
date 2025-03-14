import inquirer from "inquirer";
import { Page } from "playwright";
import { openPage } from "src/utils";
import yargs from "yargs";
import { getJobsLinkedin } from "./jobs/get";

const options = {
  job: {
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
    .option("job", {
      alias: "j",
      describe: options.job.describe,
      type: "string",
    })
    .option("location", {
      alias: "l",
      describe: "Location to search for",
      type: "string",
    }).argv;

  let job = argv.job;
  let location = argv.location;

  if (!job) {
    const response = await inquirer.prompt([
      {
        type: "input",
        name: "jobDescription",
        message: options.job.describe,
        default: "Web Developer",
      },
    ]);
    job = response.jobDescription;
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

  if (!job || !location) {
    throw new Error("Job description and location are required");
  }

  let page: Page;
  page = await openPage();
  // Don't need this. Never worked. Could be revived one day if I feel like it or need it.
  // await captureAndSaveResponses(page, ScrapingSource.LinkedIn);
  // await mockResponses(page, ScrapingSource.LinkedIn);
  
  getJobsLinkedin(page, {
    jobDescription: job,
    location,
    shouldLogin: true,
  });
};
