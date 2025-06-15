import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import {
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_OUTPUT_PORT,
    POSTGRES_PASSWORD,
    POSTGRES_SSH_REQUIRED,
    POSTGRES_USER
} from "envVars";
import pg from "pg";
import { igUserTable } from "./schema/instagram/ig-schema";
const { Pool } = pg;

export const dbURL = `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}${POSTGRES_OUTPUT_PORT ? `:${POSTGRES_OUTPUT_PORT}` : ''}/${POSTGRES_DB}?sslmode=${POSTGRES_SSH_REQUIRED ? 'require' : 'disable'}`;

// Create a connection pool with limited connections to reduce database load
const pool = new Pool({
    connectionString: dbURL,
    max: 3, // Limit to 3 concurrent connections max
    min: 1, // Keep at least 1 connection open
    idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
    connectionTimeoutMillis: 10000, // Timeout connections after 10 seconds
});

export const db = drizzle(pool);

// Add cleanup function for database connections
export const closeDatabase = async () => {
    try {
        await pool.end();
        console.log('🔌 Database connections closed');
    } catch (error) {
        console.log('⚠️ Error closing database connections:', error);
    }
};

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

// Add a function to close the database connection pool when needed
export const closeDbConnection = async (): Promise<void> => {
    try {
        await pool.end();
        console.log("Database connection pool closed");
    } catch (error) {
        console.error("Error closing database connection:", error);
    }
};

// Add a function to get current pool stats
export const getDbConnectionStats = (): { totalCount: number, idleCount: number, waitingCount: number } => {
    return {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
    };
};