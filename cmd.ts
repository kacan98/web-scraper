import { openInstagramCmdMenu } from "src/instagram/instagram-cmd";
import { openLinkedinCmdMenu } from "src/linkedin/linkedin-cmd";
import inquirer from "inquirer";

enum MainMenuActions {
  INSTAGRAM = "Instagram",
  LINKEDIN = "LinkedIn",
  EXIT = "Exit",
}

const mainMenu = async () => {
  const { action } = await inquirer.prompt({
    type: "select",
    name: "action",
    message: "What would you like to do?",
    choices: [
      { name: MainMenuActions.INSTAGRAM, value: MainMenuActions.INSTAGRAM },
      { name: MainMenuActions.LINKEDIN, value: MainMenuActions.LINKEDIN },
      { name: "Exit", value: MainMenuActions.EXIT },
    ],
  });

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
