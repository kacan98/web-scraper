import { Page } from "playwright";

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

export function isValidUrl(url: string): boolean {
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
export const sleepApprox = async (page: Page, ms: number) => {
  const randomFactor = Math.random() * 0.4 + 0.8;
  await page.waitForTimeout(ms * randomFactor);
}