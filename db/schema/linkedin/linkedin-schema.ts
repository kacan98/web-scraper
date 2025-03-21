import {
  boolean,
  integer,
  pgSchema,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";

export const linkedinSchema = pgSchema("linkedin");

export const linkedInJobPostsTable = linkedinSchema.table("job_posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  company: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  jobDetails: text().notNull(),
  skills: text(),
  linkedinId: varchar({ length: 255 }).notNull().unique(),
});

export const linkedinJobSearch = linkedinSchema.table("job_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  job: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  date: timestamp().notNull(),
});

export const jobPostInSearch = linkedinSchema.table("job_post_in_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  jobSearchId: integer()
    .notNull()
    .references(() => linkedinJobSearch.id),
});

export const jobAIAnalysis = linkedinSchema.table("job_ai_analysis", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  yearsOfExperienceExpected: integer(),
  numberOfApplicants: integer(),
  seniorityLevel: varchar({ length: 255 }),
  decelopmentSide: varchar({ length: 255 }),
  companyIndustry: varchar({ length: 255 }),
  workModel: varchar({ length: 255 }),
  postLanguage: varchar({ length: 255 }).notNull(),
  salary: varchar({ length: 255 }),
  jobSummary: text()
});

export type LinkedinJobPost = typeof linkedInJobPostsTable.$inferInsert;
export type LinkedinJobSearch = typeof linkedinJobSearch.$inferInsert;
export type JobPostInSearch = typeof jobPostInSearch.$inferInsert;
export type JobAIAnalysis = typeof jobAIAnalysis.$inferInsert;
