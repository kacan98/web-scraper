import { Page, test } from "@playwright/test";
import {
  areWeOnDoesntExistPage,
  logIntoInstagram,
} from "automated/instagram/instagram-utils";
import { getFollowedToday, incrementFollowedToday } from "db/followed_today";
import { getUsers, removeUser, updateUser } from "db/users";
import { markAsNotworthFollowing, setFollowing } from "db/userStatuses";
import dotenv from "dotenv";
import { errorLog, flipACoin, log, randomInt, sleepApprox } from "src/utils";

dotenv.config();

const MAX_USERS_TO_FOLLOW = 50;
const MIN_FOLLOWERS = 30;
const MIN_POSTS = 5;
const MIN_FOLLOWERS_TO_FOLLOWING_RATIO = 0.5;

const IMAGE_SELECTOR = "._aagw";

export const followInstagramUsers = async ({ page }: { page: Page }) => {
  await logIntoInstagram({ page });

  let followedTodaySoFar = (await getFollowedToday()) || 0;
  log("Followed today so far: ", followedTodaySoFar);

  if (followedTodaySoFar > MAX_USERS_TO_FOLLOW) {
    log("Already followed ", followedTodaySoFar, " users today. Skipping");
    return;
  }

  log(
    "I need to follow ",
    MAX_USERS_TO_FOLLOW - followedTodaySoFar,
    " more users today"
  );

  // errorLog(new Error("This is a test"));
  page.setDefaultTimeout(0);

  log("Getting users to follow...");
  const users = await getUsers({
    top: (MAX_USERS_TO_FOLLOW - followedTodaySoFar) * 3, // get more users than needed
  });
  log("Found ", users.length, " users!");

  for (const user of users) {
    if (followedTodaySoFar >= MAX_USERS_TO_FOLLOW) {
      log("Followed the max number of users today");
      break;
    }

    log("\n \nGoing to ", user.username);
    try {
      await page.goto(`https://www.instagram.com/${user.username}/`, {
        timeout: 15000,
      });
    } catch (e) {
      errorLog(e, "Failed to go to ", user.username);
      await markAsNotworthFollowing(user.id, user.username);
      continue;
    }

    log("Still need to follow ", MAX_USERS_TO_FOLLOW - followedTodaySoFar);

    await sleepApprox(page, 5000);

    const notFound = await areWeOnDoesntExistPage(page);
    if (notFound) {
      log("User not found");
      removeUser(user.id, user.username);
      continue;
    }

    log("Getting profile stats");
    const { followers, following, posts } = await getProfileStats(page);
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
      await markAsNotworthFollowing(user.id, user.username);
      continue;
    }

    let successfullyFollowed = false;

    try {
      await page.click("text=Follow", { timeout: 5000 });

      await sleepApprox(page, 3000);
      successfullyFollowed = true;
      followedTodaySoFar++;
    } catch (e) {
      log("Failed to follow", user.username);
    }

    if (successfullyFollowed) {
      log("Followed ", user.username);
      await setFollowing({
        userId: user.id,
        following: true,
      });
      await incrementFollowedToday();
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

  log("Done");
};

const getProfileStats = async (
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

    let text = "";
    try {
      text = await textLocator.innerText({ timeout: 10000 });
    } catch (e) {
      log("Failed to get text for", selector);
    }
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
    //make sure it fails when the profile is private
    await page.click(IMAGE_SELECTOR, { timeout: 8000 });
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
