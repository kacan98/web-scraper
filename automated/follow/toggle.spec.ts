import { Page, test } from "@playwright/test";
import { getUsers, updateUser, removeUser } from "db/users";
import { setFollowing } from "db/userStatuses";
import dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { errorLog, flipACoin, log, randomInt, sleepApprox } from "src/utils";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);

const MAX_USERS_TO_FOLLOW = 50;
const MIN_FOLLOWERS = 30;
const MIN_POSTS = 5;
const MIN_FOLLOWERS_TO_FOLLOWING_RATIO = 0.5;

const IMAGE_SELECTOR = "._aagw";

const cookiesPath = path.join("cookies.json");

test.beforeAll(async () => {
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

  await login();
});

test.beforeEach(async ({ page }) => {
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);
});

test.only("follow or unfollow", async ({ page }) => {
  // errorLog(new Error("This is a test"));
  test.setTimeout(0);

  log("Getting users to follow...");
  const users = await getUsers();
  log("Found ", users.length, " users!");
  log("Starting to follow...");

  for (const user of users.slice(0, MAX_USERS_TO_FOLLOW)) {
    log("\n \n Going to ", user.username);
    try {
      await page.goto(`https://www.instagram.com/${user.username}/`, {
        timeout: 5000,
      });
    } catch (e) {
      errorLog(e, "Failed to go to ", user.username);
      continue;
    }

    await sleepApprox(page, 5000);

    //"this page isn't available" will display if the user is not found
    const notFound = await page.isVisible("text=This page isn't available.");
    if (notFound) {
      log("User not found");
      removeUser(user.id, user.username);
      continue;
    }

    log("Getting stats");
    const { followers, following, posts } = await getStats(page);
    await updateUser({
      id: user.id,
      followers,
      following,
      posts,
    });
    log("Stats for ", user.username, " are: ", { followers, following, posts });

    let followable =
      followers && followers > MIN_FOLLOWERS && posts && posts > MIN_POSTS;

    if (followable && following && followers) {
      const ratio = following / followers;
      //if they are not following anyone, don't follow them
      if (ratio < MIN_FOLLOWERS_TO_FOLLOWING_RATIO) {
        followable = false;
      }
    }

    if (!followable) {
      log("Not following ", user.username);
      await removeUser(user.id, user.username);
      continue;
    }

    let successfullyFollowed = false;

    try {
      await page.click("text=Follow", { timeout: 5000 });

      await sleepApprox(page, 3000);
      successfullyFollowed = true;
    } catch (e) {
      log("Failed to follow", user.username);
    }

    if (successfullyFollowed) {
      log("Followed ", user.username);
      await setFollowing({
        userId: user.id,
        following: true,
      });
    }

    try {
      await likeSomePosts(page, {
        min: 2,
        max: 6,
        totalNrPosts: posts || 0,
      });
    } catch (e) {
      errorLog(e, "⚠ Failed to like posts for user ", user.username);
    }

    await sleepApprox(page, 3000);
  }
});

const getStats = async (
  page: Page
): Promise<{
  followers?: number;
  following?: number;
  posts?: number;
}> => {
  //get element that says "123 followers"
  const getNumber = async (
    selector: "followers" | "following" | "posts"
  ): Promise<number | undefined> => {
    //regex for some number + selector
    const regEx = new RegExp(
      `(\\d{1,3}(,\\d{3})*|\\d+(\\.\\d+)?[KM])\\s*${selector}`,
      "i"
    );
    const textLocator = page.getByText(regEx);

    const text = await textLocator.innerText({ timeout: 4000 });

    // Replace K with 000 and M with 000000
    const numberText = text
      .replace(/,/g, "")
      .replace("K", "000")
      .replace("M", "000000");

    // Just get the number
    const number = numberText.match(/\d+/);
    return number ? parseInt(number[0]) : undefined;
  };

  const followers = await getNumber("followers");
  const following = await getNumber("following");
  const posts = await getNumber("posts");

  return { followers, following, posts };
};

const likeSomePosts = async (
  page: Page,
  {
    min = 1,
    max = 10,
    totalNrPosts,
  }: { min?: number; max?: number; totalNrPosts: number }
) => {
  if (max > totalNrPosts) {
    max = totalNrPosts;
  }

  if (min > max) {
    return;
  }

  //make sure we are on a profile page - `https://www.instagram.com/${user.username}/
  const regEx = /https:\/\/www.instagram.com\/(.*)\//;
  if (!regEx.test(page.url())) {
    throw new Error("Not on a profile page");
  }

  //click the first image
  try {
    await page.click(IMAGE_SELECTOR);
  } catch (e) {
    errorLog(
      "Failed to click image - This is probably because the image selector is not working anymore. Should be the first image so that we open the modal"
    );
    return;
  }

  const nrPostsToLike = randomInt(min, max);

  if (nrPostsToLike < 1) return;

  const postsToLike: boolean[] = Array.from({ length: nrPostsToLike }, () =>
    flipACoin(0.7)
  );

  log(
    "I will go through ",
    nrPostsToLike,
    " posts and like ",
    postsToLike.reduce((acc, curr) => acc + (curr ? 1 : 0), 0),
    " of them."
  );

  for (const like of postsToLike) {
    log(`${like ? "Liking" : "Not liking"} this post`);
    await sleepApprox(page, randomInt(1000, 2000), true);

    if (like) {
      //double click the image to like it
      await page.mouse.dblclick(430, 260);
    }

    await sleepApprox(page, randomInt(500, 1200));
    //press the right arrow key to go to the next image
    page.keyboard.press("ArrowRight");
  }
};
