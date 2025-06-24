import { db } from "db";
import { jobAiAnalysisTable, jobPostsTable, jobSourcesTable, skillJobMappingTable, skillTable } from "db/schema/generic/job-schema";
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
  'PHP': -50,
  "Java": -50
}

// Helper function to format skills with ratings, sorted by rating
const formatSkillsWithRatings = (skills: string[], skillMap: Record<string, number>): string => {
  if (skills.length === 0) return 'Not specified';

  // Map skills to their ratings and sort by rating (descending)
  const skillsWithRatings = skills
    .map(skill => {
      const rating = getSkillRating(skill, skillMap);
      return {
        skill,
        rating: rating,
        display: rating > 0 ? `${skill} (${rating})` : `${skill} (0)`
      };
    })
    .sort((a, b) => b.rating - a.rating); // Sort by rating descending

  return skillsWithRatings.map(s => s.display).join(', ');
};

// Helper function to get skill rating with case-insensitive partial matching
const getSkillRating = (skill: string, skillMap: Record<string, number>): number => {
  const skillLower = skill.toLowerCase();

  // First try exact match (case insensitive)
  for (const [mapSkill, rating] of Object.entries(skillMap)) {
    if (mapSkill.toLowerCase() === skillLower) {
      return rating;
    }
  }

  // Then try partial matching - check if skill contains any of our map skills or vice versa
  for (const [mapSkill, rating] of Object.entries(skillMap)) {
    const mapSkillLower = mapSkill.toLowerCase();

    // Check if the job skill contains our mapped skill (e.g., "ReactJS" contains "React")
    if (skillLower.includes(mapSkillLower) || mapSkillLower.includes(skillLower)) {
      return rating;
    }    // Special handling for common variations
    if ((mapSkillLower === 'react' && (skillLower.includes('reactjs') || skillLower.includes('react.js'))) ||
      (mapSkillLower === 'angular' && skillLower.includes('angularjs')) ||
      (mapSkillLower === 'javascript' && (skillLower === 'js' || skillLower === 'javascript')) ||
      (mapSkillLower === 'typescript' && (skillLower === 'ts' || skillLower === 'typescript'))) {
      return rating;
    }
  }

  return 0; // No match found
};

// Helper function to calculate time decay factor
const calculateTimeDecay = (jobPosted: string | null): number => {
  if (!jobPosted) return 0.3; // Moderate multiplier for jobs without posting date (assume they're reasonably recent)

  const postedDate = new Date(jobPosted);
  const now = new Date();

  // Check if this is the Unix epoch (1970-01-01) which indicates missing data
  if (postedDate.getFullYear() === 1970 && postedDate.getMonth() === 0 && postedDate.getDate() === 1) {
    return 0.3; // Moderate multiplier for jobs with missing posting date
  }

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
  const skillCount = matchingSkills.length;
  const skillPart = skillCount > 0 ?
    `${skillCount} skill${skillCount > 1 ? 's' : ''} matched (${baseRating} pts)` :
    'No matching skills (0 pts)';

  const daysAgoPart = daysAgo === -1 ? 'unknown date' : `${daysAgo}d ago`;
  return `${skillPart} × ${timeDecay} (${daysAgoPart}) = ${finalScore.toFixed(1)}`;
};

