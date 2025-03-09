import { Page } from "@playwright/test";
import { areWeOnDoesntExistPage, logIntoInstagram } from "automated/instagram/instagram-utils";
import { insertUsers } from "automated/instagram/users/users.db";
import { insertStatuses } from "automated/instagram/users/userStatuses.db";
import dotenv from "dotenv";
import { saveInFile, sleepApprox } from "src/utils";
import { log } from "../../../src/utils";
import {
  Followers,
  IGFollowingStatus,
  IGStatuses,
  IGUser,
} from "./get_users.model";

dotenv.config();

// followers = who follows x - we wanna more
// following = who x follows - we want less
export enum ExtractionType {
  FOLLOWERS = "followers",
  FOLLOWING = "following",
};

const COLUMN_OF_FOLLOWERS_SELECTOR =
  ".xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja.x1lliihq.x1iyjqo2.xs83m0k.xz65tgg.x1rife3k.x1n2onr6";

export const scrapeUsersFromAccount = async ({
  page,
  accountToScrape,
  extractionType,
}: {
  page: Page;
  accountToScrape: string;
  extractionType: ExtractionType;
}) => {
  page.setDefaultTimeout(0);

  await logIntoInstagram({ page });

  await page.goto(`https://www.instagram.com/${accountToScrape}/`);

  const notFound = await areWeOnDoesntExistPage(page);
  if(notFound) {
    return log("Account not found");
  };

  let moreToLoad = true;
  const timeout = 10 * 3000;

  const maxIterations = 1000;
  let iteration = 0;

  const users: IGUser[] = [];
  let statuses: {
    [userId: string]: IGFollowingStatus;
  } = {};
  let usersUpdated = 0;
  let statusesUpdated = 0;

  while (moreToLoad && iteration < maxIterations) {
    iteration++;
    log("\n \n Starting iteration nr ", iteration);

    const usersPromise = page.waitForResponse(
      `**/${extractionType}/?count**`,
      {
        timeout,
      }
    );
    const statusesPromise = page.waitForResponse("**/show_many/", {
      timeout,
    });

    // if it's the first time, we need to click on the link
    if (iteration === 1) {
      log(`Clicking on the ${extractionType} link`);
      await page.getByRole("link", { name: extractionType }).click();
    }

    log(`waiting for ${extractionType} to load`);
    const usersRes = await usersPromise;
    const statusesRes = await statusesPromise;

    log(`${extractionType} loaded`);
    const followers: Followers = await usersRes.json();
    const followingStatuses: IGStatuses = await statusesRes.json();

    users.push(...followers.users);
    statuses = { ...statuses, ...followingStatuses.friendship_statuses };

    // saveUsersLocally(users);
    // saveStatusesLocally(statuses);

    usersUpdated += (await saveUsersInDb(followers.users, accountToScrape)) || 0;
    statusesUpdated += (await saveStatusesInDb(followingStatuses, accountToScrape, extractionType)) || 0;
    log(`So far ${usersUpdated} users and ${statusesUpdated} statuses updated`);

    //make sure we don't do too many requests too fast
    log("waiting");
    await sleepApprox(page, 1500);

    log('scrolling down to load more "followers"');
    // try to scroll down to trigger infinite scroll
    const scrolledSuccessfully = await scrollDown(page);

    log(`scrolled ${scrolledSuccessfully ? "" : "⚠ UN"}successfully`);

    if (!scrolledSuccessfully) {
      moreToLoad = false;
    }
  }

  log("done");
};

//scrolls down in the list of followers
const scrollDown = async (page: Page): Promise<boolean> => {
  return page.evaluate((COLUMN_OF_FOLLOWERS_SELECTOR) => {
    const scrollable = document.querySelector(COLUMN_OF_FOLLOWERS_SELECTOR);
    if (!scrollable) {
      throw new Error(`Scrollable not found.
      This could be because the selector is not working anymore.
      Just find the list of followers and update the selector in the code.
      `);
    }

    //check if we can scroll
    if (scrollable.scrollHeight === scrollable.clientHeight) {
      return false;
    }

    scrollable.scrollTo(0, scrollable.scrollHeight);

    return true;
  }, COLUMN_OF_FOLLOWERS_SELECTOR);
};

//Saving stuff 👇

const saveUsersLocally = async (
  users: IGUser[],
  accountScraped: string,
  extractionType: ExtractionType
) => {
  const filePathBase = `${accountScraped}_${extractionType}_`;
  saveInFile("results", filePathBase + "users", "json", users);
};

const saveStatusesLocally = async (
  statuses: {
    [userId: string]: IGFollowingStatus;
  },
  accountScraped: string,
  extractionType: ExtractionType
) => {
  const filePathBase = `${accountScraped}_${extractionType}_`;
  saveInFile("results", filePathBase + "statuses", "json", statuses);
};

const saveUsersInDb = async (users: IGUser[], accountScraped: string) => {
  return await insertUsers(
    users.map((u) => ({
      ...u,
      scrapedFrom_full_name: accountScraped,
      scrapedFrom_type: "user",
    }))
  );
};

const saveStatusesInDb = async (
  { friendship_statuses }: IGStatuses,
  accountScraped: string,
  extractionType: ExtractionType
) => {
  return await insertStatuses(
    Object.entries(friendship_statuses).map(([userId, status]) => {
      if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

      return {
        id: userId,
        ...status,
        follower:
          accountScraped === process.env.IG_LOGIN &&
          extractionType === ExtractionType.FOLLOWERS,
        me: process.env.IG_LOGIN,
      };
    })
  );
};
//Saving stuff 👆
