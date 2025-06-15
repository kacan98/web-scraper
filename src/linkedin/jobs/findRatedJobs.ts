import { db } from "db";
import { jobAiAnalysisTable, linkedInJobPostsTable, skillJobMappingTable, skillTable } from "db/schema/linkedin/linkedin-schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport";

export const karelSkillMap: Record<string, number> = {
  "TypeScript": 10,
  "Angular": 20,
  "Node.js": 10,
  "JavaScript": 10,
  "Postgres": 8,
  "Playwright": 10,
  "Drizzle": 15,
  "Drizzle ORM": 15,
  "React": 7,
  "C#": 5,
  ".NET": 6,
  'x++': 8,
  'PHP': -10
}

// Helper function to format skills with ratings, sorted by rating
const formatSkillsWithRatings = (skills: string[], skillMap: Record<string, number>): string => {
  if (skills.length === 0) return 'Not specified';

  // Map skills to their ratings and sort by rating (descending)
  const skillsWithRatings = skills
    .map(skill => {
      const rating = skillMap[skill];
      return {
        skill,
        rating: rating !== undefined ? rating : 0,
        display: rating !== undefined ? `${skill} (${rating})` : `${skill} (0)`
      };
    })
    .sort((a, b) => b.rating - a.rating); // Sort by rating descending

  return skillsWithRatings.map(s => s.display).join(', ');
};

