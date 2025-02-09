import fs from "fs";
import path, { dirname } from "path";
import { BrowserContext, chromium, Cookie, Page } from "playwright";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

const username = process.env.IG_LOGIN;
const password = process.env.IG_PASSWORD;
if (!username || !password)
  throw new Error("IG_USERNAME or IG_PASSWORD not set");

export const login = async (): Promise<Cookie[]> => {
  let cookies: Cookie[] = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  if (!cookies || cookies.length < 4) {
    const browser = await chromium.launch({ headless: false,  });
    const context = await browser.newContext();
    const page = await context.newPage();

    cookies = await logInManually({ page, context });

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
}: {
  page: Page;
  context: BrowserContext;
}): Promise<Cookie[]> => {
  await page.goto("https://www.instagram.com");

  console.log("Please log in manually...");
  await page.click('text="Allow all cookies"');

  //fill in the username and password
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  await page.click('button[type="submit"]');

  //wait for nav to appear
  await page.waitForSelector("nav");

  const cookies = await context.cookies();

  return cookies;
};
