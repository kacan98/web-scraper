import { dbAvailable } from "db";
import inquirer from "inquirer";
import { ScrapingSource } from "model";
import { openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { linkedinMenu } from "src/linkedin/linkedin-cmd";
import yargs from "yargs/yargs";

export const processStarted = new Date();

export const getElapsedTime = (since: Date = processStarted) => {
  const now = new Date(since);

  const elapsedTime = now.getTime() - processStarted.getTime();
  const seconds = Math.floor((elapsedTime / 1000) % 60);
  const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
  const hours = Math.floor((elapsedTime / (1000 * 60 * 60)) % 24);
  const days = Math.floor(elapsedTime / (1000 * 60 * 60 * 24));

  let result = `Elapsed time: `;
  if (days > 0) result += `${days} days, `;
  if (hours > 0) result += `${hours} hours, `;
  if (minutes > 0) result += `${minutes} minutes, `;
  if (seconds > 0) result += `${seconds} seconds`;

  return result;
}

enum MainMenuActions {
  INSTAGRAM = ScrapingSource.Instagram,
  LINKEDIN = ScrapingSource.LinkedIn,
  EXIT = "Exit",
}

const mainMenu = async () => {
  if (!dbAvailable()) {
    throw new Error("Database is not available. Maybe Docker desktop is not running?");
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