export const findRatedJobsForKarel = async () => {
  console.log("🔍 Querying jobs from all sources (LinkedIn, JobIndex, etc.)...");
  const jobs = await getRatedJobIdsImproved(karelSkillMap); // Use improved version

  if (jobs.length === 0) {
    console.log("❌ No jobs found matching your skills. Make sure you have:");
    console.log("  1. Scraped some jobs");
    console.log("  2. Run AI analysis on the jobs");
    console.log("  3. Have skills that match the available jobs");
    return;
  } console.log(`📊 Found ${jobs.length} matching jobs. Processing...`);


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
    const timeDecay = calculateTimeDecay(j.jobPosted);
    const adjustedScore = j.rating * timeDecay;

    let daysAgo: number;
    if (!j.jobPosted) {
      daysAgo = -1; // Use -1 to indicate unknown
    } else {
      const postedDate = new Date(j.jobPosted);
      // Check if this is the Unix epoch (1970-01-01) which indicates missing data
      if (postedDate.getFullYear() === 1970 && postedDate.getMonth() === 0 && postedDate.getDate() === 1) {
        daysAgo = -1; // Use -1 to indicate unknown
      } else {
        daysAgo = Math.floor((new Date().getTime() - postedDate.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    return {
      title: j.title,
      company: j.company,
      location: j.location?.split('·')[0]?.trim() || j.location, // Clean location
      source: j.sourceName, // Show which source (LinkedIn, JobIndex, etc.)
      requiredSkills: formatSkillsWithRatings(j.requiredSkills, karelSkillMap), // Show skills with ratings, sorted by rating
      optionalSkills: formatSkillsWithRatings(optionalSkills.map(s => s.name).filter((name): name is string => name !== null).slice(0, 5), karelSkillMap) || 'None', // Optional skills with ratings
      yearsExp: j.yearsOfExperienceExpected || 'Not specified',
      seniority: j.seniorityLevel || 'Not specified',
      position: j.developmentSide || 'Not specified',
      workModel: j.workModel || 'Not specified',
      summary: j.jobSummary || 'No summary available',
      posted: j.jobPosted || 'Unknown',
      scraped: j.dateScraped ? j.dateScraped.toLocaleDateString() : 'Unknown', // Add scraped date
      numberOfApplicants: j.numberOfApplicants,
      baseRating: j.rating,
      adjustedScore: Math.round(adjustedScore * 10) / 10, // Round to 1 decimal      scoringFormula: scoringFormula,
      externalId: j.externalId,
      originalUrl: j.originalUrl,
    };
  }));

  // Sort by adjusted score (descending)
  importantInfoRows.sort((a, b) => b.adjustedScore - a.adjustedScore);

  console.log(`✅ Processed ${importantInfoRows.length} jobs. Opening in browser...`);
  showImportantInfoRowsInBrowser(importantInfoRows);

  // Keep the server running by waiting for user input
  console.log(`\n🌐 HTML report is now running. Press Enter to continue or Ctrl+C to exit...`);
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

/**
 * Queries job posts from ALL sources and orders them based on your skills proficiency and posting date.
 * @param mySkills - Object with skill names as keys and proficiency levels as values
 * @returns Promise resolving to an array of ordered job results
 */
export async function getRatedJobIds(mySkills: Record<string, number>) {
  const skillNames = Object.keys(mySkills);

  if (skillNames.length === 0) {
    return [];
  }
  // Build the CASE statement for rating calculation with partial matching
  const ratingCases = skillNames.flatMap(skillName => {
    const skillLower = skillName.toLowerCase();
    const cases = [];

    // Exact match (case insensitive)
    cases.push(`WHEN LOWER(skill.name) = '${skillLower.replace(/'/g, "''")}' THEN ${mySkills[skillName]}`);

    // Partial matches - skill contains our map skill
    cases.push(`WHEN LOWER(skill.name) LIKE '%${skillLower.replace(/'/g, "''")}%' THEN ${mySkills[skillName]}`);

    // Special variations
    if (skillLower === 'react') {
      cases.push(`WHEN LOWER(skill.name) LIKE '%reactjs%' OR LOWER(skill.name) LIKE '%react.js%' THEN ${mySkills[skillName]}`);
    }
    if (skillLower === 'angular') {
      cases.push(`WHEN LOWER(skill.name) LIKE '%angularjs%' THEN ${mySkills[skillName]}`);
    }
    if (skillLower === 'javascript') {
      cases.push(`WHEN LOWER(skill.name) = 'js' OR LOWER(skill.name) LIKE '%js%' THEN ${mySkills[skillName]}`);
    }
    if (skillLower === 'typescript') {
      cases.push(`WHEN LOWER(skill.name) = 'ts' OR LOWER(skill.name) LIKE '%ts%' THEN ${mySkills[skillName]}`);
    }

    return cases;
  }).join(' ');
  const query = db
    .select({
      id: jobPostsTable.id,
      externalId: jobPostsTable.externalId,
      originalUrl: jobPostsTable.originalUrl,
      rating: sql<number>`
        CAST(COALESCE(
          SUM(CASE ${sql.raw(ratingCases)} ELSE 0 END), 0
        ) AS INTEGER)
      `.as("rating"),
      title: jobPostsTable.title,
      company: jobPostsTable.company,
      location: jobPostsTable.location,
      skills: jobPostsTable.skills,
      sourceName: jobSourcesTable.name,
      dateScraped: jobPostsTable.dateScraped, // Add scraped date
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel,
      developmentSide: jobAiAnalysisTable.developmentSide,
      workModel: jobAiAnalysisTable.workModel,
      jobSummary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      requiredSkills: sql<string[]>`COALESCE(array_agg(DISTINCT skill.name ORDER BY skill.name) FILTER (WHERE skill.name IS NOT NULL), ARRAY[]::text[])`.as("required_skills"),
    })
    .from(jobPostsTable)
    .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, jobPostsTable.id))
    .leftJoin(
      skillJobMappingTable,
      and(
        eq(skillJobMappingTable.jobId, jobPostsTable.id),
        eq(skillJobMappingTable.isRequired, true)
      )
    )
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .where(sql`${jobPostsTable.id} IN (
      SELECT DISTINCT ${skillJobMappingTable.jobId}
      FROM ${skillJobMappingTable}
      JOIN ${skillTable} ON ${skillTable.id} = ${skillJobMappingTable.skillId}
      WHERE ${skillTable.name} = ANY(${sql.raw(`ARRAY[${skillNames.map(name => `'${name.replace(/'/g, "''")}'`).join(',')}]`)})
      AND ${skillJobMappingTable.isRequired} = true    )`).groupBy(
      jobPostsTable.id,
      jobPostsTable.externalId,
      jobPostsTable.originalUrl,
      jobPostsTable.title,
      jobPostsTable.company,
      jobPostsTable.location,
      jobPostsTable.skills,
        jobPostsTable.dateScraped, // Add scraped date to group by
      jobSourcesTable.name,
      jobAiAnalysisTable.jobPosted,
      jobAiAnalysisTable.yearsOfExperienceExpected,
      jobAiAnalysisTable.seniorityLevel,
      jobAiAnalysisTable.developmentSide,
      jobAiAnalysisTable.workModel,
      jobAiAnalysisTable.jobSummary,
      jobAiAnalysisTable.numberOfApplicants)
    .orderBy(sql`rating DESC`, desc(jobAiAnalysisTable.jobPosted))

  const results = await query;
  return results;
}

