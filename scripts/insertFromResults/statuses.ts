import fs from "fs";
import path from "path";
import { insertStatuses } from "../../db/userStatuses";
import { FollowingStatuses } from "../../automated/get_users.spec.ts/get_users.model";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const statusesFileName =
  "pysslamedviktoria_followers_2025-02-09T15-31-50_statuses.json";

const resultsDir = process.env.RESULTS_DIR || "./results";
const userStatusesPath = path.join(resultsDir, statusesFileName);

const insertStatusesFromResults = async () => {
  const statuses: FollowingStatuses["friendship_statuses"] = JSON.parse(
    fs.readFileSync(userStatusesPath, "utf8")
  );

  insertStatuses(statuses);
};

const fileNames = fs
  .readdirSync(resultsDir)
  .filter((f) => f.endsWith("_statuses.json"));

const insertAllStatusesFromResults = async () => {
  fileNames.forEach((fileName) => {
    const statuses: FollowingStatuses["friendship_statuses"] = JSON.parse(
      fs.readFileSync(path.join(resultsDir, fileName), "utf8")
    );

    insertStatuses(statuses);
  });
};