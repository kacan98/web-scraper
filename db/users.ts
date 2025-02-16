import { db } from "db";
import { SQL, eq, getTableColumns, sql, and, not } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { SQLiteTable } from "drizzle-orm/sqlite-core";
import { log } from "src/utils";
import { igUserStatusesTable, igUserTable, IgUserTableType } from "./schema";
import { PartialExcept } from "src/utils.model";

export const insertUser = async (user: IgUserTableType) => {
  const userInsert: typeof igUserTable.$inferInsert = {
    ...user,
  };

  await db.insert(igUserTable).values(userInsert).execute();
  log("inserted user", user.username);
};

export const insertUsersOneAtATime = async (users: IgUserTableType[]) => {
  await db.transaction(async (tx) => {
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

  const res = await db
    .insert(igUserTable)
    .values(usersInsert)
    .onConflictDoNothing();
  log("inserted users", res.rowCount);
};

export const getUsers = async ({
  onlyPublic = true,
  isFollowing = false,
  top,
  removeThoseThatAreNotWorthFollowing = true,
}: {
  onlyPublic?: boolean;
  isFollowing?: boolean;
  top?: number;
  removeThoseThatAreNotWorthFollowing?: boolean;
} = {}) => {
  const usernamesPromise = db
    .select({
      username: igUserTable.username,
      id: igUserTable.id,
    })
    .from(igUserTable)
    .leftJoin(igUserStatusesTable, eq(igUserTable.id, igUserStatusesTable.id))
    .where(
      and(
        onlyPublic ? eq(igUserStatusesTable.is_private, false) : undefined,
        eq(igUserStatusesTable.following, isFollowing),
        // removeThoseThatAreNotWorthFollowing
        //   ? not(eq(igUserStatusesTable.notWorthFollowing, true))
        //   : undefined
      )
    );

  if (top) {
    usernamesPromise.limit(top);
  }

  return await usernamesPromise.execute();
};

export const updateUser = async (
  user: PartialExcept<IgUserTableType, "id">
) => {
  await db
    .update(igUserTable)
    .set(user)
    .where(eq(igUserTable.id, user.id))
    .execute();
};

export const removeUser = async (id: string, user_name?: string | null) => {
  log(`removing user ${user_name || ""}`, id);
  await db.delete(igUserTable).where(eq(igUserTable.id, id)).execute();
};
