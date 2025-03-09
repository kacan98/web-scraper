import fs from "fs";
import path, { dirname } from "path";
import { BrowserContext, chromium, Cookie, Page } from "playwright";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const username = process.env.IG_LOGIN;
const password = process.env.IG_PASSWORD;
if (!username || !password)
  throw new Error("IG_USERNAME or IG_PASSWORD not set");

export type ScrapingPlatform = keyof typeof platformSpecifics;

const platformSpecifics = {
  instagram: {
    pathToCookies: "../instagram-cookies.json",
    loginUrl: "https://www.instagram.com",
    selectors: {
      afterNavigateButton: 'text="Allow all cookies"',
      username: 'input[name="username"]',
      password: 'input[name="password"]',
      afterLoginConfirm: "nav",
    },
  },
  linkedin: {
    pathToCookies: "../linkedin-cookies.json",
    loginUrl: "https://www.linkedin.com",
    selectors: {
      afterNavigateButton:
        "a[data-tracking-control-name='guest_homepage-basic_nav-header-signin']",
      username: 'input[id="username"]',
      password: 'input[id="password"]',
      afterLoginConfirm: 'strong:has-text("Start a post")',
    },
  },
};

export const getCookies = async ({
  platform,
}: {
  platform: ScrapingPlatform;
}): Promise<Cookie[]> => {
  let cookies: Cookie[] | undefined;

  const cookiesPath = path.resolve(
    __dirname,
    platformSpecifics[platform].pathToCookies
  );

  if (fs.existsSync(cookiesPath)) {
    cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  }

  if (!cookies || cookies.length < 4) {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    cookies = await logIntoInstagramManually({ page, context, platform });

    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    await browser.close();
  }

  //even if we don't need to log in, we still get some cookies
  if (cookies.length < 4) {
    throw new Error("Probably not logged in");
  }

  return cookies;
};

const logIntoInstagramManually = async ({
  page,
  context,
  platform,
}: {
  page: Page;
  context: BrowserContext;
  platform: ScrapingPlatform;
}): Promise<Cookie[]> => {
  const platformDetails = platformSpecifics[platform];
  //set longer timeout
  page.setDefaultTimeout(1000 * 60 * 5);

  await page.goto(platformDetails.loginUrl);

  console.log("Please log in manually...");

  const {
    username: usernameSelector,
    password: passwordSelector,
    afterLoginConfirm,
    afterNavigateButton,
  } = platformDetails.selectors;
  await page.click(afterNavigateButton);

  //fill in the username and password
  await page.fill(usernameSelector, username);
  await page.fill(passwordSelector, password);

  await page.click('button[type="submit"]');

  //wait for nav to appear
  await page.waitForSelector(afterLoginConfirm);

  const cookies = await context.cookies();

  return cookies;
};