// Helper function to calculate time decay factor
const calculateTimeDecay = (jobPosted: string | null): number => {
  if (!jobPosted) return 0.1; // Very low multiplier for jobs without posting date

  const postedDate = new Date(jobPosted);
  const now = new Date();
  const daysAgo = Math.floor((now.getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysAgo <= 1) return 1.0;      // Full rating for jobs <= 1 day old
  if (daysAgo <= 2) return 0.9;      // 90% for 2 days old
  if (daysAgo <= 3) return 0.8;      // 80% for 3 days old
  if (daysAgo <= 4) return 0.7;      // 70% for 4 days old
  if (daysAgo <= 5) return 0.6;      // 60% for 5 days old
  if (daysAgo <= 6) return 0.5;      // 50% for 6 days old
  if (daysAgo <= 7) return 0.4;      // 40% for 7 days old
  if (daysAgo <= 14) return 0.2;     // 20% for 1-2 weeks old
  return 0.05;                       // Very low multiplier for older posts
};

// Helper function to generate scoring formula description
const generateScoringFormula = (
  baseRating: number,
  timeDecay: number,
  finalScore: number,
  daysAgo: number,
  matchingSkills: string[]
): string => {
  const skillPart = matchingSkills.length > 0 ?
    `Skills: ${matchingSkills.join(' + ')} = ${baseRating}` :
    'No matching skills = 0';

  return `${skillPart} × ${timeDecay} (${daysAgo}d ago) = ${finalScore.toFixed(1)}`;
};

export const findRatedJobsForKarel = async () => {
  const jobs = await getRatedJobIds(karelSkillMap);

  // Create enhanced info rows for display with cleaner, more relevant data
  const importantInfoRows = await Promise.all(jobs.map(async (j) => {
    // Get optional skills separately (non-required skills)
    const optionalSkills = await db
      .select({ name: skillTable.name })
      .from(skillJobMappingTable)
      .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
      .where(
        and(
          eq(skillJobMappingTable.jobId, j.id),
          eq(skillJobMappingTable.isRequired, false)
        )
      );

    // Calculate time decay and adjusted score
    const timeDecay = calculateTimeDecay(j.jobPosted);
    const adjustedScore = j.rating * timeDecay;
    const daysAgo = j.jobPosted ?
      Math.floor((new Date().getTime() - new Date(j.jobPosted).getTime()) / (1000 * 60 * 60 * 24)) :
      999;

    // Get matching skills for formula
    const matchingSkills = j.requiredSkills.filter(skill => karelSkillMap[skill] !== undefined);
    const matchingSkillsWithRatings = matchingSkills.map(skill => `${skill}(${karelSkillMap[skill]})`);

    const scoringFormula = generateScoringFormula(
      j.rating,
      timeDecay,
      adjustedScore,
      daysAgo,
      matchingSkillsWithRatings
    );

    return {
      title: j.title,
      company: j.company,
      location: j.location?.split('·')[0]?.trim() || j.location, // Clean location
      requiredSkills: formatSkillsWithRatings(j.requiredSkills, karelSkillMap), // Show skills with ratings, sorted by rating
      optionalSkills: formatSkillsWithRatings(optionalSkills.map(s => s.name).filter((name): name is string => name !== null).slice(0, 5), karelSkillMap) || 'None', // Optional skills with ratings
      yearsExp: j.yearsOfExperienceExpected || 'Not specified',
      seniority: j.seniorityLevel || 'Not specified',
      position: j.decelopmentSide || 'Not specified',
      workModel: j.workModel || 'Not specified',
      summary: j.jobSummary || 'No summary available',
      posted: j.jobPosted || 'Unknown',
      numberOfApplicants: j.numberOfApplicants,
      baseRating: j.rating,
      adjustedScore: Math.round(adjustedScore * 10) / 10, // Round to 1 decimal
      scoringFormula: scoringFormula,
      linkedinId: j.linkedinId,
    };
  }));

  // Sort by adjusted score (descending)
  importantInfoRows.sort((a, b) => b.adjustedScore - a.adjustedScore);

  showImportantInfoRowsInBrowser(importantInfoRows);
}

/**
 * Queries job posts and orders them based on your skills proficiency and posting date.
 * @param mySkills - Object with skill names as keys and proficiency levels as values
 * @returns Promise resolving to an array of ordered job results
 */
export async function getRatedJobIds(mySkills: Record<string, number>) {
  const skillNames = Object.keys(mySkills);

  if (skillNames.length === 0) {
    return [];
  }

  // Build the CASE statement for rating calculation
  const ratingCases = skillNames.map(skillName =>
    `WHEN skill.name = '${skillName.replace(/'/g, "''")}' THEN ${mySkills[skillName]}`
  ).join(' '); const query = db
    .select({
      id: linkedInJobPostsTable.id,
      linkedinId: linkedInJobPostsTable.linkedinId,
      rating: sql<number>`
        CAST(COALESCE(
          SUM(CASE ${sql.raw(ratingCases)} ELSE 0 END), 0
        ) AS INTEGER)
      `.as("rating"),
      title: linkedInJobPostsTable.title,
      company: linkedInJobPostsTable.company,
      location: linkedInJobPostsTable.location,
      skills: linkedInJobPostsTable.skills,
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel,
      decelopmentSide: jobAiAnalysisTable.decelopmentSide,
      workModel: jobAiAnalysisTable.workModel,
      jobSummary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      requiredSkills: sql<string[]>`COALESCE(array_agg(DISTINCT skill.name ORDER BY skill.name) FILTER (WHERE skill.name IS NOT NULL), ARRAY[]::text[])`.as("required_skills"),
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
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .where(sql`${linkedInJobPostsTable.id} IN (
      SELECT DISTINCT ${skillJobMappingTable.jobId}
      FROM ${skillJobMappingTable}
      JOIN ${skillTable} ON ${skillTable.id} = ${skillJobMappingTable.skillId}
      WHERE ${skillTable.name} = ANY(${sql.raw(`ARRAY[${skillNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')}]`)})
      AND ${skillJobMappingTable.isRequired} = true
    )`).groupBy(
      linkedInJobPostsTable.id,
      linkedInJobPostsTable.linkedinId,
      linkedInJobPostsTable.title,
      linkedInJobPostsTable.company,
      linkedInJobPostsTable.location,
      linkedInJobPostsTable.skills,
      jobAiAnalysisTable.jobPosted,
      jobAiAnalysisTable.yearsOfExperienceExpected,
      jobAiAnalysisTable.seniorityLevel,
      jobAiAnalysisTable.decelopmentSide,
      jobAiAnalysisTable.workModel,
      jobAiAnalysisTable.jobSummary,
      jobAiAnalysisTable.numberOfApplicants)
    .orderBy(sql`rating DESC`, desc(jobAiAnalysisTable.jobPosted))

  const results = await query;
  return results;
}