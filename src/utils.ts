import { chromium, Page } from "playwright";

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
  ignoreLog = false
) => {
  const randomFactor = Math.random() * 0.4 + 0.8;
  const timeToWait = ms * randomFactor;
  if (!ignoreLog && timeToWait > 2000)
    log(`Waiting for ${timeToWait / 1000} s`);
  await page.waitForTimeout(timeToWait);
};

export const waitForever = async () => {
  log("Waiting forever");
  return new Promise(() => {});
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
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  return page;
};

export const LOGGING_ENABLED = true;

export const log = (...args: any[]) => {
  if (LOGGING_ENABLED) {
    console.log(...args);
  }
};
