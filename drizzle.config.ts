import { dbURL } from "db";
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema/**/*.ts",
  dialect: "postgresql",
  schemaFilter: ["instagram", "linkedin", "jobs"],
  dbCredentials: {
    url: dbURL,
    port: +process.env.POSTGRES_OUTPUT_PORT!,
  },
});
