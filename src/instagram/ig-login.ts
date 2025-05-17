import fs from "fs";
import path, { dirname } from "path";
import { BrowserContext, chromium, Cookie, Page } from "playwright";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { ScrapingSource } from "model";
import { DEV_MODE } from "envVars";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IG_LOGIN = process.env.IG_LOGIN;
const IG_PASSWORD = process.env.IG_PASSWORD;

const LINKEDIN_LOGIN = process.env.LINKEDIN_LOGIN;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

const platformSpecifics = {
  [ScrapingSource.Instagram]: {
    pathToCookies: "../../instagram-cookies.json",
    loginUrl: "https://www.instagram.com",
    selectors: {
      afterNavigateButton: 'text="Allow all cookies"',
      username: 'input[name="username"]',
      password: 'input[name="password"]',
      afterLoginConfirm: "nav",
    },
    password: IG_PASSWORD,
    username: IG_LOGIN,
  },
  [ScrapingSource.LinkedIn]: {
    pathToCookies: "../../linkedin-cookies.json",
    loginUrl: "https://www.linkedin.com",
    selectors: {
      afterNavigateButton:
        "a[data-tracking-control-name='guest_homepage-basic_nav-header-signin']",
      username: 'input[id="username"]',
      password: 'input[id="password"]',
      afterLoginConfirm: 'strong:has-text("Start a post")',
    },
    password: LINKEDIN_PASSWORD,
    username: LINKEDIN_LOGIN,
  },
};

export const getCookies = async ({
  platform,
}: {
  platform: ScrapingSource;
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
    const browser = await chromium.launch({ headless: !DEV_MODE });
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
  platform: ScrapingSource;
}): Promise<Cookie[]> => {
  const platformDetails = platformSpecifics[platform];
  //set longer timeout
  page.setDefaultTimeout(1000 * 60 * 5);

  await page.goto(platformDetails.loginUrl);

  console.log("Trying to log in manually...");

  const {
    username: usernameSelector,
    password: passwordSelector,
    afterLoginConfirm,
    afterNavigateButton,
  } = platformDetails.selectors;
  await page.click(afterNavigateButton);

  if (!platformDetails.username || !platformDetails.password) {
    throw new Error("Username or password not set");
  }

  //fill in the username and password
  await page.fill(usernameSelector, platformDetails.username);
  await page.fill(passwordSelector, platformDetails.password);

  await page.click('button[type="submit"]');

  //wait for nav to appear
  await page.waitForSelector(afterLoginConfirm);

  const cookies = await context.cookies();

  return cookies;
};
