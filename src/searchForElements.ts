import { ElementHandle, Locator, Page } from "playwright";

export const tryToFindElementFromSelectors = async (
  page: Page,
  selectors: string[]
): Promise<Locator | null> => {
  for (const s of selectors) {
    const element = page.locator(s);

    const nrOfelements = await element.count();
    if (nrOfelements > 1) {
      console.warn(`Found multiple (${nrOfelements}) for selector: ${s}`);
    }

    if (await element.first().isVisible()) {
      return element.first();
    }
  }
  return null;
};

// Overload signatures
export async function tryToFindElementsFromSelectors<
  T extends Record<string, string[]>
>(
  page: Page,
  selectors: T,
  allOrNothing: true
): Promise<{ [K in keyof T]: Locator } | undefined>;
export async function tryToFindElementsFromSelectors<
  T extends Record<string, string[]>
>(
  page: Page,
  selectors: T,
  allOrNothing?: false
): Promise<Partial<{ [K in keyof T]: Locator | undefined }>>;
export async function tryToFindElementsFromSelectors<
  T extends Record<string, string[]>
>(
  page: Page,
  selectors: T,
  allOrNothing = false
): Promise<Partial<{ [K in keyof T]: Locator | undefined }> | undefined> {
  const allOrNothingResults: Partial<{
    [K in keyof T]: Locator;
  }> = {};
  const potentiallyPartialResults: Partial<{
    [K in keyof T]: Locator | undefined;
  }> = {};

  for (const key in selectors) {
    const currentResult = await tryToFindElementFromSelectors(
      page,
      selectors[key]
    );
    potentiallyPartialResults[key] = currentResult || undefined;
    if (!currentResult) {
      console.error(`Could not find element for key: ${key}`);
      if (allOrNothing) {
        return undefined;
      }
    } else {
      allOrNothingResults[key] = currentResult;
    }
  }

  return allOrNothing ? allOrNothingResults : potentiallyPartialResults;
}

export async function extractText (
  locator?: Locator,
  errorWhenNotFound?: true 
): Promise<string>
export async function extractText (
  locator?: Locator,
  errorWhenNotFound?: false 
): Promise<string | undefined>
export async function extractText(
  locator?: Locator,
  errorWhenNotFound: boolean = true
): Promise<string | undefined> {
  if (!locator) {
    if (errorWhenNotFound) {
      throw new Error("Locator is not defined");
    }
    return undefined;
  }

  return await locator.textContent() ?? undefined;
};
