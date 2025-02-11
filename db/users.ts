import { drizzleDb } from "db";
import { log } from "src/utils";
import { User } from "tests/scrape.model";
import { igUserTable } from "./schema";

export const insertUser = async (user: User) => {
  const userInsert: typeof igUserTable.$inferInsert = {
    ...user,
  };

  await drizzleDb.insert(igUserTable).values(userInsert).execute();
  log("inserted user", user.username);
};

export const insertUsers = async (users: User[]) => {
  await drizzleDb.transaction(async (tx) => {
    for (const user of users) {
      const userInsert: typeof igUserTable.$inferInsert = {
        ...user,
      };

      await tx.insert(igUserTable).values(userInsert).execute();
      log("inserted user", user.username);
    }
  });
};
