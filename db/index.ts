import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

const user = process.env.POSTGRES_USER;
const password = process.env.POSTGRES_PASSWORD;
const host = process.env.POSTGRES_HOST;
const port = process.env.POSTGRES_OUTPUT_PORT;
const database = process.env.POSTGRES_DB;

export const dbURL = `postgres://${user}:${password}@${host}:${port}/${database}`;

const db = drizzle(dbURL);
