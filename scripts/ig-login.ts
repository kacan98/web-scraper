import fs from "fs";
import path, { dirname } from "path";
import { BrowserContext, chromium, Cookie, Page } from "playwright";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

export const login = async (): Promise<Cookie[]> => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const cookiesExist = fs.existsSync(cookiesPath);
  let cookies: Cookie[];
  if (!cookiesExist) {
    cookies = await logInManually({ page, context });

    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
  } else {
    cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
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

  // Wait for the user to log in manually
  await page.waitForSelector("nav"); // Assuming the navigation bar is present when logged in

  // Save cookies after successful login
  return await context.cookies();
};
