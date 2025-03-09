import inquirer from "inquirer";

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

  switch (action) {
    case LinkedinMenuActions.SCRAPE:
      console.log("Scraping Linkedin");
      break;
  }
};