/**
 * Improved version of getRatedJobIds with better skill matching
 */
export async function getRatedJobIdsImproved(mySkills: Record<string, number>) {
  const skillNames = Object.keys(mySkills);

  if (skillNames.length === 0) {
    return [];
  }

  // Get all jobs with AI analysis and skills
  const query = db
    .select({
      id: jobPostsTable.id,
      externalId: jobPostsTable.externalId,
      originalUrl: jobPostsTable.originalUrl,
      title: jobPostsTable.title,
      company: jobPostsTable.company,
      location: jobPostsTable.location,
      skills: jobPostsTable.skills,
      sourceName: jobSourcesTable.name,
      dateScraped: jobPostsTable.dateScraped,
      yearsOfExperienceExpected: jobAiAnalysisTable.yearsOfExperienceExpected,
      seniorityLevel: jobAiAnalysisTable.seniorityLevel,
      developmentSide: jobAiAnalysisTable.developmentSide,
      workModel: jobAiAnalysisTable.workModel,
      jobSummary: jobAiAnalysisTable.jobSummary,
      jobPosted: jobAiAnalysisTable.jobPosted,
      numberOfApplicants: jobAiAnalysisTable.numberOfApplicants,
      requiredSkills: sql<string[]>`COALESCE(array_agg(DISTINCT skill.name ORDER BY skill.name) FILTER (WHERE skill.name IS NOT NULL), ARRAY[]::text[])`.as("required_skills"),
    })
    .from(jobPostsTable)
    .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, jobPostsTable.id))
    .leftJoin(
      skillJobMappingTable,
      and(
        eq(skillJobMappingTable.jobId, jobPostsTable.id),
        eq(skillJobMappingTable.isRequired, true)
      ))
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .where(
      and(
        sql`${jobAiAnalysisTable.jobId} IS NOT NULL`, // Only jobs with AI analysis
        sql`${jobAiAnalysisTable.jobPosted} > NOW() - INTERVAL '2 weeks'` // Only jobs posted within 2 weeks
      )
  )
    .groupBy(
      jobPostsTable.id,
      jobPostsTable.externalId,
      jobPostsTable.originalUrl,
      jobPostsTable.title,
      jobPostsTable.company,
      jobPostsTable.location,
      jobPostsTable.skills,
      jobPostsTable.dateScraped,
      jobSourcesTable.name,
      jobAiAnalysisTable.jobPosted,
      jobAiAnalysisTable.yearsOfExperienceExpected,
      jobAiAnalysisTable.seniorityLevel,
      jobAiAnalysisTable.developmentSide,
      jobAiAnalysisTable.workModel,
      jobAiAnalysisTable.jobSummary,
      jobAiAnalysisTable.numberOfApplicants
  );
  const allJobs = await query;

  // Filter and score jobs based on skill matching using our improved matching logic
  const scoredJobs = allJobs
    .map(job => {
      // Calculate rating using our improved skill matching
      let rating = 0;
      const matchingSkills = [];

      for (const skill of job.requiredSkills) {
        const skillRating = getSkillRating(skill, mySkills);
        if (skillRating !== 0) { // Include both positive and negative ratings
          rating += skillRating;
          matchingSkills.push(skill);
        }
      }

      return {
        ...job,
        rating,
        matchingSkills
      };
    })
    .filter(job => job.matchingSkills.length > 0) // Only include jobs that have skills we know about (positive or negative)
    .sort((a, b) => {
      // Sort by rating first, then by posting date
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      // If ratings are equal, sort by posting date (newer first)
      const aDate = a.jobPosted ? new Date(a.jobPosted) : new Date(0);
      const bDate = b.jobPosted ? new Date(b.jobPosted) : new Date(0);
      return bDate.getTime() - aDate.getTime();
    });

  return scoredJobs;
}
