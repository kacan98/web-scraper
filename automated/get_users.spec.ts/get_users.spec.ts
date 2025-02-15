import { Page, test } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { errorLog, forever, saveInFile, sleepApprox } from "src/utils";
import { fileURLToPath } from "url";
import {
  Followers,
  FollowingStatuses,
  IGFollowingStatus,
  IGUser,
} from "./get_users.model";
import { log } from "../../src/utils";
import { insertUsers } from "db/users";
import { insertStatuses } from "db/userStatuses";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.beforeAll(async () => {
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

  await login();
});

test.beforeEach(async ({ page }) => {
  const cookiesPath = path.join("cookies.json");
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);
});

const extractionType: "followers" | "following" = "followers";
// const account = process.env.IG_LOGIN;
// other swedish pysel lenalinderholm, ateljeristanmariab
// kreativakarin, fixasjalv, pysselbolaget, sabinebrandt_studio, pysselbyran, pysseldoktorn
const accountToScrape = "ateljeristanmariab";

if (!accountToScrape) {
  throw new Error("IG_LOGIN not set");
}

const COLUMN_OF_FOLLOWERS_SELECTOR =
  ".xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja.x1lliihq.x1iyjqo2.xs83m0k.xz65tgg.x1rife3k.x1n2onr6";

test.only("scrape users from account", async ({ page }) => {
  test.setTimeout(0);

  await page.goto(`https://www.instagram.com/${accountToScrape}/`);

  let moreToLoad = true;
  const timeout = 10 * 3000;

  const maxIterations = 300;
  let iteration = 0;

  const users: IGUser[] = [];
  let statuses: {
    [userId: string]: IGFollowingStatus;
  } = {};

  while (moreToLoad && iteration < maxIterations) {
    iteration++;
    log("\n \n Starting iteration nr ", iteration);

    const followersPromise = page.waitForResponse("**/followers/?count**", {
      timeout,
    });
    const followingStatusPromise = page.waitForResponse("**/show_many/", {
      timeout,
    });

    // if it's the first time, we need to click on the followers link
    if (iteration === 1) {
      log("Clicking on the followers link");
      await page.getByRole("link", { name: "followers" }).click();
    }

    log('waiting for "followers" to load');
    const followersRes = await followersPromise;
    const followingStatusRes = await followingStatusPromise;

    log("followers loaded");
    const followers: Followers = await followersRes.json();
    const followingStatuses: FollowingStatuses =
      await followingStatusRes.json();

    users.push(...followers.users);
    statuses = { ...statuses, ...followingStatuses.friendship_statuses };

    log(
      `saving ${users.length} users and ${
        Object.keys(statuses).length
      } statuses`
    );
    saveUsersLocally(users);
    saveStatusesLocally(statuses);

    await saveUsersInDb(followers.users);
    await saveStatusesInDb(followingStatuses);
    log("saved in db");

    //make  sure we don't do too many requests too fast
    log("waiting");
    await sleepApprox(page, 5000);

    log('scrolling down to load more "followers"');
    // try to scroll down to trigger infinite scroll
    const scrolledSuccessfully = await scrollDown(page);

    log(`scrolled ${scrolledSuccessfully ? "" : "⚠ UN"}successfully`);

    if (!scrolledSuccessfully) {
      moreToLoad = false;
    }
  }

  log("done");
});

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
const filePathBase = `${accountToScrape}_${extractionType}_`;

const saveUsersLocally = async (users: IGUser[]) => {
  saveInFile("results", filePathBase + "users", "json", users);
};

const saveStatusesLocally = async (statuses: {
  [userId: string]: IGFollowingStatus;
}) => {
  saveInFile("results", filePathBase + "statuses", "json", statuses);
};

const saveUsersInDb = async (users: IGUser[]) => {
  await insertUsers(
    users.map((u) => ({
      ...u,
      scrapedFrom_full_name: accountToScrape,
      scrapedFrom_type: "user",
    }))
  );
};

const saveStatusesInDb = async (statuses: FollowingStatuses) => {
  await insertStatuses(statuses.friendship_statuses);
};
//Saving stuff 👆
