import { drizzleDb } from "db";
import { log } from "src/utils";
import { FollowingStatuses } from "tests/scrape.model";
import { igUserStatusesTable } from "./schema";

export const insertStatuses = async (statuses: FollowingStatuses) => {
    const statusesInsert: (typeof igUserStatusesTable.$inferInsert)[] = Object.entries(
        statuses
    ).map(([userId, status]) => ({ id: userId, ...status }));
    
    const res = await drizzleDb.insert(igUserStatusesTable).values(statusesInsert).onConflictDoNothing().execute();
    log("inserted statuses", res.rowCount);
}