import { dbAvailable } from "db";
import { ScrapingSource } from "model";
import { InstagramMainMenuActions, openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { linkedinMenu, LinkedinOptions } from "src/linkedin/linkedin-cmd";
import { getCliArgOrPrompt, log } from "src/utils"; // Assuming log is also in utils
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export const processStarted = new Date();

// Define available actions by filtering out "BACK" or "EXIT" options
const validInstagramActions = Object.values(InstagramMainMenuActions).filter(
  action => action !== InstagramMainMenuActions.BACK
);
const validLinkedInOptions = Object.values(LinkedinOptions).filter(
  option => option !== LinkedinOptions.EXIT // Assuming LinkedinOptions.EXIT exists
);

const yargsInstance = yargs(hideBin(process.argv))
  .option('p', {
    alias: 'platform',
    describe: 'Platform to use',
    choices: [ScrapingSource.Instagram, ScrapingSource.LinkedIn, "Exit" as const], // Added "Exit"
    type: 'string',
  })
  .option('a', {
    alias: 'action',
    describe: 'Action to perform',
    choices: [...validInstagramActions, ...validLinkedInOptions],
    type: 'string',
  })
  .option('i', {
    alias: 'instagramAccount',
    describe: 'Instagram account to scrape',
    type: 'string',
  })
  .help();

// Export parsed CLI arguments
export const parsedCliArgs = yargsInstance.argv;

// Enum for main menu choices (already aligns with ScrapingSource and "Exit")
enum MainMenuActions {
  Instagram = ScrapingSource.Instagram,
  LinkedIn = ScrapingSource.LinkedIn,
  Exit = "Exit",
}

const mainMenu = async () => {
  if (!(await dbAvailable())) {
    log("DB not available, exiting"); // Using log function
    process.exit(1); // Exit with an error code
  }

  const args = await parsedCliArgs; // Await the parsed arguments

  const chosenPlatform = await getCliArgOrPrompt<MainMenuActions>(
    args,
    'platform', // Corresponds to alias 'p'
    {
      type: 'list', // Changed from 'select' to 'list' for inquirer standard
      name: 'main_platform_choice', // Unique name for this prompt
      message: 'Which platform do you want to use?',
      choices: [
        { name: 'Instagram', value: MainMenuActions.Instagram },
        { name: 'LinkedIn', value: MainMenuActions.LinkedIn },
        // Assuming LinkedInScraping is not a top-level choice anymore based on previous description
        // If it is, it should be added here and to MainMenuActions enum
        { name: 'Exit', value: MainMenuActions.Exit },
      ],
    }
  );

  switch (chosenPlatform) {
    case MainMenuActions.Instagram:
      // Pass the full 'args' object to the platform-specific menu
      await openInstagramCmdMenu(args);
      break;
    case MainMenuActions.LinkedIn:
      // Pass the full 'args' object to the platform-specific menu
      await linkedinMenu(args);
      break;
    // Case for LinkedInScraping might be needed if it's a separate top-level option
    // else if (chosenPlatform === MainMenuActions.LinkedInScraping) {
    //   await linkedinScrapingMenu(args);
    // }
    case MainMenuActions.Exit:
      log("Exiting...");
      process.exit(0);
      break;
    default:
      // Handle any unexpected platform choice
      log(`Invalid platform choice: ${chosenPlatform}. Exiting.`);
      process.exit(1);
  }
};

mainMenu();
