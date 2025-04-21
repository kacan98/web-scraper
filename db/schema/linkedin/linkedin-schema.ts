import { eq } from "drizzle-orm";
import {
  boolean,
  date,
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
  dateScraped: timestamp().notNull().defaultNow(),
});

export const linkedinJobSearchTable = linkedinSchema.table("job_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  job: varchar({ length: 255 }).notNull(),
  location: varchar({ length: 255 }).notNull(),
  date: timestamp().notNull(),
});

export const jobPostInSearchTable = linkedinSchema.table("job_post_in_search", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  jobSearchId: integer()
    .notNull()
    .references(() => linkedinJobSearchTable.id),
});

export const jobAiAnalysisTable = linkedinSchema.table("job_ai_analysis", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  yearsOfExperienceExpected: integer(),
  numberOfApplicants: integer(),
  seniorityLevel: varchar({ length: 255 }), // "junior", "mid", "senior", "lead"
  decelopmentSide: varchar({ length: 255 }), // 'front-end', 'back-end', 'full-stack'
  companyIndustry: varchar({ length: 255 }),
  workModel: varchar({ length: 255 }),
  postLanguage: varchar({ length: 255 }).notNull(),
  salary: varchar({ length: 255 }),
  jobSummary: text(),
  jobPosted: date().notNull(),
  isInternship: boolean(),
  dateAIAnalysisGenerated: timestamp().notNull().defaultNow(),
  city: varchar({ length: 255 }) //todo: Make multiple cities possible in the future
});

//Skills 👇
export const skillTable = linkedinSchema.table("skill", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
})

export const skillJobMappingTable = linkedinSchema.table("skill_job_mapping", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  skillId: integer()
    .notNull()
    .references(() => skillTable.id),
  isRequired: boolean().notNull(), // Indicates if the technology is required or optional
});
//Skills 👆

export const jobsWithSkillsView = linkedinSchema.view("jobs_with_skills_view").as((qb) => {
  const query = qb
    .select({
      job_post_id: linkedInJobPostsTable.id,
      job_title: linkedInJobPostsTable.title,
      company: linkedInJobPostsTable.company,
      location: linkedInJobPostsTable.location,
      linkedin_id: linkedInJobPostsTable.linkedinId,
      skill_name: skillTable.name,
      is_skill_required: skillJobMappingTable.isRequired,
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel,
      decelopmentSide: jobAiAnalysisTable.decelopmentSide,
      companyIndustry: jobAiAnalysisTable.companyIndustry,
      workModel: jobAiAnalysisTable.workModel,
      postLanguage: jobAiAnalysisTable.postLanguage,
      salary: jobAiAnalysisTable.salary,
      jobSummary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      dateAIAnalysisGenerated: jobAiAnalysisTable.dateAIAnalysisGenerated,
    })
    .from(linkedInJobPostsTable)
    .leftJoin(skillJobMappingTable, eq(skillJobMappingTable.jobId, linkedInJobPostsTable.id))
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, linkedInJobPostsTable.id));

  return query;
});

export const jobsInSearchView = linkedinSchema.view("jobs_in_search_view").as((qb) => {
  const query = qb
    .select({
      post_id: linkedInJobPostsTable.id,
      post_title: linkedInJobPostsTable.title,
      linkedin_id: linkedInJobPostsTable.linkedinId,
      search_id: jobPostInSearchTable.jobSearchId,
      search_keywords: linkedinJobSearchTable.job,
      search_location: linkedinJobSearchTable.location,
      search_date: linkedinJobSearchTable.date,
    })
    .from(linkedInJobPostsTable)
    .leftJoin(jobPostInSearchTable, eq(jobPostInSearchTable.jobId, linkedInJobPostsTable.id))
    .leftJoin(linkedinJobSearchTable, eq(linkedinJobSearchTable.id, jobPostInSearchTable.jobSearchId));

  return query;
})

export type Skill = typeof skillTable.$inferInsert;
export type SkillJobMappingTable = typeof skillJobMappingTable.$inferInsert;
export type LinkedinJobPostTable = typeof linkedInJobPostsTable.$inferInsert & { id: number };
export type LinkedinJobSearchTable = typeof linkedinJobSearchTable.$inferInsert & { id: number };
export type JobPostInSearchTable = typeof jobPostInSearchTable.$inferInsert & { id: number };
export type JobAIAnalysisTable = typeof jobAiAnalysisTable.$inferInsert & { id: number };
