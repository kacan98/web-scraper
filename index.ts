import { dbAvailable } from "db";
import inquirer from "inquirer";
import { ScrapingSource } from "model";
import { InstagramMainMenuActions, openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { linkedinMenu, LinkedinOptions } from "src/linkedin/linkedin-cmd";
import yargs from "yargs/yargs";

export const processStarted = new Date();

export const actionPromise = yargs(process.argv.slice(2))
  .alias("a", "action")
  .describe("a", "What do you want to do?")
  .choices("a", [
    InstagramMainMenuActions.SCRAPE_USERS,
    { value: InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING, name: "Update info about users following the current user - run this before unfollowing to avoid unfollowing users who follow back" },
    InstagramMainMenuActions.FOLLOW_USERS,
    InstagramMainMenuActions.UNFOLLOW_USERS,
    LinkedinOptions.SCRAPE,
    LinkedinOptions.AI,
    LinkedinOptions.FIND_MATCHING_JOBS,

  ]).argv;

enum MainMenuActions {
  INSTAGRAM = ScrapingSource.Instagram,
  LINKEDIN = ScrapingSource.LinkedIn,
  EXIT = "Exit",
}

const mainMenu = async () => {
  const dbIsAvailable = await dbAvailable();
  if (!dbIsAvailable) {
    throw new Error(`Database is not available.`);
    return;
  }

  const argv = await yargs(process.argv.slice(2))
    .scriptName("Krels scraper/LinkedIn jobs thing")
    .alias("p", "platform")
    .describe("p", "Which platform do you want to use?")
    .choices("p", [
      MainMenuActions.INSTAGRAM,
      MainMenuActions.LINKEDIN,
    ]).argv;

  let action = argv.p;

  if (!action) {
    const result = await inquirer.prompt({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: MainMenuActions.LINKEDIN, value: MainMenuActions.LINKEDIN },
        { name: MainMenuActions.INSTAGRAM, value: MainMenuActions.INSTAGRAM },
        { name: "Exit", value: MainMenuActions.EXIT },
      ],
    });

    action = result.action;
  }

  switch (action) {
    case MainMenuActions.INSTAGRAM:
      await openInstagramCmdMenu();
      break;
    case MainMenuActions.LINKEDIN:
      await linkedinMenu();
      break;
    case MainMenuActions.EXIT:
      console.log("Exiting...");
      break;
  }
};

mainMenu();
