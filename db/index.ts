import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import {
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_OUTPUT_PORT,
    POSTGRES_PASSWORD,
    POSTGRES_USER,
    POSTGRES_SSH_REQUIRED
} from "envVars";
import { igUserTable } from "./schema/instagram/ig-schema";

export const dbURL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}${POSTGRES_OUTPUT_PORT ? `:${POSTGRES_OUTPUT_PORT}` : ''}/${POSTGRES_DB}?sslmode={${POSTGRES_SSH_REQUIRED ? 'require' : 'disable'}}`;

console.log("Connecting to DB with URL:", dbURL);

export const db = drizzle(dbURL);

export const dbAvailable = async (): Promise<boolean> => {
    let success = false;

    try {
        await db.select({}).from(igUserTable).limit(1).execute();
        success = true;
    } catch (error) {
        console.error("Error connecting to the database:", error);
        success = false;
    }

    return success;
}