import { actionPromise } from "index";
import inquirer from "inquirer";
import { Page } from "playwright";
import { followInstagramUsers } from "src/instagram/follow/toggle";
import { ExtractionType, scrapeUsersFromAccount } from "src/instagram/users/get_users";
import { openPage } from "src/utils";
import yargs from "yargs";


export enum InstagramMainMenuActions {
  SCRAPE_USERS = "SCRAPE_USERS",
  UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING = "UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING",
  FOLLOW_USERS = "FOLLOW_USERS",
  UNFOLLOW_USERS = "UNFOLLOW_USERS",
  BACK = "Back to main menu",
}

const instagramAccountPromise = yargs(process.argv.slice(2))
  .option("instagramAccount", {
    alias: "i",
    describe: "Instagram account to scrape",
    type: "string",
  })
  .argv;

const askWhichAccountToScrape = async (): Promise<string> => {
  return inquirer
    .prompt([
      {
        name: "accountToScrape",
        message: "Which account do you want to scrape?",
        choices: [
          "emmabjorndahl",
          "hildanilssson"
        ],
        type: "list",
      },
    ])
    .then(({ accountToScrape }) => accountToScrape);
};

export const openInstagramCmdMenu = async () => {
  const actionResult = await actionPromise;
  let action: InstagramMainMenuActions = actionResult?.action as InstagramMainMenuActions;

  if (!action) {
    const answersInquirer = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "What do you want to do?",
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
            name: "Update info about users",
            value:
              InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING,
          },
          {
            name: "Unfollow users",
            value: InstagramMainMenuActions.UNFOLLOW_USERS,
            disabled: true,
          },
          {
            name: InstagramMainMenuActions.BACK,
            value: InstagramMainMenuActions.BACK,
          },
        ],
      },
    ]);

    action = answersInquirer.action;
  }

  let page: Page;
  let accountToScrape: string | undefined;
  switch (action) {
    case InstagramMainMenuActions.SCRAPE_USERS:
      const argv = await instagramAccountPromise;
      accountToScrape = (argv.i as string) ?? (await askWhichAccountToScrape());
      page = await openPage();
      await scrapeUsersFromAccount({
        accountToScrape,
        page,
        extractionType: ExtractionType.FOLLOWERS,
      });
      break;
    case InstagramMainMenuActions.FOLLOW_USERS:
      page = await openPage();
      await followInstagramUsers({ page });
      break;
    case InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING:
      accountToScrape = process.env.IG_LOGIN;

      if (!accountToScrape) {
        throw new Error("IG_LOGIN not set");
      }

      page = await openPage();
      await scrapeUsersFromAccount({
        accountToScrape,
        page,
        extractionType: ExtractionType.FOLLOWERS,
      });
      break;
    case InstagramMainMenuActions.UNFOLLOW_USERS:
      throw new Error("Not implemented yet");
  }
};