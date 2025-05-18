import dotenv from "dotenv";
import { DEV_MODE } from "envVars";
import fs from "fs";
import inquirer from "inquirer";
import { ScrapingSource } from "model";
import path, { dirname } from "path";
import { BrowserContext, chromium, Cookie, Page } from "playwright";
import { findFunctioningSelector } from "src/searchForElements";
import { log } from "src/utils";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const IG_LOGIN = process.env.IG_LOGIN;
const IG_PASSWORD = process.env.IG_PASSWORD;

const LINKEDIN_LOGIN = process.env.LINKEDIN_LOGIN;
const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;

const platformSpecifics: {
  [key in ScrapingSource]: {
    pathToCookies: string;
    loginUrl: string;
    selectors: {
      username: string;
      password: string;
      afterLoginConfirm: string;
      afterNavigateButton?: string;
    };
    username?: string;
    password?: string;
  };
} = {
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
    loginUrl: "https://www.linkedin.com/login",
    selectors: {
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
    console.log("Cookies file found, loading cookies...");
    cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  }


  if (!cookies || cookies.length < 4) {
    const browser = await chromium.launch({ headless: !DEV_MODE });
    const context = await browser.newContext();
    const page = await context.newPage();

    cookies = await logInManually({ page, context, platform });

    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    await browser.close();
  }

  //even if we don't need to log in, we still get some cookies
  if (cookies.length < 4) {
    throw new Error("Probably not logged in");
  }

  return cookies;
};

const logInManually = async ({
  page,
  context,
  platform,
}: {
  page: Page;
  context: BrowserContext;
  platform: ScrapingSource;
}): Promise<Cookie[]> => {
  console.log("Trying to log in manually...");
  const platformDetails = platformSpecifics[platform];
  //set longer timeout
  page.setDefaultTimeout(1000 * 60 * 5);

  log(`Navigating to ${platformDetails.loginUrl}`);
  await page.goto(platformDetails.loginUrl, {
    timeout: 10 * 1000,
  });

  const {
    username: usernameSelector,
    password: passwordSelector,
    afterLoginConfirm,
    afterNavigateButton,
  } = platformDetails.selectors;
  if (afterNavigateButton) {
    await page.click(afterNavigateButton, {
      timeout: 20 * 1000,
    });
  }

  if (!platformDetails.username || !platformDetails.password) {
    throw new Error("Username or password not set");
  }

  log('Filling in username and password');
  //fill in the username and password
  await page.fill(usernameSelector, platformDetails.username);
  await page.fill(passwordSelector, platformDetails.password);

  log('Clicking login button');
  await page.click('button[type="submit"]');

  //ask for input by inquirer and then press them as keys
  const { securityCode } = await inquirer.prompt({
    type: "input",
    name: "securityCode",
    message: "Enter the security code sent to your email:",
  });

  if (securityCode) {
    //type the security code
    const res = await findFunctioningSelector(
      page,
      [
        'input[name="pin"]',
        '#input__email_verification_pin',
        'input[aria-label="Verification code"]',
        'input[placeholder="Enter code"]'
      ]
    )

    if (!res) {
      throw new Error("No security code input found");
    }

    try {
      await page.fill(res, securityCode, {
        timeout: 10 * 1000,
      });
    } catch (e) {
      console.log("Error filling in security code, trying another selector");
      //log the whole html structure of the page
      console.log(await page.content());
      page.getByPlaceholder('Enter code').fill(securityCode, {
        timeout: 10 * 1000,
      });
    }

    await page.click('button[type="submit"]');
  }

  //wait for nav to appear
  await page.waitForSelector(afterLoginConfirm);

  const cookies = await context.cookies();

  return cookies;
};
