import { test } from "@playwright/test";
import dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { fileURLToPath } from "url";
import { getUsersFromAccount } from "../scripts/get-users-from-account";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

test.beforeAll(async () => {
  test.setTimeout(180000);
  await login();
});

test.beforeEach(async ({ page }) => {
  //set the cookies
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);

  //navigate to instagram
  await page.goto("https://www.instagram.com/");
  await page.waitForTimeout(1000);

  //click Not Now button
  await page.click('text="Not Now"');
});

const extractionType: "followers" | "following" = "followers";
// const account = process.env.IG_LOGIN;
const account = "thelazychefess";
if (!account) throw new Error("IG_LOGIN not set");

test("scrape users from account", async ({ page }) => {
  test.setTimeout(1000 * 60 * 30);
  // Wait for 1 second to ensure page content loads properly
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");
  const users = await getUsersFromAccount({
    page,
    type: extractionType,
    accountName: account,
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

// test("subscribe to users", async ({ page }) => {
//   await page.getByRole('link', { name: 'Search Search' }).click();
//   await page.getByPlaceholder('Search').click();
//   await page.getByPlaceholder('Search').fill('mat');
//   await page.getByRole('link', { name: 'goteborg.mat\'s profile picture goteborg.mat Mat i Göteborg • Followed by comfy.' }).click();
//   await page.getByRole('link', { name: 'followers' }).click();
//   await page.getByRole('dialog').first().click();
//   await page.getByRole('dialog').first().click();
//   await page.locator('div:nth-child(16) > div > div > .x1dm5mii > div').click();
//   await page.locator('div:nth-child(17) > div > div > .x1dm5mii > div').click();
//   await page.locator('div:nth-child(18) > div > div > .x1dm5mii > div').click();
//   await page.getByLabel('Loading...').click();
//   await page.locator('div:nth-child(117) > .x9f619').click();
//   await page.getByRole('link', { name: 'berntsson866\'s profile picture' }).first().click();
//   await page.getByRole('link', { name: 'followers' }).click();
//   await page.locator('.x1n2onr6 > div > div > .x1uvtmcs > div').click();
//   await page.getByRole('button', { name: 'Close' }).click();
//   await page.getByRole('link', { name: 'following' }).click();
//   await page.getByRole('progressbar').click();
//   await page.locator('.x1n2onr6 > div > div > .x1uvtmcs > div').click();
//   await page.getByRole('button', { name: 'Close' }).click();
//   await page.goto('https://www.instagram.com/goteborg.mat/followers/');
//   await page.getByRole('link', { name: 'followers' }).click();
// });
