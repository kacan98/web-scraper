import { db } from "db";
import {
  jobAiAnalysisTable,
  JobPost,
  jobPostsTable,
  skillJobMappingTable,
  skillTable
} from "db/schema/generic/job-schema";
import { and, asc, count, eq, exists, inArray, notExists } from 'drizzle-orm';

export type DatabaseType = typeof db;
export type TransactionType = Parameters<Parameters<DatabaseType['transaction']>[0]>[0];

// Get jobs that need AI analysis
export const getJobIds = async ({
  skip,
  top,
  onlyWithoutAnalysis = true,
  jobSearchIds,
  onlyGetCount = false
}: {
  skip?: number;
  top?: number;
  jobSearchIds?: number[];
  onlyWithoutAnalysis?: boolean;
  onlyGetCount?: boolean;
}): Promise<number[] | number> => {
  const baseQuery = onlyGetCount ? 
    db.select({ count: count() }) : 
    db.select({ id: jobPostsTable.id });

  const actualQuery = baseQuery.from(jobPostsTable)
    .where(and(
      onlyWithoutAnalysis ? notExists(
        db
          .select()
          .from(jobAiAnalysisTable)
          .where(eq(jobAiAnalysisTable.jobId, jobPostsTable.id))
      ) : undefined,
      // Add job search filtering if needed
      (jobSearchIds && jobSearchIds.length > 0) ? exists(
        db
          .select()
          .from(jobPostsTable) // This would need proper join with search table
          // .where(and(...)) // Add proper search filtering
      ) : undefined,
    ));

  if (onlyGetCount) {
    return actualQuery.execute().then(r => {
      const result = r[0] as { count: number };
      return result.count;
    });
  } else {
    top = top ?? 999999999999999;
    skip = skip ?? 0;

    return actualQuery
      .orderBy(asc(jobPostsTable.id))
      .limit(top)
      .offset(skip)
      .execute()
      .then(r =>
        (r as { id: number }[]).map(j => j.id)
      );
  }
};

export const getJobById = async (jobId: number): Promise<JobPost | undefined> => {
  return await db
    .select()
    .from(jobPostsTable)
    .where(eq(jobPostsTable.id, jobId))
    .execute()
    .then(r => r[0] as JobPost | undefined);
};

// Skills management for AI analysis
export const findOrInsertSkillsForJob = async (skills: string[], tx: TransactionType): Promise<{ [name: string]: number }> => {
  // Step 1: Find existing skills
  const existingSkills = await tx
    .select({
      id: skillTable.id,
      name: skillTable.name,
    })
    .from(skillTable)
    .where(inArray(skillTable.name, skills));

  // Step 2: Identify new skills
  const existingNames = existingSkills.map(skill => skill.name);
  const newSkillNames = [...new Set(skills.filter(name => !existingNames.includes(name)))];

  // Step 3: Insert new skills if any
  let newSkills: { id: number; name: string }[] = [];
  if (newSkillNames.length > 0) {
    newSkills = await tx
      .insert(skillTable)
      .values(newSkillNames.map(name => ({ name: name.slice(0, 255) })))
      .returning({
        id: skillTable.id,
        name: skillTable.name,
      });
  }

  // Step 4: Build the map of skill names to IDs
  const mapOfSkills: { [name: string]: number } = {};
  existingSkills.forEach(skill => {
    mapOfSkills[skill.name] = skill.id;
  });
  newSkills.forEach(skill => {
    mapOfSkills[skill.name] = skill.id;
  });

  return mapOfSkills;
};

export const insertJobSkillMappings = async (
  jobId: number, 
  skillIds: number[], 
  isRequired: boolean, 
  tx: TransactionType
) => {
  if (skillIds.length === 0) {
    return;
  }

  return await tx
    .insert(skillJobMappingTable)
    .values(
      skillIds.map(skillId => ({
        jobId,
        skillId,
        isRequired,
      }))
    )
    .onConflictDoNothing()
    .execute();
};

// Main AI analysis insertion function
export const insertAIAnalysis = async (jobId: number, analysis: {
  yearsOfExperienceExpected?: number,
  numberOfApplicants?: number,
  seniorityLevel?: string,
  developmentSide?: string,
  companyIndustry?: string,
  workModel?: string,
  postLanguage: string,
  salary?: string,
  postedDaysAgo?: number,
  jobSummary: string,
  skillsRequired: string[],
  skillsOptional: string[],
  isInternship: boolean,
  city?: string
}) => {
  // Round years of experience to whole number
  if (analysis.yearsOfExperienceExpected) {
    analysis.yearsOfExperienceExpected = Math.round(analysis.yearsOfExperienceExpected);
  }

  // Get the job's scraped date
  const jobScrapedDate: Date = await db
    .select({ dateScraped: jobPostsTable.dateScraped })
    .from(jobPostsTable)
    .where(eq(jobPostsTable.id, jobId))
    .execute().then((result) => {
      return result[0].dateScraped;
    });

  const datePosted = getDatePosted({
    jobScrapedDate,
    postedDaysAgo: analysis.postedDaysAgo
  });

  await db.transaction(async (tx) => {
    // Insert AI analysis
    await tx
      .insert(jobAiAnalysisTable)
      .values({
        jobId,
        ...analysis,
        jobPosted: datePosted.toISOString(),
      })
      .returning()
      .execute().then((result) => result[0]);

    // Insert skills
    await findOrInsertSkillsForJob(analysis.skillsRequired, tx).then(async (result) => {
      await insertJobSkillMappings(jobId, Object.values(result), true, tx);
    });
    await findOrInsertSkillsForJob(analysis.skillsOptional, tx).then(async (result) => {
      await insertJobSkillMappings(jobId, Object.values(result), false, tx);
    });
  });
};

const getDatePosted = (
  { jobScrapedDate, postedDaysAgo }:
    {
      jobScrapedDate: Date,
      //can be decimal, e.g. 0.5 days ago
      postedDaysAgo?: number
    }): Date => {
  if (postedDaysAgo === undefined) return new Date('1970-01-01');

  const datePosted = new Date(jobScrapedDate);
  //set with hours to make sure we take decimal days into account
  const hoursAgo = postedDaysAgo * 24;
  datePosted.setHours(datePosted.getHours() - hoursAgo);
  return datePosted;
};
