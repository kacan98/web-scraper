import { db } from "db";
import { eq, sql } from "drizzle-orm";
import { errorLog, log } from "src/utils";
import {
  IGStatusesTableType,
  igUserStatusesTable,
} from "../../../db/schema/instagram/ig.schema";

export const insertStatuses = async (statuses: IGStatusesTableType[]) => {
  if (statuses.length === 0) {
    errorLog("No statuses to insert");
    return;
  }

  const updateFields = Object.keys(statuses[0]).filter((key) => key !== "id");

  const res = await db
    .insert(igUserStatusesTable)
    .values(statuses)
    .onConflictDoUpdate({
      target: igUserStatusesTable.id,
      set: Object.fromEntries(
        updateFields.map((field) => [
          field,
          sql`excluded.${sql.identifier(field)}`, // Properly escape column names
        ])
      ),
    })
    .execute();

  log("updated statuses", res.rowCount);

  return res.rowCount;
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

export const markAsNotworthFollowing = async (
  userId: string,
  username?: string | null
) => {
  await db
    .update(igUserStatusesTable)
    .set({
      notWorthFollowing: true,
    })
    .where(eq(igUserStatusesTable.id, userId))
    .execute();

  log("successfully marked", username, "as not worth following");
};
