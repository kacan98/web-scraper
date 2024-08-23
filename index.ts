import { chromium } from "playwright";

async function main() {
    console.log('Hello World');
  // Launch a new instance of a Chromium browser with headless mode
  // disabled for visibility
  const browser = await chromium.launch({
    headless: false,
  });

  // Create a new Playwright context to isolate browsing session
  const context = await browser.newContext();
  // Open a new page/tab within the context
  const page = await context.newPage();

  // Navigate to the GitHub topics homepage
  await page.goto("https://www.instagram.com/");

  // Wait for 1 second to ensure page content loads properly
  await page.waitForTimeout(1000);

  // Close the browser instance after task completion
  await browser.close();
}

// Execute the main function
main();
