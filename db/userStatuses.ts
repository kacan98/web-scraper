import { drizzleDb } from "db";
import { log } from "src/utils";
import { FollowingStatuses } from "automated/get_users.spec.ts/get_users.model";
import { igUserStatusesTable } from "./schema";
import { eq } from "drizzle-orm";

export const insertStatuses = async (statuses: FollowingStatuses) => {
  const statusesInsert: (typeof igUserStatusesTable.$inferInsert)[] =
    Object.entries(statuses).map(([userId, status]) => ({
      id: userId,
      ...status,
    }));

  const res = await drizzleDb
    .insert(igUserStatusesTable)
    .values(statusesInsert)
    .onConflictDoNothing()
    .execute();
  log("inserted statuses", res.rowCount);
};

export const setFollowing = async ({
  userId,
  following,
}: {
  userId: string;
  following: boolean;
}) => {
  const res = await drizzleDb
    .update(igUserStatusesTable)
    .set({
      following: following,
      // keep unchanged if setting to false
      i_followed_in_the_past: following ? true : undefined,
    })
    .where(eq(igUserStatusesTable.id, userId))
    .execute();
};