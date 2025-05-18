import { DEV_MODE } from "envVars";
import { processStarted } from "index";
import { Page } from "playwright";
import { chromium } from "playwright-extra";
import extraPluginStealth from "puppeteer-extra-plugin-stealth";

const stealth = extraPluginStealth()

chromium.use(stealth);

export const tabToNextElement = async (
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

export const isValidUrl = (url: string): boolean => {
  const urlPattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
    "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|" + // domain name
    "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
    "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
    "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
    "(\\#[-a-z\\d_]*)?$",
    "i" // fragment locator
  );
  return !!urlPattern.test(url);
};

//waits for with a 20% margin of error
export const sleepApprox = async (
  page: Page,
  ms: number,
  ignoreLog = false,
  forWhat: string = "",
) => {
  const randomFactor = Math.random() * 0.4 + 0.8;
  const timeToWait = ms * randomFactor;
  if (!ignoreLog) {
    log(`Waiting ${(timeToWait / 1000).toFixed(2)}s${forWhat ? ' for ' + forWhat : ''}`);
  }
  await page.waitForTimeout(timeToWait);
};

export const waitForever = async () => {
  log("Waiting forever");
  return new Promise(() => { });
};

export const randomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1) + min);
};

export const flipACoin = (probabilityForSuccess: number = 0.5) => {
  if (probabilityForSuccess > 1 || probabilityForSuccess < 0)
    throw new Error("Probability must be between 0 and 1");
  return Math.random() < probabilityForSuccess;
};

export const openPage = async (): Promise<Page> => {
  const browser = await chromium.launch({ headless: !DEV_MODE });
  const page = await browser.newPage();
  return page;
};

export const LOGGING_ENABLED = true;

export const log = (...args: any[]) => {
  if (LOGGING_ENABLED) {
    console.log(...args);
  }
};

export function logProgress(
  current: number,
  total: number,
  chunkSize: number = 5,
  itemTypeLabel: string = 'items'
) {
  if (current % chunkSize === 0) {
    const progressBar = Array(20).fill(' ');
    const progress = Math.round((current / total) * 20);
    progressBar.fill('=', 0, progress);
    console.log(
      `[${progressBar.join('')}] ${Math.round(
        (current / total) * 100
      )}% (${current}/${total} ${itemTypeLabel})`
    );
  }
}

export const getElapsedTime = (since: Date = processStarted) => {
  const now = new Date(since);

  const elapsedTime = now.getTime() - processStarted.getTime();
  const seconds = Math.floor((elapsedTime / 1000) % 60);
  const minutes = Math.floor((elapsedTime / (1000 * 60)) % 60);
  const hours = Math.floor((elapsedTime / (1000 * 60 * 60)) % 24);
  const days = Math.floor(elapsedTime / (1000 * 60 * 60 * 24));

  let result = `Elapsed time: `;
  if (days > 0) result += `${days} days, `;
  if (hours > 0) result += `${hours} hours, `;
  if (minutes > 0) result += `${minutes} minutes, `;
  if (seconds > 0) result += `${seconds} seconds`;

  return result;
}