import { drizzleDb } from "db";
import { SQL, eq, getTableColumns, sql, and } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { log } from "src/utils";
import { igUserStatusesTable, igUserTable, IgUserTableType } from './schema';
import { PartialExcept } from "src/utils.model";

export const insertUser = async (user: IgUserTableType) => {
  const userInsert: typeof igUserTable.$inferInsert = {
    ...user,
  };

  await drizzleDb.insert(igUserTable).values(userInsert).execute();
  log("inserted user", user.username);
};

export const insertUsersOneAtATime = async (users: IgUserTableType[]) => {
  await drizzleDb.transaction(async (tx) => {
    for (const user of users) {
      const userInsert: typeof igUserTable.$inferInsert = {
        ...user,
      };

      await tx.insert(igUserTable).values(userInsert).onConflictDoUpdate({
        target: igUserTable.id,
        set: userInsert,
      });

      log("inserted user", user.username);
    }
  });
};

export const insertUsers = async (users: IgUserTableType[]) => {
  const usersInsert: (typeof igUserTable.$inferInsert)[] = users.map(
    (user) => ({
      ...user,
    })
  );

  const res = await drizzleDb
    .insert(igUserTable)
    .values(usersInsert)
    .onConflictDoNothing();
  log("inserted users", res.rowCount);
};

export const getUsers = async (onlyPublic = true, isFollowing = false) => {
  const usernames = await drizzleDb
    .select({
      username: igUserTable.username,
      id: igUserTable.id,
    })
    .from(igUserTable)
    .leftJoin(igUserStatusesTable, eq(igUserTable.id, igUserStatusesTable.id))
    .where(
      and(
        onlyPublic ? eq(igUserStatusesTable.is_private, false) : undefined,
        eq(igUserStatusesTable.following, isFollowing)
      )
    )
    .execute();

  return usernames;
};

export const updateUser = async (user: PartialExcept<IgUserTableType, "id">) => {
  await drizzleDb
    .update(igUserTable)
    .set(user)
    .where(eq(igUserTable.id, user.id))
    .execute();
};

export const removeUser = async (id: string, user_name?: string | null) => {
  log(`removing user ${user_name || ""}`, id);
  await drizzleDb.delete(igUserTable).where(eq(igUserTable.id, id)).execute();
};