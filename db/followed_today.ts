import { db } from "db"
import { numberFollowedTodayTable } from "./schema"
import { eq, sql,and } from "drizzle-orm"

const today = new Date().toISOString().split("T")[0]

export const incrementFollowedToday = async () => {
    await db
    .insert(numberFollowedTodayTable)
    .values({
        id: today,
        number: 1,
        me: process.env.IG_LOGIN
    })
    .onConflictDoUpdate({
        target: numberFollowedTodayTable.id,
        set: {
            number: sql`${numberFollowedTodayTable.number} + 1`
        }
    })
}

export const getFollowedToday = async () => {
    if (!process.env.IG_LOGIN) throw new Error("IG_LOGIN not set");

    const nr = await db
    .select({
        nr: numberFollowedTodayTable.number
    })
    .from(numberFollowedTodayTable)
    .where(and(
        eq(numberFollowedTodayTable.id, today),
        eq(numberFollowedTodayTable.me, process.env.IG_LOGIN),
    ))

    return nr[0]?.nr
}