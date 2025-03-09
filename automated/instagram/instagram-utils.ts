import { Page } from "playwright";
import { getCookies, ScrapingPlatform } from "automated/instagram/ig-login";

export const login = async ({
  page,
  platform,
}: {
  page: Page;
  platform: ScrapingPlatform;
}) => {
  const cookies = await getCookies({ platform });
  await page.context().addCookies(cookies);
};

export const areWeOnDoesntExistPage = (page: Page): Promise<boolean> => {
  return page.isVisible("text=page isn't available.");
};
