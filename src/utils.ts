import fs from "fs";
import path, { dirname } from "path";
import { Page } from "playwright";
import { fileURLToPath } from "url";

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
}

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

const LOGGING_ENABLED = true;

export const log = (...args: any[]) => {
  if (LOGGING_ENABLED) {
    console.log(...args);
  }
};

export const getFilenameFriendlyDateTime = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-based
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  const formatted = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  return formatted;
};

const errors: any[] = [];
const dateAndTime = getFilenameFriendlyDateTime();
const errorFileName = `errors`;
export const errorLog = (...args: any[]) => {
  if (LOGGING_ENABLED) {
    console.error(...args);
  }
  errors.push(args.toString());
  saveInFile("errors", errorFileName, "json", errors);
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentFilenameFriendlyDateTime = getFilenameFriendlyDateTime();
export const saveInFile = async (
  pathFromRoot: string,
  fileName: string,
  fileExtension: string,
  data: any,
  addDateToFileName = true
) => {
  let completeFileName = "";
  if (addDateToFileName) {
    completeFileName += `${currentFilenameFriendlyDateTime}_`;
  }
  completeFileName += fileName;
  completeFileName += `.${fileExtension}`;
  // so this function has to be in a folder that is one folder deep in the root...
  // that's why we need the "../" in the path.resolve
  // I don't know how to make it more resilient.
  // It sucks and I hate it but I don't have more patience to deal with this.
  const filePath = path.resolve(
    __dirname,
    "../",
    pathFromRoot,
    completeFileName
  );
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
};
