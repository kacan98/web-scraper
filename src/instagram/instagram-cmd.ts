import { Browser, Page } from "playwright"; // Added Browser
import { followInstagramUsers } from "src/instagram/follow/toggle";
import { ExtractionType, scrapeUsersFromAccount } from "src/instagram/users/get_users";
import { getCliArgOrPrompt, openPage, log } from "src/utils"; // Assuming log is in utils
// Removed yargs and inquirer imports as they are handled by getCliArgOrPrompt

export enum InstagramMainMenuActions {
  SCRAPE_USERS = "SCRAPE_USERS",
  UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING = "UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING",
  FOLLOW_USERS = "FOLLOW_USERS",
  UNFOLLOW_USERS = "UNFOLLOW_USERS",
  BACK = "Back to main menu",
}

// Removed instagramAccountPromise and askWhichAccountToScrape

export const openInstagramCmdMenu = async (parsedCliArgs: any) => {
  const actionPromptOptions = {
    type: "list",
    name: "instagram_action_choice", // Unique name for the prompt
    message: "What do you want to do on Instagram?",
    choices: [
      {
        name: "Scrape users from account",
        value: InstagramMainMenuActions.SCRAPE_USERS,
      },
      {
        name: "Follow users",
        value: InstagramMainMenuActions.FOLLOW_USERS,
      },
      {
        name: "Update info about users following you (run before unfollowing)",
        value:
          InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING,
      },
      {
        name: "Unfollow users",
        value: InstagramMainMenuActions.UNFOLLOW_USERS,
        // disabled: true, // Inquirer 'disabled' property might not be directly supported this way in all contexts, consider conditional logic if needed
      },
      {
        name: "Back to main menu", // Clarified name
        value: InstagramMainMenuActions.BACK,
      },
    ],
  };

  const chosenAction = await getCliArgOrPrompt<InstagramMainMenuActions>(
    parsedCliArgs,
    "action", // Checks for -a or --action
    actionPromptOptions
  );

  let page: Page | undefined; // Changed to allow undefined initially
  let browser: Browser | undefined; // Added browser
  let accountToScrape: string | undefined;

  // Conditionally open page and browser
  if (
    chosenAction === InstagramMainMenuActions.SCRAPE_USERS ||
    chosenAction === InstagramMainMenuActions.FOLLOW_USERS ||
    chosenAction === InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING ||
    chosenAction === InstagramMainMenuActions.UNFOLLOW_USERS // Assuming UNFOLLOW_USERS will also need a page
  ) {
    const { page: newPage, browser: newBrowser } = await openPage();
    page = newPage;
    browser = newBrowser;
  }

  try {
    switch (chosenAction) {
      case InstagramMainMenuActions.SCRAPE_USERS:
        if (!page) {
          log("Page was not initialized for SCRAPE_USERS. This should not happen if logic is correct.");
          throw new Error("Page not initialized for scraping users");
        }
        const accountPromptOptions = {
        type: "list", // Or 'input' if free-form text is allowed
        name: "instagram_account_to_scrape", // Unique name
        message: "Which account do you want to scrape?",
        choices: ["emmabjorndahl", "hildanilssson"], // Example choices
        // Or if type: "input", remove 'choices'
      };
      accountToScrape = await getCliArgOrPrompt<string>(
        parsedCliArgs,
        "instagramAccount", // Checks for -i or --instagramAccount
        accountPromptOptions
      );
      if (!accountToScrape) {
        log("No Instagram account provided for scraping. Aborting.");
        break;
      }
      // page = await openPage(); // Removed individual call
      await scrapeUsersFromAccount({
        accountToScrape,
        page, // page is already defined and passed
        extractionType: ExtractionType.FOLLOWERS,
      });
      break;
    case InstagramMainMenuActions.FOLLOW_USERS:
      if (!page) {
        log("Page was not initialized for FOLLOW_USERS. This should not happen.");
        throw new Error("Page not initialized for following users");
      }
      // page = await openPage(); // Removed individual call
      await followInstagramUsers({ page }); // page is already defined and passed
      break;
    case InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING:
      if (!page) {
        log("Page was not initialized for UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING. This should not happen.");
        throw new Error("Page not initialized for updating following info");
      }
      // For this action, the account to scrape is the logged-in user's account.
      // The CLI arg -i/--instagramAccount is not typically used to specify *this* account,
      // but rather the target for scraping.
      // If parsedCliArgs.instagramAccount is provided, it might be confusing.
      // Prioritizing environment variable for clarity and security of logged-in user.
      accountToScrape = process.env.IG_LOGIN;

      if (!accountToScrape) {
        // Fallback or error if IG_LOGIN is not set.
        // Optionally, could use getCliArgOrPrompt here if IG_LOGIN is missing and we want to prompt.
        // However, the original logic directly threw an error.
        log("Error: IG_LOGIN environment variable is not set. This is required to update information about users following you.");
        // For now, adhering to the original behavior of throwing an error.
        // If a prompt is desired, it would look like:
        // accountToScrape = await getCliArgOrPrompt<string>(
        //   parsedCliArgs,
        //   "instagramAccount", // or a more specific name like "loggedInInstagramAccount"
        //   {
        //     type: "input",
        //     name: "logged_in_ig_account_prompt",
        //     message: "Enter your Instagram username (the one you are logged in as):",
        //   }
        // );
        // if (!accountToScrape) {
        //   log("No Instagram account provided for updating followers. Aborting.");
        //   break;
        // }
        throw new Error("IG_LOGIN not set, and prompting for it is not implemented in this refactor yet for UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING.");
      }
      
      log(`Updating information for account: ${accountToScrape} (from IG_LOGIN)`);
      // page = await openPage(); // Removed individual call
      await scrapeUsersFromAccount({
        accountToScrape, // This should be the logged-in user's account
        page, // page is already defined and passed
        extractionType: ExtractionType.FOLLOWING, 
      });
      break;
    case InstagramMainMenuActions.UNFOLLOW_USERS:
      if (!page) {
        log("Page was not initialized for UNFOLLOW_USERS. This should not happen.");
        throw new Error("Page not initialized for unfollowing users");
      }
      log("Unfollow users action is not fully implemented yet.");
      // Potentially:
      // await unfollowInstagramUsers({ page }); // Assuming such a function exists
      throw new Error("Not implemented yet (but page would be available)");
    case InstagramMainMenuActions.BACK:
      log("Returning to main menu...");
      break;
    default:
      log(`Invalid Instagram action choice: ${chosenAction}. Returning to main menu.`);
      break;
    }
  } finally {
    if (browser) {
      log("Closing browser for Instagram actions...");
      await browser.close();
    }
  }
};