import inquirer from "inquirer";
import { getJobsLinkedin } from "./jobs/get";
import { Page } from "playwright";
import { openPage } from "src/utils";

enum LinkedinMenuActions {
  SCRAPE = "Scrape",
}

export const openLinkedinCmdMenu = async () => {
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What do you want to do?",
      choices: [
        { name: LinkedinMenuActions.SCRAPE, value: LinkedinMenuActions.SCRAPE },
      ],
    },
  ]);

  let page: Page;
  switch (action) {
    case LinkedinMenuActions.SCRAPE:
      page = await openPage();
      getJobsLinkedin(page);
      break;
  }
};
