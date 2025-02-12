// users are stored in a json file in root ./results folder

import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { insertUsers, insertUsersOneAtATime } from "../../db/users";
import { User } from "../../automated/get_users.spec.ts/get_users.model";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileName = "pysslamedviktoria_followers_2025-02-09T15-31-50_users.json";
const userResultsPath = path.resolve(__dirname, "../results/" + fileName);

const insertUsersFromResults = async () => {
  const users: User[] = JSON.parse(fs.readFileSync(userResultsPath, "utf8"));
  insertUsersOneAtATime(users);
};

const insertFirstUserFromResults = async () => {
  const users: User[] = JSON.parse(fs.readFileSync(userResultsPath, "utf8"));
  await insertUsers([users[0]]);
};

const resultsDir = process.env.RESULTS_DIR || "./results";
const fileNames = fs.readdirSync(resultsDir).filter((f) => f.endsWith("_users.json"));
console.log(fileNames);

const insertAllUsersFromResults = async () => {
  fileNames.forEach((fileName) => {
    const users: User[] = JSON.parse(
      fs.readFileSync(path.join(resultsDir, fileName), "utf8")
    );
    insertUsers(users);
  });
};