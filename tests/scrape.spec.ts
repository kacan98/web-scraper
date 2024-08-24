import { ElementHandle, Page, test } from "@playwright/test";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

type User = {
  username: string;
  isFollowing?: boolean;
  link: string;
};

test.beforeAll(async () => {
  test.setTimeout(180000);
  await login();
});

test.beforeEach(async ({ page }) => {
  //set the cookies
  console.log(cookiesPath);
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);

  //navigate to instagram
  await page.goto("https://www.instagram.com/");
  await page.waitForTimeout(1000);

  //click Not Now button
  await page.click('text="Not Now"');
});

const extractionType: "followers" | "following" = "followers";
const account = process.env.IG_LOGIN;
if (!account) throw new Error("IG_LOGIN not set");

test("scrape users from account", async ({ page }) => {
  test.setTimeout(1000 * 60 * 30);
  // Wait for 1 second to ensure page content loads properly
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");
  const users = await getUsersFromAccount({
    page,
    type: extractionType,
    accountName: account,
    maxUsers: 10,
  });

  // Save the users to a file in the root/results directory
  const dateAndTime = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const usersPath = path.resolve(
    __dirname,
    `../results/${account}_${extractionType}_${dateAndTime}.json`
  );
  const dirPath = path.dirname(usersPath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
});

async function getUsersFromAccount({
  page,
  type,
  accountName,
  maxUsers = 1000,
}: {
  page: Page;
  accountName: string;
  type: "followers" | "following";
  maxUsers?: number;
}) {
  await page.goto(`https://www.instagram.com/${accountName}/`);

  //click on followers
  await page.click(`text="${type}"`);

  //Make sure we are on the correct page
  await page.waitForSelector('text="Followers"');
  await page.waitForSelector('text="Following"');

  //wait for the followers/following list to load
  await page.waitForTimeout(3000);

  let done = false;
  const users: User[] = [];

  //loop through all elements accessible with tab
  while (!done && users.length < maxUsers) {
    //if this is too fast (40ms), it might jump out of the modal :(
    await page.waitForTimeout(200);
    const focusedElement = await tabToNextElement(page);

    //the focused elements can be images and buttons. We don't want those
    const isImage = focusedElement?.stringifiedElement?.includes("<img ");
    const containsButtoneyText = [
      "Follow",
      "Following",
      "Requested",
      "Remove",
    ].some((text) => focusedElement?.stringifiedElement?.includes(text));
    const isButton = focusedElement?.stringifiedElement?.includes("button");

    if (isImage || isButton || containsButtoneyText) continue;

    //get the text content of the username
    const username = focusedElement.textContent;
    if (!username) continue;
    console.log("username found: ", username);

    //we have to make sure we don't get stuck in an infinite loop
    //check if the new username is the same as the first one
    const firstUsername = users[0]?.username;
    if (firstUsername === username) {
      console.log("We hit a username that is the same as the first one");
      //now we might have skipped to the top because of the infinite scroll
      const infiniteScroll = await page.$('[aria-label="Loading..."]');
      if (infiniteScroll) {
        console.log(
          "infinite scroll is present, we need to wait for it and continue"
        );
        //wait a bit
        await page.waitForTimeout(3000);
        //focus on the last captured element
        const lastUser = users[users.length - 1].username;
        await page.focus(`text="${lastUser}"`);
        console.log("jumping back to the last captured user:", lastUser);
        //continue the loop
        continue;
      }

      console.log(`All ${type} (${users.length}) users have been captured!`);
      done = true;
      continue;
    }

    if (username) {
      users.push({
        username,
        link: "",
      });
    }
  }
  return users;
}

const tabToNextElement = async (
  page: Page
): Promise<{
  stringifiedElement: string;
  textContent: string;
}> => {
  await page.keyboard.press("Tab");

  // Extract the currently focused element
  const res = await page.evaluate(() => {
    const focusedElement = document.activeElement;
    if (!focusedElement) throw new Error("No focused element found");
    return {
      stringifiedElement: focusedElement.outerHTML,
      textContent: focusedElement.textContent || "",
    };
  });
  if (!res) throw new Error("No focused element found");
  return res;
};
