import { test } from "@playwright/test";
import { getUsers as getUsers } from "db/users";
import { setFollowing } from "db/userStatuses";
import dotenv from "dotenv";
import fs from "fs";
import path, { dirname } from "path";
import { login } from "scripts/ig-login";
import { log, sleepApprox } from "src/utils";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MAX_USERS_TO_FOLLOW = 50;

const cookiesPath = path.join("cookies.json");
console.log(cookiesPath);

test.beforeAll(async () => {
  if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

  await login();
});

test.beforeEach(async ({ page }) => {
  const cookies = JSON.parse(fs.readFileSync(cookiesPath, "utf8"));
  await page.context().addCookies(cookies);
});

test.only("follow or unfollow", async ({ page }) => {
    test.setTimeout(0);

    const users = await getUsers();

    for (const user of users.slice(0, MAX_USERS_TO_FOLLOW)) {
      await page.goto(`https://www.instagram.com/${user.username}/`);

      await sleepApprox(page, 5000);

      let success = false;

      try{
        await page.click("text=Follow", { timeout: 5000 });

        await page.waitForSelector("text=Following", { timeout: 20000 });
        success = true;
      } catch (e) {
        log("Failed to follow", user.username);
      }

      if (success || (await page.waitForSelector("text=Following"))) {
        log("Followed ", user.username);
        await setFollowing({
          userId: user.id,
          following: true,
        });
      }

      //wait for 10 seconds
      await sleepApprox(page, 3000);
    }
});
