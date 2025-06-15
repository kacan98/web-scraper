import { eq } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgSchema,
  text,
  timestamp,
  unique,
  varchar
} from "drizzle-orm/pg-core";

export const jobSchema = pgSchema("jobs");

// Job sources enum to track where jobs come from
export const jobSourcesTable = jobSchema.table("job_sources", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 100 }).notNull().unique(), // "linkedin", "jobindex", etc.
  baseUrl: varchar({ length: 255 }).notNull(),
  description: text(),
  isActive: boolean().notNull().default(true),
  createdAt: timestamp().notNull().defaultNow(),
});

// Generic job posts table that can handle jobs from any source
export const jobPostsTable = jobSchema.table("job_posts", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: varchar({ length: 255 }).notNull(),
  company: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  jobDetails: text().notNull(),
  skills: text(),
  externalId: varchar({ length: 255 }).notNull(), // linkedin ID, jobindex ID, etc.
  sourceId: integer()
    .notNull()
    .references(() => jobSourcesTable.id),
  originalUrl: varchar({ length: 500 }), // Direct URL to the job posting
  dateScraped: timestamp().notNull().defaultNow(),
}, (table) => ({
  // Unique constraint on externalId + sourceId combination
  uniqueExternalIdPerSource: unique().on(table.externalId, table.sourceId),
}));

// Job searches table - now generic for all sources
export const jobSearchTable = jobSchema.table("job_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sourceId: integer()
    .notNull()
    .references(() => jobSourcesTable.id),
  keywords: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  maxAgeSeconds: integer(), // For filtering by posting date
  searchDate: timestamp().notNull().defaultNow(),
});

// Many-to-many relationship between job posts and searches
export const jobPostInSearchTable = jobSchema.table("job_post_in_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => jobPostsTable.id),
  jobSearchId: integer()
    .notNull()
    .references(() => jobSearchTable.id),
});

// AI analysis table - generic for all job sources
export const jobAiAnalysisTable = jobSchema.table("job_ai_analysis", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => jobPostsTable.id),
  yearsOfExperienceExpected: integer(),
  numberOfApplicants: integer(),
  seniorityLevel: varchar({ length: 255 }), // "junior", "mid", "senior", "lead"
  developmentSide: varchar({ length: 255 }), // 'front-end', 'back-end', 'full-stack'
  companyIndustry: varchar({ length: 255 }),
  workModel: varchar({ length: 255 }), // "remote", "hybrid", "on-site"
  postLanguage: varchar({ length: 255 }).notNull(),
  salary: varchar({ length: 255 }),
  jobSummary: text(),
  jobPosted: date().notNull(),
  isInternship: boolean(),
  dateAIAnalysisGenerated: timestamp().notNull().defaultNow(),
  city: varchar({ length: 255 }),
});

// Skills table - generic for all sources
export const skillTable = jobSchema.table("skill", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
});

export const skillJobMappingTable = jobSchema.table("skill_job_mapping", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => jobPostsTable.id),
  skillId: integer()
    .notNull()
    .references(() => skillTable.id),
  isRequired: boolean().notNull(),
});

// Views for easy querying
export const jobsWithSkillsView = jobSchema.view("jobs_with_skills_view").as((qb) => {
  const query = qb
    .select({
      job_post_id: jobPostsTable.id,
      job_title: jobPostsTable.title,
      company: jobPostsTable.company,
      location: jobPostsTable.location,
      external_id: jobPostsTable.externalId,
      source_name: jobSourcesTable.name,
      original_url: jobPostsTable.originalUrl,
      skill_name: skillTable.name,
      is_skill_required: skillJobMappingTable.isRequired,
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel,
      developmentSide: jobAiAnalysisTable.developmentSide,
      companyIndustry: jobAiAnalysisTable.companyIndustry,
      workModel: jobAiAnalysisTable.workModel,
      postLanguage: jobAiAnalysisTable.postLanguage,
      salary: jobAiAnalysisTable.salary,
      jobSummary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      dateAIAnalysisGenerated: jobAiAnalysisTable.dateAIAnalysisGenerated,
    })
    .from(jobPostsTable)
    .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
    .leftJoin(skillJobMappingTable, eq(skillJobMappingTable.jobId, jobPostsTable.id))
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, jobPostsTable.id));

  return query;
});

export const jobsInSearchView = jobSchema.view("jobs_in_search_view").as((qb) => {
  const query = qb
    .select({
      post_id: jobPostsTable.id,
      post_title: jobPostsTable.title,
      external_id: jobPostsTable.externalId,
      source_name: jobSourcesTable.name,
      search_id: jobPostInSearchTable.jobSearchId,
      search_keywords: jobSearchTable.keywords,
      search_location: jobSearchTable.location,
      search_date: jobSearchTable.searchDate,
    })
    .from(jobPostsTable)
    .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
    .leftJoin(jobPostInSearchTable, eq(jobPostInSearchTable.jobId, jobPostsTable.id))
    .leftJoin(jobSearchTable, eq(jobSearchTable.id, jobPostInSearchTable.jobSearchId));

  return query;
});

// Type exports
export type JobSource = typeof jobSourcesTable.$inferInsert & { id: number };
export type JobPost = typeof jobPostsTable.$inferInsert & { id: number };
export type JobSearch = typeof jobSearchTable.$inferInsert & { id: number };
export type JobPostInSearch = typeof jobPostInSearchTable.$inferInsert & { id: number };
export type JobAiAnalysis = typeof jobAiAnalysisTable.$inferInsert & { id: number };
export type Skill = typeof skillTable.$inferInsert & { id: number };
export type SkillJobMapping = typeof skillJobMappingTable.$inferInsert & { id: number };
