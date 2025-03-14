import { openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { openLinkedinCmdMenu } from "src/linkedin/linkedin-cmd";
import inquirer from "inquirer";
import yargs from "yargs/yargs";
import { ScrapingSource } from "model";

enum MainMenuActions {
  INSTAGRAM = ScrapingSource.Instagram,
  LINKEDIN = ScrapingSource.LinkedIn,
  EXIT = "Exit",
}

const mainMenu = async () => {
  const argv = await yargs(process.argv.slice(2))
    .scriptName("Krels scraper")
    .alias("p", "platform")
    .describe("p", "Platform to scrape")
    .choices("p", [MainMenuActions.INSTAGRAM, MainMenuActions.LINKEDIN]).argv;

  let action = argv.p;

  if (!action) {
    const result = await inquirer.prompt({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: MainMenuActions.INSTAGRAM, value: MainMenuActions.INSTAGRAM },
        { name: MainMenuActions.LINKEDIN, value: MainMenuActions.LINKEDIN },
        { name: "Exit", value: MainMenuActions.EXIT },
      ],
    });

    action = result.action;
  }

  switch (action) {
    case MainMenuActions.INSTAGRAM:
      openInstagramCmdMenu();
      break;
    case MainMenuActions.LINKEDIN:
      openLinkedinCmdMenu();
      break;
    case MainMenuActions.EXIT:
      console.log("Exiting...");
      break;
  }
};

mainMenu();
