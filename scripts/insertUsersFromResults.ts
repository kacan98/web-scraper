// users are stored in a json file in root ./results folder

import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { insertUsers } from "../db/users";
import { User } from "../tests/scrape.model";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileName = "pysslamedviktoria_followers_2025-02-09T15-31-50_users.json";
const resultsPath = path.resolve(__dirname, "../results/" + fileName);

const insertUsersFromResults = async () => {
  const users: User[] = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
  insertUsers(users);
};

insertUsersFromResults();