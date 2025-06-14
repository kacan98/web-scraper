import { db } from "db";
import { jobAiAnalysisTable, linkedInJobPostsTable, skillJobMappingTable, skillTable } from "db/schema/linkedin/linkedin-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport";

export const karelSkillMap: Record<string, number> = {
  "TypeScript": 10,
  "Angular": 10,
  "React": 7,
  "C#": 5,
  ".NET": 6,
  "Node.js": 10,
  "JavaScript": 10,
  'x++': 8,
}

export const findRatedJobsForKarel = async () => {
  const jobs = await getRatedJobIds(karelSkillMap);
  showImportantInfoRowsInBrowser(jobs)
}

/**
 * Queries job posts and orders them based on your skills proficiency and posting date.
 * @param mySkills - Object with skill names as keys and proficiency levels as values
 * @returns Promise resolving to an array of ordered job results
 */
async function getRatedJobIds(mySkills: Record<string, number>) {
  // Convert skills object to JSON string for SQL query
  const mySkillsJson = JSON.stringify(mySkills);

  const query = db
    .select({
      id: linkedInJobPostsTable.id,
      linkedinId: linkedInJobPostsTable.linkedinId,
      rating: sql<number>`
      SUM(CASE WHEN ${skillTable.name} 
      IN (SELECT json_object_keys(${mySkillsJson}::json))
      THEN ((${mySkillsJson}::json)->>${skillTable.name})::int ELSE 0 END) - 10 * SUM(CASE WHEN ${skillTable.name}
      NOT IN (SELECT json_object_keys(${mySkillsJson}::json))
      THEN 1 ELSE 0 END)`.as("rating"),
      title: linkedInJobPostsTable.title,
      location: linkedInJobPostsTable.location,
      skills: linkedInJobPostsTable.skills,
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel, decelopmentSide: jobAiAnalysisTable.decelopmentSide,
      workModel: jobAiAnalysisTable.workModel,
      jobSumary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      requiredSkills: sql<string>`array_agg(${skillTable.name})`.as("required_skills"),

    })
    .from(linkedInJobPostsTable)
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, linkedInJobPostsTable.id))
    .leftJoin(
      skillJobMappingTable,
      and(
        eq(skillJobMappingTable.jobId, linkedInJobPostsTable.id),
        eq(skillJobMappingTable.isRequired, true)
      )
    )
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId)).groupBy(
      linkedInJobPostsTable.id,
      jobAiAnalysisTable.jobPosted,
      jobAiAnalysisTable.yearsOfExperienceExpected,
      jobAiAnalysisTable.seniorityLevel,
      jobAiAnalysisTable.decelopmentSide,
      jobAiAnalysisTable.workModel,
      jobAiAnalysisTable.jobSummary,
      jobAiAnalysisTable.numberOfApplicants
    )
    .having(sql`
      SUM(CASE WHEN ${skillTable.name} 
      NOT IN (SELECT json_object_keys(${mySkillsJson}::json)) 
      THEN 1 ELSE 0 END) = 0
    `)
    .orderBy(({ rating }) => [desc(rating), desc(jobAiAnalysisTable.jobPosted)])

  const results = await query;
  return results;
}