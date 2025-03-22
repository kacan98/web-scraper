import inquirer from "inquirer";
import { ScrapingSource } from "model";
import { analyzeLinkedInJobs } from "src/ai/ai-cmd";
import { askGemini } from "src/ai/gemini";
import { openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { openLinkedinCmdMenu } from "src/linkedin/linkedin-cmd";
import yargs from "yargs/yargs";

enum MainMenuActions {
  INSTAGRAM = ScrapingSource.Instagram,
  LINKEDIN = ScrapingSource.LinkedIn,
  AI = 'Analyse LinkedIn Jobs',
  EXIT = "Exit",
}

const mainMenu = async () => {
  const argv = await yargs(process.argv.slice(2))
    .scriptName("Krels scraper")
    .alias("a", "action")
    .describe("a", "What do you want to do?")
    .choices("a", [
      MainMenuActions.INSTAGRAM,
      MainMenuActions.LINKEDIN,
      MainMenuActions.AI,
    ]).argv;

  let action = argv.a;

  if (!action) {
    const result = await inquirer.prompt({
      type: "select",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: MainMenuActions.INSTAGRAM, value: MainMenuActions.INSTAGRAM },
        { name: MainMenuActions.LINKEDIN, value: MainMenuActions.LINKEDIN },
        { name: MainMenuActions.AI, value: MainMenuActions.AI },
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
    case MainMenuActions.AI:
      await analyzeLinkedInJobs();
      break;
    case MainMenuActions.EXIT:
      console.log("Exiting...");
      break;
  }
};

mainMenu();
