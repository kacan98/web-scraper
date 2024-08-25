import { Page } from "playwright";
import { isValidUrl, tabToNextElement } from "./utils";

export type User = {
  username: string;
  isFollowing?: boolean;
  link: string;
};

export async function getUsersFromAccount({
  page,
  type,
  accountName,
  maxUsers,
}: {
  page: Page;
  accountName: string;
  type: "followers" | "following";
  maxUsers?: number;
}) {
  await page.goto(`https://www.instagram.com/${accountName}/`);

  //click on followers
  await page.click(`text="${type}"`);

  //Make sure we are on the correct page
  await page.waitForSelector('text="Followers"');
  await page.waitForSelector('text="Following"');

  //wait for the followers/following list to load
  await page.waitForTimeout(3000);

  let done = false;
  const users: User[] = [];

  //loop through all elements accessible with tab
  while (!done && (!maxUsers || (maxUsers && users.length < maxUsers))) {
    //if this is too fast (40ms), it might jump out of the modal :(
    await page.waitForTimeout(200);
    const focusedElement = await tabToNextElement(page);

    if (!focusedElement) {
      //we need to focus the last valid username
      const lastUser = users[users.length - 1].username;
      await page.focus(`text="${lastUser}"`);
      console.log("jumping back to the last captured user:", lastUser);
      continue;
    }

    //the focused elements can be images and buttons. We don't want those
    const isImage = focusedElement?.stringifiedElement?.includes("<img ");
    const containsButtoneyText = [
      "Follow",
      "Following",
      "Requested",
      "Remove",
    ].some((text) => focusedElement?.stringifiedElement?.includes(text));
    const isButton = focusedElement?.stringifiedElement?.includes("button");

    if (isImage || isButton || containsButtoneyText) continue;

    //get the text content of the username
    const username = focusedElement.textContent;

    const dialog = page.getByRole("dialog").first();
    const usernameText = page.locator(`text="${username}"`);
    //check that the username is in the dialog
    if (dialog && !dialog.filter({ has: usernameText })) {
      console.warn("username not in dialog");
      //we have to focus back on the last captured user
      const lastUser = users[users.length - 1].username;
      await page.focus(`text="${lastUser}"`);
      console.log("jumping back to the last captured user:", lastUser);

      continue;
    }

    if (!username) continue;
    console.log("username found: ", username);

    //we have to make sure we don't get stuck in an infinite loop
    //check if the new username is the same as the first one
    const firstUsername = users[0]?.username;
    if (firstUsername === username) {
      console.log("We hit a username that is the same as the first one");
      //now we might have skipped to the top because of the infinite scroll
      const infiniteScroll = await page.$('[aria-label="Loading..."]');
      if (infiniteScroll) {
        console.log(
          "infinite scroll is present, we need to wait for it and continue"
        );
        //wait a bit
        await page.waitForTimeout(3000);
        //focus on the last captured element
        const lastUser = users[users.length - 1].username;
        await page.focus(`text="${lastUser}"`);
        console.log("jumping back to the last captured user:", lastUser);
        //continue the loop
        continue;
      }

      console.log(`All ${type} (${users.length}) users have been captured!`);
      done = true;
      continue;
    }

    if (username) {
      const link = "https://www.instagram.com/" + username;
      if (isValidUrl(link)) {
        users.push({
          username,
          link,
        });
      } else {
        console.error("Invalid URL: ", link);
      }
    }
  }
  return users;
}
