import { DEV_MODE } from "envVars";
// import { actionPromise } from "index"; // Removed, replaced by parsedCliArgs
// import inquirer from "inquirer"; // Removed, replaced by getCliArgOrPrompt
import { analyzeLinkedInJobs } from "src/ai/ai-cmd";
import { scrapeLinkedinJobs } from "src/linkedin/linkedin-scraping-cmd";
import { getCliArgOrPrompt, getElapsedTime, log } from "src/utils"; // Added getCliArgOrPrompt and log
import { findMatchingJobsForKarel } from "./jobs/findMatchingJobs";
import { findRatedJobsForKarel } from "./jobs/findRatedJobs";


export enum LinkedinOptions {
    SCRAPE = 'Scrape_jobs',
    AI = 'Analyze_scraped_jobs',
    FIND_MATCHING_JOBS = 'Find_jobs_in_db',
    RATE_JOBS = 'Rate jobs',
    EXIT = "Exit"
}

export const linkedinMenu = async (parsedCliArgs: any) => { // Added parsedCliArgs parameter
    // const actionResult = await actionPromise; // Removed
    // let action: LinkedinOptions = actionResult?.action as LinkedinOptions; // Removed

    const actionPromptOptions = {
        type: "list", // Changed from "select" to "list"
        name: "linkedin_action_choice", // Unique name for the prompt
        message: "What would you like to do with LinkedIn jobs?",
        choices: [
            { name: 'Step 1) Scrape jobs from LinkedIn', value: LinkedinOptions.SCRAPE },
            { name: 'Step 2) Analyze scraped jobs with AI', value: LinkedinOptions.AI },
            { name: 'Step 3A) Find jobs for Karel based on criteria', value: LinkedinOptions.FIND_MATCHING_JOBS },
            { name: 'Step 3B) Find rated jobs for Karel based on criteria', value: LinkedinOptions.RATE_JOBS },
            { name: "Exit to main menu", value: LinkedinOptions.EXIT }, // Clarified Exit behavior
        ],
    };

    const chosenAction = await getCliArgOrPrompt<LinkedinOptions>(
        parsedCliArgs,
        "action", // Yargs primary name for the argument (e.g. from .alias('a', 'action'))
        actionPromptOptions
    );

    // if (!action) { // Removed old inquirer prompt block
    //     const result = await inquirer.prompt({
    //         type: "select",
    //         name: "action",
    //         message: "What would you like to do?",
    //         choices: [
    //             { name: 'Step 1) Scrape jobs from LinkedIn', value: LinkedinOptions.SCRAPE },
    //             { name: 'Step 2) Analyze scraped jobs with AI', value: LinkedinOptions.AI },
    //             { name: 'Step 3A) Find jobs for Karel based on criteria', value: LinkedinOptions.FIND_MATCHING_JOBS },
    //             { name: 'Step 3B) Find rated jobs for Karel based on criteria', value: LinkedinOptions.RATE_JOBS },
    //             { name: "Exit", value: LinkedinOptions.EXIT },
    //         ],
    //     });

    //     action = result.action.a; // This line was incorrect, result.action would be the value
    // }

    switch (chosenAction) { // Changed from action to chosenAction
        case LinkedinOptions.SCRAPE:
            const timeStarted = new Date();

            try {
                await scrapeLinkedinJobs();
            } catch (error) {
                console.error('Error scraping LinkedIn jobs:', error); // Kept console.error for errors
            }

            log('Trying to analyze jobs...'); // Using log utility
            //I know the default is true, I just wanna make sure that it's extra much true here :D
            await analyzeLinkedInJobs(true);
            DEV_MODE && await findMatchingJobsForKarel();

            log(`Scraping completed in ${getElapsedTime(timeStarted)}`); // Using log utility
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
            log("Returning to main menu..."); // Using log utility and updated message
            break;
        default:
            log(`Invalid LinkedIn option selected: ${chosenAction}. Returning to main menu.`); // Added default case
            break;
    }
};