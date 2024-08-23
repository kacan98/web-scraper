import { test } from "@playwright/test";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cookiesPath = path.resolve(__dirname, "../cookies.json");

test.beforeAll(async () => {
  test.setTimeout(180000);
  await login();
});

test.beforeEach(async ({ page }) => {
  //set the cookies
  console.log(cookiesPath);
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);
});

// test('has title', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Expect a title "to contain" a substring.
//   await expect(page).toHaveTitle(/Playwright/);
// });

// test('get started link', async ({ page }) => {
//   await page.goto('https://playwright.dev/');

//   // Click the get started link.
//   await page.getByRole('link', { name: 'Get started' }).click();

//   // Expects page to have a heading with the name of Installation.
//   await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
// });

test("open ig", async ({ page }) => {
  await page.goto("https://www.instagram.com/");

  // Wait for 1 second to ensure page content loads properly

  //do not close the browser
  await new Promise(() => {});
});
