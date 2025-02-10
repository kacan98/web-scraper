import { Page, test } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { sleepApprox } from "scripts/utils";
import { fileURLToPath } from "url";
dotenv.config();

const loggingEnabled = true;
const log = (...args: any[]) => {
  if (loggingEnabled) {
    console.log(...args);
  }
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

test.beforeAll(async () => {
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

  await login();
});

test.beforeEach(async ({ page }) => {
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);
});

const extractionType: "followers" | "following" = "followers";
// const account = process.env.IG_LOGIN;
// other swedish pysel lenalinderholm, ateljeristanmariab, pysslamedviktoria
// kreativakarin, fixasjalv, pysselbolaget, sabinebrandt_studio, pysselbyran, pysseldoktorn
const accountToScrape = "pysslamedviktoria";
if (!accountToScrape) throw new Error("IG_LOGIN not set");

const COLUMN_OF_FOLLOWERS_SELECTOR =
  ".xyi19xy.x1ccrb07.xtf3nb5.x1pc53ja.x1lliihq.x1iyjqo2.xs83m0k.xz65tgg.x1rife3k.x1n2onr6";

interface FriendshipStatus {
  following: boolean;
  incoming_request: boolean;
  is_bestie: boolean;
  is_private: boolean;
  is_restricted: boolean;
  outgoing_request: boolean;
  is_feed_favorite: boolean;
}

interface FollowingStatuses {
  friendship_statuses: {
    [userId: string]: FriendshipStatus;
  };
}

interface User {
  pk: string; // e.g. "66481554801"
  pk_id: string; // e.g. "66481554801"
  id: string; // e.g. "66481554801"
  username: string; // e.g. "jozhaswireart"
  full_name: string; // e.g. "Jozhas Wire Art"
  is_private: boolean; // e.g. false
  fbid_v2: string; // e.g. "17841466564030194"
  third_party_downloads_enabled: number; // e.g. 0
  strong_id__: string; // e.g. "66481554801"
  profile_pic_id: string; // e.g. "3353856056544564103_66481554801"
  profile_pic_url: string; // e.g. "https://scontent-arn2-1.cdninstagram.com/v/t51.2885-19/440120699_1623646108398510_1492426022346641251_n.jpg?stp=dst-jpg_s150x150_tt6&_nc_ht=scontent-arn2-1.cdninstagram.com&_nc_cat=106&_nc_oc=Q6cZ2AFQ2VLnky-HArBXs6EYGeAfRLIhEl2xn5Kem5YcF34fv6rAwkMKfKhuutjHlKddrZGN7U-F0F2hDtIyQT_rLCtW&_nc_ohc=7ruMqblg7YsQ7kNvgEZcjd9&_nc_gid=6959b6f072bf4155bf4b8cbd253cb5ba&edm=APQMUHMBAAAA&ccb=7-5&oh=00_AYCLtZAymhZ3mx-lQrqeqZTpk0JY-Mqnksix5IasqLRqBw&oe=67AE862F&_nc_sid=6ff7c8"
  is_verified: boolean; // e.g. false
  has_anonymous_profile_picture: boolean; // e.g. false
  account_badges: string[]; // e.g. []
  latest_reel_media: number; // e.g. 0
}

interface Followers {
  users: User[];
}

test.only("scrape users from account simpler", async ({ page }) => {
  test.setTimeout(0);

  await page.goto(`https://www.instagram.com/${accountToScrape}/`);

  let moreToLoad = true;
  const timeout = 10 * 3000;

  const maxIterations = 300;
  let iteration = 0;

  const users: User[] = [];
  let statuses: {
    [userId: string]: FriendshipStatus;
  } = {};

  while (moreToLoad && iteration < maxIterations) {
    iteration++;
    log("Starting iteration nr ", iteration);

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
    saveUsers(users);
    saveStatuses(statuses);
    log("saved");

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
const dateAndTime = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
const filePathBase = `../results/${accountToScrape}_${extractionType}_${dateAndTime}_`;

const saveUsers = async (users: User[]) => {
  const usersPath = path.resolve(__dirname, filePathBase + "users.json");
  const dirPath = path.dirname(usersPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
};

const saveStatuses = async (statuses: {
  [userId: string]: FriendshipStatus;
}) => {
  const statusesPath = path.resolve(__dirname, filePathBase + "statuses.json");
  const dirPath = path.dirname(statusesPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(statusesPath, JSON.stringify(statuses, null, 2));
};
//Saving stuff 👆
