import inquirer from "inquirer";
import { Page } from "playwright";
import { getElapsedTime, log, openPage } from "src/utils";
import yargs from "yargs";
import { calculateDynamicSearchTimeframe } from "./generic/job-db";
import { JobSource, scrapeJobsAllSources } from "./scrape-orchestrator";

const options = {
  searchTerms: {
    describe: "What is the job descriptions that you want to scrape? Separate them with a ';' if there is more than one.",
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
  })
  .option("login", {
    describe: "Whether to login (mainly for LinkedIn)",
    type: "boolean",
    default: false,
  }).argv;

export const scrapeJobsFromMultipleSources = async () => {
  const timeStarted = new Date();

  let searchTermsUnparsed = argv.searchTerms;
  let location = argv.location;
  const maxAge = argv.maxAge;
  const shouldLogin = argv.login;

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

  if (typeof searchTermsUnparsed !== "string") {
    throw new Error("searchTermsUnparsed must be a string");
  }

  const searchTerms = searchTermsUnparsed.split(";").map(term => term.trim());
  
  // Always use all available sources
  const sources: JobSource[] = ['linkedin', 'jobindex'];

  // Calculate dynamic search timeframe if maxAge is not provided
  const dynamicMaxAge = maxAge || await calculateDynamicSearchTimeframe();

  log(`I will search for "${searchTerms.join(', ')}" in ${location} using sources: ${sources.join(', ')}`);
  log(`🔍 Search timeframe: ${Math.floor(dynamicMaxAge / 60)} minutes (${Math.floor(dynamicMaxAge / 3600)} hours)`);

  const allResults: Record<string, any> = {};

  for (let searchTerm of searchTerms) {
    log(`\n🔍 Processing search term: "${searchTerm}"`);
    
    let page: Page;
    page = await openPage();

    try {
      const results = await scrapeJobsAllSources(page, {
        jobDescription: searchTerm,
        location,
        shouldLogin,
        postsMaxAgeSeconds: dynamicMaxAge,
        sources
      });

      allResults[searchTerm] = results;

      // Log summary for this search term
      const successfulSources = Object.entries(results)
        .filter(([_, result]) => result.success)
        .map(([source, _]) => source);
      
      const failedSources = Object.entries(results)
        .filter(([_, result]) => !result.success)
        .map(([source, result]) => ({ source, error: result.error }));

      if (successfulSources.length > 0) {
        log(`✅ Successfully scraped from: ${successfulSources.join(', ')}`);
      }
      
      if (failedSources.length > 0) {
        log(`❌ Failed to scrape from:`);
        failedSources.forEach(({ source, error }) => {
          log(`   - ${source}: ${error}`);
        });
      }

    } catch (error) {
      console.error(`❌ Error processing search term "${searchTerm}":`, error);
      allResults[searchTerm] = { error: error instanceof Error ? error.message : String(error) };
    } finally {
      await page.close();
    }
  }

  // Final summary
  console.log(`\n📊 SCRAPING SUMMARY`);
  console.log(`Total search terms processed: ${searchTerms.length}`);
  console.log(`Sources attempted: ${sources.join(', ')}`);
  console.log(`Total time: ${getElapsedTime(timeStarted)}`);
  
  // Detailed results
  Object.entries(allResults).forEach(([searchTerm, results]) => {
    console.log(`\n"${searchTerm}":`);
    if (results.error) {
      console.log(`  ❌ Failed: ${results.error}`);
    } else {
      Object.entries(results).forEach(([source, result]: [string, any]) => {
        if (result.success) {
          console.log(`  ✅ ${source}: Search ID ${result.searchId}`);
        } else {
          console.log(`  ❌ ${source}: ${result.error}`);
        }
      });
    }
  });

  return allResults;
};


