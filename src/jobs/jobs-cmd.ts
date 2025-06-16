import { DEV_MODE } from "envVars";
import { actionPromise } from "index";
import inquirer from "inquirer";
import { analyzeJobsWithAI } from "src/ai/ai-cmd";
import { getElapsedTime } from "src/utils";
import { findMatchingJobsForKarel } from "./findMatchingJobsForKarel";
import { findRatedJobsForKarel } from "./findRatedJobs";
import { scrapeJobsFromMultipleSources } from "./scrape-cmd";

export enum JobsOptions {
    SCRAPE = 'Scrape_jobs',
    AI_ANALYZE = 'AI_analyze',
    FIND_RATED = 'Find_rated',
    FIND_MATCHING = 'Find_matching',
    EXIT = "Exit"
}

export const jobsMenu = async () => {
    const actionResult = await actionPromise;
    let action: JobsOptions = actionResult?.action as JobsOptions;

    if (!action) {
        const result = await inquirer.prompt({
            type: "select",
            name: "action",
            message: "What would you like to do with jobs?", choices: [
                { name: 'Scrape jobs from all sources (LinkedIn, JobIndex)', value: JobsOptions.SCRAPE },
                { name: 'Analyze jobs with AI (all sources)', value: JobsOptions.AI_ANALYZE },
                { name: 'Find rated jobs (show best matches)', value: JobsOptions.FIND_RATED },
                { name: 'Find matching jobs for Karel (custom filters)', value: JobsOptions.FIND_MATCHING },
                { name: "Exit", value: JobsOptions.EXIT },
            ],
        });

        action = result.action;
    } switch (action) {
        case JobsOptions.SCRAPE:
            const timeStarted = new Date();

            try {
                await scrapeJobsFromMultipleSources();
            } catch (error) {
                console.error('Error scraping jobs:', error);
            }

            if (DEV_MODE) {
                console.log(`Scraping completed in ${getElapsedTime(timeStarted)}`);
                await analyzeJobsWithAI();
                await findRatedJobsForKarel();
            }
            break;

        case JobsOptions.AI_ANALYZE:
            const aiTimeStarted = new Date();

            try {
                await analyzeJobsWithAI(true);
            } catch (error) {
                console.error('Error analyzing jobs with AI:', error);
            }

            if (DEV_MODE) {
                console.log(`AI analysis completed in ${getElapsedTime(aiTimeStarted)}`);
            }
            break;

        case JobsOptions.FIND_RATED:
            const ratedTimeStarted = new Date();

            try {
                console.log("🔍 Finding rated jobs based on your skills...");
                await findRatedJobsForKarel();
            } catch (error) {
                console.error('Error finding rated jobs:', error);
            }

            if (DEV_MODE) {
                console.log(`Find rated jobs completed in ${getElapsedTime(ratedTimeStarted)}`);
            } break;

        case JobsOptions.FIND_MATCHING:
            const matchingTimeStarted = new Date();

            try {
                console.log("🎯 Finding matching jobs for Karel...");
                await findMatchingJobsForKarel();
            } catch (error) {
                console.error('Error finding matching jobs for Karel:', error);
            }

            if (DEV_MODE) {
                console.log(`Find matching jobs completed in ${getElapsedTime(matchingTimeStarted)}`);
            }
            break;

        case JobsOptions.EXIT:
            console.log("Exiting...");
            break;
    }
};

// For backward compatibility, export linkedinMenu as well
export const linkedinMenu = jobsMenu;
export { JobsOptions as LinkedinOptions };
