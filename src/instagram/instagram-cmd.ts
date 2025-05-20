import { followInstagramUsers } from "src/instagram/follow/toggle";
import { ExtractionType, scrapeUsersFromAccount } from "src/instagram/users/get_users";
import inquirer from "inquirer";
import { Page } from "playwright";
import { openPage } from "src/utils";


enum InstagramMainMenuActions {
  SCRAPE_USERS = "Scrape users from account",
  UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING
  = `Update info about users following the current user 
  - run this before unfollowing to avoid unfollowing users who follow back`,
  FOLLOW_USERS = "Follow users",
  UNFOLLOW_USERS = "Unfollow users",
  BACK = "Back to main menu",
}

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
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What do you want to do?",
      choices: [
        {
          name: InstagramMainMenuActions.SCRAPE_USERS,
          value: InstagramMainMenuActions.SCRAPE_USERS,
        },
        {
          name: InstagramMainMenuActions.FOLLOW_USERS,
          value: InstagramMainMenuActions.FOLLOW_USERS,
        },
        {
          name: InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING,
          value:
            InstagramMainMenuActions.UPDATE_INFORMATION_ABOUT_USERS_FOLLOWING,
        },
        {
          name: InstagramMainMenuActions.UNFOLLOW_USERS,
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

  let page: Page;
  let accountToScrape: string | undefined;
  switch (action) {
    case InstagramMainMenuActions.SCRAPE_USERS:
      accountToScrape = await askWhichAccountToScrape();
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