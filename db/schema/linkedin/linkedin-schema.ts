import { db } from "db";
import {
  boolean,
  integer,
  pgSchema,
  text,
  timestamp,
  varchar
} from "drizzle-orm/pg-core";
import { findOrInsertSkillsForJob, insertJobSkillMappings } from "src/linkedin/jobs/skills.db";

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

export const insertAIAnalysis = async (jobId: number, analysis: {
  yearsOfExperienceExpected?: number,
  numberOfApplicants?: number,
  seniorityLevel?: string,
  decelopmentSide?: string,
  companyIndustry?: string,
  workModel?: string,
  postLanguage: string,
  salary?: string,
  jobSummary: string,
  skillsRequired: string[],
  skillsOptional: string[]
}) => {
  db.transaction(async (tx) => {
    await tx
      .insert(jobAIAnalysis)
      .values({
        jobId,
        ...analysis
      })
      .returning()
      .execute().then((result) => result[0]);

    await findOrInsertSkillsForJob(analysis.skillsRequired, tx).then(async (result) => {
      await insertJobSkillMappings(jobId, Object.values(result), true, tx);
    });
    await findOrInsertSkillsForJob(analysis.skillsOptional, tx).then(async (result) => {
      await insertJobSkillMappings(jobId, Object.values(result), false, tx);
    })
  })
};

//Skills 👇
export const skill = linkedinSchema.table("skill", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  name: varchar({ length: 255 }).notNull().unique(),
})

export const skillJobMapping = linkedinSchema.table("skill_job_mapping", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  jobId: integer()
    .notNull()
    .references(() => linkedInJobPostsTable.id),
  skillId: integer()
    .notNull()
    .references(() => skill.id),
  isRequired: boolean().notNull(), // Indicates if the technology is required or optional
});
//Skills 👆

export type Skill = typeof skill.$inferInsert;
export type SkillJobMapping = typeof skillJobMapping.$inferInsert;
export type LinkedinJobPost = typeof linkedInJobPostsTable.$inferInsert & { id: number };
export type LinkedinJobSearch = typeof linkedinJobSearch.$inferInsert & { id: number };
export type JobPostInSearch = typeof jobPostInSearch.$inferInsert & { id: number };
export type JobAIAnalysis = typeof jobAIAnalysis.$inferInsert & { id: number };
