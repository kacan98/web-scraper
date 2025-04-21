import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { igUserTable } from "./schema/instagram/ig-schema";

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const host = process.env.POSTGRES_HOST;
const port = process.env.POSTGRES_OUTPUT_PORT;
const database = process.env.POSTGRES_DB;

export const dbURL = `postgres://${user}:${password}@${host}:${port}/${database}`;

export const db = drizzle(dbURL);

export const dbAvailable = async (): Promise<boolean> => {
    let success = false;

    try {
        await db.select({}).from(igUserTable).limit(1).execute();
    } catch (error) {
        success = false;
        console.error("Error connecting to DB:", error);
    }

    return success;
}