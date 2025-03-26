import { db } from "db";
import {
    jobAiAnalysisTable,
    JobAIAnalysis,
    linkedInJobPostsTable
} from "db/schema/linkedin/linkedin-schema";
import { eq } from "drizzle-orm";
import { findOrInsertSkillsForJob, insertJobSkillMappings } from "src/linkedin/jobs/skills.db";

// export const insertJobAnalysis = async (analysis: JobAIAnalysis) => {
//     return await db
//         .insert(jobAiAnalysis)
//         .values(analysis)
//         .returning()
//         .execute()
//         .then((result) => result[0]);
// }

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
    isInternship: boolean
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
            .insert(jobAiAnalysisTable)
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