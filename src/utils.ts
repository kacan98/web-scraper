import { DEV_MODE } from "envVars";
import { processStarted } from "index";
import { Browser, Page } from "playwright"; // Imported Browser
import inquirer from 'inquirer';
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

export const openPage = async (): Promise<{ page: Page; browser: Browser }> => {
  const browser = await chromium.launch({ headless: !DEV_MODE });
  const page = await browser.newPage();
  return { page, browser };
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

export const removeNewLinesAndDoubleSpaces = (obj: { [key: string]: any }): void => {
  if (Array.isArray(obj)) {
    obj.forEach((element, index) => {
      if (typeof element === 'string') {
        obj[index] = element.replace(/\r?\n/g, '').replace(/\s{2,}/g, ' ');
      } else if (typeof element === 'object' && element !== null) {
        removeNewLinesAndDoubleSpaces(element);
      }
    });
  } else {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key].replace(/\r?\n/g, '').replace(/\s{2,}/g, ' ');
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        removeNewLinesAndDoubleSpaces(obj[key]);
      }
    });
  }
}

export async function getCliArgOrPrompt<T>(
  parsedArgs: any,
  argNameOrAlias: string,
  promptOptions: inquirer.QuestionCollection<{ [key: string]: T }>
): Promise<T> {
  if (parsedArgs[argNameOrAlias]) {
    return parsedArgs[argNameOrAlias];
  }

  // Ensure promptOptions.name is defined
  let questionName = '';
  if (typeof promptOptions === 'object' && !Array.isArray(promptOptions)) {
    questionName = promptOptions.name || 'prompt_choice';
    promptOptions.name = questionName;
  } else if (Array.isArray(promptOptions) && promptOptions.length > 0) {
    questionName = promptOptions[0].name || 'prompt_choice';
    promptOptions[0].name = questionName;
  } else {
    // This case should ideally not happen if promptOptions is well-defined
    questionName = 'prompt_choice';
    if (Array.isArray(promptOptions) && promptOptions.length === 0) {
      // Need to create a question if promptOptions is an empty array
      // For simplicity, using a generic text input. Adjust as needed.
      promptOptions.push({ type: 'input', name: questionName, message: `Enter value for ${argNameOrAlias}:` });
    } else if (typeof promptOptions === 'object' && !Array.isArray(promptOptions) && !promptOptions.name) {
      // if promptOptions is a single question object without a name
       promptOptions = { ...promptOptions, name: questionName, message: `Enter value for ${argNameOrAlias}:` }
    }
  }
  const answers = await inquirer.prompt(promptOptions);
  return answers[questionName];
}