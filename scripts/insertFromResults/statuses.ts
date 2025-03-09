import fs from "fs";
import path from "path";
import { insertStatuses } from "../../automated/instagram/users/userStatuses.db";
import { IGStatuses } from "../../automated/instagram/users/get_users.model";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { IGStatusesTableType } from "db/schema";

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
  const statuses: IGStatuses["friendship_statuses"] = JSON.parse(
    fs.readFileSync(userStatusesPath, "utf8")
  );

  insertStatuses(getInsertableStatuses(statuses));
};

const getInsertableStatuses = (
  igStatuses: IGStatuses["friendship_statuses"]
): IGStatusesTableType[] => {
  return Object.entries(igStatuses).map(([userId, status]) => ({
    id: userId,
    ...status,
  }));
};

const fileNames = fs
  .readdirSync(resultsDir)
  .filter((f) => f.endsWith("_statuses.json"));

const insertAllStatusesFromResults = async () => {
  fileNames.forEach((fileName) => {
    const statuses: IGStatuses["friendship_statuses"] = JSON.parse(
      fs.readFileSync(path.join(resultsDir, fileName), "utf8")
    );

    insertStatuses(getInsertableStatuses(statuses));
  });
};
