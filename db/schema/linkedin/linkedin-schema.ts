import { db } from "db";
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
  dateScraped: timestamp().notNull().defaultNow(),
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
  decelopmentSide: varchar({ length: 255 }), // 'front-end', 'back-end', 'full-stack'
  companyIndustry: varchar({ length: 255 }),
  workModel: varchar({ length: 255 }),
  postLanguage: varchar({ length: 255 }).notNull(),
  salary: varchar({ length: 255 }),
  jobSummary: text(),
  jobPosted: date(),
  dateAIAnalysisGenerated: timestamp().notNull().defaultNow(),
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
  postedDaysAgo?: number,
  jobSummary: string,
  skillsRequired: string[],
  skillsOptional: string[],
}) => {
  //round yearsOfExperienceExpected to be a whole number
  if (analysis.yearsOfExperienceExpected) {
    analysis.yearsOfExperienceExpected = Math.round(analysis.yearsOfExperienceExpected);
  }

  const jobScrapedDate: Date = await db
    .select({ dateScraped: linkedInJobPostsTable.dateScraped })
    .from(linkedInJobPostsTable)
    .where(eq(linkedInJobPostsTable.id, jobId))
    .execute().then((result) => {
      return result[0].dateScraped;
    });

  const datePosted = getDatePosted({
    jobScrapedDate,
    postedDaysAgo: analysis.postedDaysAgo
  })

  db.transaction(async (tx) => {
    await tx
      .insert(jobAIAnalysis)
      .values({
        jobId,
        ...analysis,
        jobPosted: datePosted?.toISOString(),
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

const getDatePosted = (
  { jobScrapedDate, postedDaysAgo }:
    {
      jobScrapedDate: Date,
      //can be decimal, e.g. 0.5 days ago
      postedDaysAgo?: number
    }): Date | undefined => {
  if (postedDaysAgo === undefined) return undefined;

  const datePosted = new Date(jobScrapedDate);
  //set with hours to make sure we take decimal days into account
  const hoursAgo = postedDaysAgo * 24;
  datePosted.setHours(datePosted.getHours() - hoursAgo);
  return datePosted;
}

export type Skill = typeof skill.$inferInsert;
export type SkillJobMapping = typeof skillJobMapping.$inferInsert;
export type LinkedinJobPost = typeof linkedInJobPostsTable.$inferInsert & { id: number };
export type LinkedinJobSearch = typeof linkedinJobSearch.$inferInsert & { id: number };
export type JobPostInSearch = typeof jobPostInSearch.$inferInsert & { id: number };
export type JobAIAnalysis = typeof jobAIAnalysis.$inferInsert & { id: number };
