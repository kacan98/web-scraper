import { DEV_MODE } from "envVars";
import { actionPromise } from "index";
import inquirer from "inquirer";
import { analyzeLinkedInJobs } from "src/ai/ai-cmd";
import { scrapeLinkedinJobs } from "src/linkedin/linkedin-scraping-cmd";
import { getElapsedTime } from "src/utils";
import { findMatchingJobsForKarel } from "./jobs/findMatchingJobs";
import { findRatedJobsForKarel } from "./jobs/findRatedJobs";


export enum LinkedinOptions {
    SCRAPE = 'Scrape_jobs',
    AI = 'Analyze_scraped_jobs',
    FIND_MATCHING_JOBS = 'Find_jobs_in_db',
    RATE_JOBS = 'Rate jobs',
    EXIT = "Exit"
}

export const linkedinMenu = async () => {
    const actionResult = await actionPromise;
    let action: LinkedinOptions = actionResult?.action as LinkedinOptions;

    if (!action) {
        const result = await inquirer.prompt({
            type: "select",
            name: "action",
            message: "What would you like to do?",
            choices: [
                { name: 'Step 1) Scrape jobs from LinkedIn', value: LinkedinOptions.SCRAPE },
                { name: 'Step 2) Analyze scraped jobs with AI', value: LinkedinOptions.AI },
                { name: 'Step 3A) Find jobs for Karel based on criteria', value: LinkedinOptions.FIND_MATCHING_JOBS },
                { name: 'Step 3B) Find rated jobs for Karel based on criteria', value: LinkedinOptions.RATE_JOBS },
                { name: "Exit", value: LinkedinOptions.EXIT },
            ],
        });

        action = result.action.a;
    }

    switch (action) {
        case LinkedinOptions.SCRAPE:
            const timeStarted = new Date();

            try {
                await scrapeLinkedinJobs();
            } catch (error) {
                console.error('Error scraping LinkedIn jobs:', error);
            }

            console.log('Trying to analyze jobs...');
            //I know the default is true, I just wanna make sure that it's extra much true here :D
            await analyzeLinkedInJobs(true);
            DEV_MODE && await findMatchingJobsForKarel();

            console.log(`Scraping completed in ${getElapsedTime(timeStarted)}`);
            break;
        case LinkedinOptions.AI:
            await analyzeLinkedInJobs();
            DEV_MODE && await findMatchingJobsForKarel();

            break;
        case LinkedinOptions.FIND_MATCHING_JOBS:
            await findMatchingJobsForKarel();
            break;

        case LinkedinOptions.RATE_JOBS:
            await findRatedJobsForKarel();
            break;

        case LinkedinOptions.EXIT:
            console.log("Exiting...");
            break;
    }
};