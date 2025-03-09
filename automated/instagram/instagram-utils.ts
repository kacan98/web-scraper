import { Page } from "playwright";
import { getInstagramCookies } from "automated/instagram/ig-login";

export const logIntoInstagram = async ({ page }: { page: Page }) => {
  const cookies = await getInstagramCookies();
  await page.context().addCookies(cookies);
};

export const areWeOnDoesntExistPage = (page: Page): Promise<boolean> => {
  return page.isVisible("text=page isn't available.");
};
