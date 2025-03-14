import { ScrapingSource } from "model";
import { Page } from "playwright";
import { getCookies } from "src/instagram/ig-login";

export const login = async ({
  page,
  platform,
}: {
  page: Page;
  platform: ScrapingSource;
}) => {
  const cookies = await getCookies({ platform });
  await page.context().addCookies(cookies);
};

export const areWeOnDoesntExistPage = (page: Page): Promise<boolean> => {
  return page.isVisible("text=page isn't available.");
};
