import { db } from "db";
import { log } from "src/utils";
import { FollowingStatuses } from "automated/get_users.spec.ts/get_users.model";
import { igUserStatusesTable } from "./schema";
import { eq } from "drizzle-orm";

export const insertStatuses = async (
  statuses: FollowingStatuses["friendship_statuses"]
) => {
  if (statuses.friendship_statuses) {
    throw new Error(
      "This probably happens because you're sending the whole object instead of just the statuses"
    );
  }

  const statusesInsert: (typeof igUserStatusesTable.$inferInsert)[] =
    Object.entries(statuses).map(([userId, status]) => ({
      id: userId,
      ...status,
    }));

  const res = await db
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
  const res = await db
    .update(igUserStatusesTable)
    .set({
      following: following,
      // keep unchanged if setting to false
      i_followed_in_the_past: following ? true : undefined,
    })
    .where(eq(igUserStatusesTable.id, userId))
    .execute();
};
