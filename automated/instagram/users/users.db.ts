import { db } from "db";
import { and, eq, isNull, or } from "drizzle-orm";
import { log } from "src/utils";
import { PartialExcept } from "src/utils.model";
import {
  igUserStatusesTable,
  igUserTable,
  IgUserTableType,
} from "../../../db/schema/instagram/ig.schema";

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

  log("updated users", res.rowCount);

  return res.rowCount;
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
        removeThoseThatAreNotWorthFollowing
          ? or(
              eq(igUserStatusesTable.notWorthFollowing, false),
              isNull(igUserStatusesTable.notWorthFollowing)
            )
          : undefined
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
