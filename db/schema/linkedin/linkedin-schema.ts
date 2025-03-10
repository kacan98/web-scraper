import { integer, pgSchema, text, varchar } from "drizzle-orm/pg-core";

export const linkedinSchema = pgSchema("linkedin");

export const jobPostsTable = linkedinSchema.table("job_posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  company: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  jobDetails: text().notNull(),
  skills: text().notNull(),
  linkedinId: varchar({ length: 255 }).notNull().unique()
});
