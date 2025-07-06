import { db } from "db";
import { jobAiAnalysisTable, jobPostsTable, jobSourcesTable, skillJobMappingTable, skillTable } from "db/schema/generic/job-schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport";

export const karelSkillMap: Record<string, number> = {
  "Angular": 30,
  "TypeScript": 30,
  "Drizzle": 15,
  "Figma": 10,
  "SQL": 10,
  "API": 10,
  "git": 10,
  "Node.js": 10,
  "JavaScript": 10,
  "Postgres": 10,
  "Playwright": 10,
  "Jest": 10,
  "React": 10,
  "C#": 10,
  ".NET": 10,
  'x++': 10,
  "Tailwind": 10,
  "Docker": 5,
  "HTML": 5,
  "CSS": 5,
  "GraphQL": 5,
  "Kubernetes": 5,
  "GitHub Actions": 5,
  "Github": 5,
  "NoSQL": 5,

  // Others
  "Scrum": 10,
  "Agile": 10,
  "Swedish": 10,
  "English": 10,
  "Danish": 10,

  // Negative skills (penalties)
  "Swift": -10,
  'PHP': -10,
  "Python": -10,
  "Java": -10,
}

const dateKarelStartedProgramming = new Date('2021-06-01'); // Karel started programming in June 2021

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
        display: `${skill} (${rating})`
      };
    })
    .sort((a, b) => b.rating - a.rating); // Sort by rating descending

  return skillsWithRatings.map(s => s.display).join(', ');
};

// Helper function to get skill rating with case-insensitive partial matching
const getSkillRating = (skill: string, skillMap: Record<string, number>): number => {
  const skillLower = skill.toLowerCase();

  // First try exact match (case insensitive) - this takes highest priority
  for (const [mapSkill, rating] of Object.entries(skillMap)) {
    if (mapSkill.toLowerCase() === skillLower) {
      return rating;
    }
  }

  // Check for exact matches with common variations (high priority)
  for (const [mapSkill, rating] of Object.entries(skillMap)) {
    const mapSkillLower = mapSkill.toLowerCase();

    if ((mapSkillLower === 'react' && (skillLower === 'reactjs' || skillLower === 'react.js')) ||
      (mapSkillLower === 'angular' && skillLower === 'angularjs') ||
      (mapSkillLower === 'javascript' && skillLower === 'js') ||
      (mapSkillLower === 'typescript' && skillLower === 'ts')) {
      return rating;
    }
  }

  // Then try partial matching - check if job skill contains our mapped skill
  const partialMatches = [];

  for (const [mapSkill, rating] of Object.entries(skillMap)) {
    const mapSkillLower = mapSkill.toLowerCase();

    // Check if the job skill contains our mapped skill (e.g., "SQL Server" contains "SQL")
    // Only match if our mapped skill is at least 3 characters to avoid very short false matches
    if (mapSkillLower.length >= 3 && skillLower.includes(mapSkillLower)) {
      partialMatches.push({ skill: mapSkill, rating, matchLength: mapSkillLower.length });
    }
  }

  // If we found partial matches, return the one with the longest match (most specific)
  if (partialMatches.length > 0) {
    const bestMatch = partialMatches.sort((a, b) => b.matchLength - a.matchLength)[0];
    return bestMatch.rating;
  }

  return -5; // Penalty for skills not in your skill map
};

// Helper function to get work model bonus points based on AI-analyzed work model from database
const getWorkModelBonus = (workModel: string | null): number => {
  if (!workModel) return 0;

  // Use the exact AI-analyzed work model enum values from the database
  // These come from the AI analysis that categorizes jobs into: "remote", "on-site", "hybrid", "other", "unknown"
  switch (workModel.toLowerCase()) {
    case 'hybrid':
      return 30; // Highest bonus for hybrid positions
    case 'on-site':
      return 25; // Good bonus for on-site positions
    default:
      return 0;
  }
};

// Helper function to calculate years of experience penalty
const getYearsExperiencePenalty = (requiredYears: number | null): number => {
  // Calculate Karel's current experience dynamically based on start date
  const now = new Date();
  const yearsOfExperience = (now.getTime() - dateKarelStartedProgramming.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const myExperience = Math.floor(yearsOfExperience); // Round down to whole years

  if (!requiredYears || requiredYears <= myExperience) {
    return 0; // No penalty for jobs within experience level
  }

  const yearsGap = requiredYears - myExperience;

  // Progressive penalty system - more realistic job applications
  if (yearsGap === 1) return -5;   // 1 year over: small penalty
  if (yearsGap === 2) return -12;  // 2 years over: moderate penalty
  if (yearsGap === 3) return -20;  // 3 years over: significant penalty
  if (yearsGap === 4) return -30;  // 4 years over: large penalty
  if (yearsGap >= 5) return -45;   // 5+ years over: very large penalty (quite unrealistic to apply)

  return 0;
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
const generateScoringFormulaString = (
  skillsRating: number,
  workModelBonus: number,
  optionalSkillsRating: number,
  experiencePenalty: number,
  timeDecay: number,
  finalScore: number,
  daysAgo: number,
  matchingRequiredSkills: string[],
  matchingOptionalSkills: string[]
): string => {
  const requiredCount = matchingRequiredSkills.length;
  const optionalCount = matchingOptionalSkills.length;

  const requiredPart = requiredCount > 0 ?
    `${requiredCount} required skill${requiredCount > 1 ? 's' : ''} (${skillsRating} pts)` :
    'No required skills (0 pts)';

  const optionalPart = optionalCount > 0 ?
    ` + ${optionalCount} optional skill${optionalCount > 1 ? 's' : ''} (${optionalSkillsRating.toFixed(1)} pts)` :
    '';

  const workModelPart = workModelBonus > 0 ?
    ` + work model (${workModelBonus} pts)` :
    '';

  const experiencePart = experiencePenalty !== 0 ?
    ` + exp penalty (${experiencePenalty} pts)` :
    '';

  const baseTotal = skillsRating + optionalSkillsRating + workModelBonus + experiencePenalty;
  const daysAgoPart = daysAgo === -1 ? 'unknown date' : `${daysAgo}d ago`;
  return `${requiredPart}${optionalPart}${workModelPart}${experiencePart} = ${baseTotal.toFixed(1)} × ${timeDecay} (${daysAgoPart}) = ${finalScore.toFixed(1)}`;
};

export const findRatedJobsForKarel = async () => {
  console.log("🔍 Querying jobs from all sources (LinkedIn, JobIndex, etc.)...");
  console.log("📝 Note: Internships are automatically filtered out");
  const jobs = await getRatedJobIds(karelSkillMap); // Use improved version

  if (jobs.length === 0) {
    console.log("❌ No jobs found matching your skills. Make sure you have:");
    console.log("  1. Scraped some jobs");
    console.log("  2. Run AI analysis on the jobs");
    console.log("  3. Have skills that match the available jobs");
    return;
  }

  console.log(`📊 Found ${jobs.length} matching jobs. Processing...`);

  // Define type for processed job info (cleaned up columns)
  type JobInfoRow = {
    title: string;
    location: string;
    source: string | null;
    skills: string; // Combined required and optional skills
    yearsExp: string | number;
    position: string;
    workModel: string;
    summary: string;
    score: number;
    scoringFormula: string;
    posted: string | Date;
    scraped: string;
    // Keep URL data for links
    originalUrl?: string | null;
    externalId?: string | null;
  };

  // Process jobs in batches to avoid overwhelming the database connection pool
  const batchSize = 20; // Process 20 jobs at a time to balance speed vs connection limits
  const importantInfoRows: JobInfoRow[] = [];

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map(async (j) => {
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

      // Calculate work model bonus
      const workModelBonus = getWorkModelBonus(j.workModel);

      // Calculate optional skills bonus (50% of the normal skill rating since they're not required)
      let optionalSkillsRating = 0;
      const matchingOptionalSkills = [];
      for (const optionalSkill of optionalSkills) {
        if (optionalSkill.name) {
          const skillRating = getSkillRating(optionalSkill.name, karelSkillMap);
          if (skillRating !== 0) {
            optionalSkillsRating += skillRating * 0.5; // 50% bonus for optional skills
            matchingOptionalSkills.push(optionalSkill.name);
          }
        }
      }

      // Calculate years of experience penalty
      const experiencePenalty = getYearsExperiencePenalty(j.yearsOfExperienceExpected);

      // Calculate total base rating (required skills + optional skills + work model bonus + experience penalty)
      const totalBaseRating = j.rating + optionalSkillsRating + workModelBonus + experiencePenalty;

      // Calculate time decay and adjusted score
      const timeDecay = calculateTimeDecay(j.jobPosted);
      const adjustedScore = totalBaseRating * timeDecay;

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

      // Get all skills for formula (include all skills, even unknown ones with -5 penalty)
      const allRequiredSkills = j.requiredSkills; // Include all required skills in display
      const matchingRequiredSkillsWithRatings = allRequiredSkills.map(skill => `${skill}(${getSkillRating(skill, karelSkillMap)})`);
      const matchingOptionalSkillsWithRatings = matchingOptionalSkills.map(skill => `${skill}(${Math.round(getSkillRating(skill, karelSkillMap) * 0.5)})`);

      const scoringFormula = generateScoringFormulaString(
        j.rating,
        workModelBonus,
        optionalSkillsRating,
        experiencePenalty,
        timeDecay,
        adjustedScore,
        daysAgo,
        matchingRequiredSkillsWithRatings,
        matchingOptionalSkillsWithRatings
      );

      // Format skills for display - combine required and optional with clear indicators
      const requiredSkillsFormatted = formatSkillsWithRatings(j.requiredSkills, karelSkillMap);
      const optionalSkillsFormatted = matchingOptionalSkills.length > 0 ?
        formatSkillsWithRatings(matchingOptionalSkills, karelSkillMap) :
        '';

      // Combine skills with indicators
      let combinedSkills = '';
      if (requiredSkillsFormatted !== 'Not specified') {
        combinedSkills += `Required: ${requiredSkillsFormatted}`;
      }
      if (optionalSkillsFormatted) {
        if (combinedSkills) combinedSkills += ' | ';
        combinedSkills += `Optional: ${optionalSkillsFormatted}`;
      }
      if (!combinedSkills) {
        combinedSkills = 'No matching skills';
      }

      return {
        title: j.title,
        location: j.location?.split('·')[0]?.trim() || j.location, // Clean location
        source: j.sourceName, // Show which source (LinkedIn, JobIndex, etc.)
        skills: combinedSkills, // Combined skills with clear indicators
        yearsExp: j.yearsOfExperienceExpected || 'Not specified',
        position: j.developmentSide || 'Not specified',
        workModel: j.workModel || 'Not specified',
        summary: j.jobSummary || 'No summary available',
        score: Math.round(adjustedScore * 10) / 10, // Round to 1 decimal
        scoringFormula: scoringFormula,
        posted: j.jobPosted || 'Unknown',
        scraped: j.dateScraped ? j.dateScraped.toLocaleDateString() : 'Unknown', // Add scraped date
        // Keep URL data for working links (but don't display as columns)
        originalUrl: j.originalUrl,
        externalId: j.externalId,
      };
    }));

    importantInfoRows.push(...batchResults);
  }

  // Sort by adjusted score (descending) - this will be the default sort in the HTML report
  importantInfoRows.sort((a, b) => b.score - a.score);

  console.log(`✅ Processed ${importantInfoRows.length} jobs. Opening in browser...`);

  // Calculate Karel's current experience for the profile box
  const now = new Date();
  const yearsOfExperience = (now.getTime() - dateKarelStartedProgramming.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const currentExperience = Math.floor(yearsOfExperience);

  // Get all skills organized by rating for profile table
  const allSkills = Object.entries(karelSkillMap)
    .sort(([, a], [, b]) => b - a) // Sort by rating descending
    .map(([skill, rating]) => ({ skill, rating }));

  const karelProfile = {
    experience: currentExperience,
    startDate: dateKarelStartedProgramming.toLocaleDateString(),
    allSkills: allSkills,
    workModelPreferences: 'Hybrid (+30), On-site (+25), Remote (0)',
    experienceRange: `${currentExperience} years (penalties for ${currentExperience + 1}+ years required)`,
    unknownSkillPenalty: '-5 points per unknown skill',
    optionalSkillBonus: 'Optional skills get 50% of normal rating'
  };

  showImportantInfoRowsInBrowser(importantInfoRows, karelProfile);

  // Keep the server running by waiting for user input
  console.log(`\n🌐 HTML report is now running. Press Enter to continue or Ctrl+C to exit...`);
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
  });
}

export async function getRatedJobIds(mySkills: Record<string, number>) {
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
      requiredSkills: sql<string[]>`COALESCE(array_agg(DISTINCT CASE WHEN ${skillJobMappingTable.isRequired} = true THEN ${skillTable.name} END) FILTER (WHERE ${skillTable.name} IS NOT NULL AND ${skillJobMappingTable.isRequired} = true), ARRAY[]::text[])`.as("required_skills"),
      optionalSkills: sql<string[]>`COALESCE(array_agg(DISTINCT CASE WHEN ${skillJobMappingTable.isRequired} = false THEN ${skillTable.name} END) FILTER (WHERE ${skillTable.name} IS NOT NULL AND ${skillJobMappingTable.isRequired} = false), ARRAY[]::text[])`.as("optional_skills"),
    })
    .from(jobPostsTable)
    .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
    .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, jobPostsTable.id))
    .leftJoin(skillJobMappingTable, eq(skillJobMappingTable.jobId, jobPostsTable.id))
    .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
    .where(
      and(
        sql`${jobAiAnalysisTable.jobId} IS NOT NULL`, // Only jobs with AI analysis
        // Filter out internships - exclude jobs that are marked as internships
        or(
          eq(jobAiAnalysisTable.isInternship, false),
          sql`${jobAiAnalysisTable.isInternship} IS NULL`
        )
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

  const scoredJobs = allJobs
    .map(job => {
      // Calculate rating using our improved skill matching
      let skillsRating = 0;
      const matchingSkills = [];
      const negativeSkills = [];
      let hasRelevantSkills = false; // Track if job has skills that are actually relevant to you
      let hasExplicitlyNegativeSkills = false; // Track if job has skills you explicitly hate

      for (const skill of job.requiredSkills) {
        const skillRating = getSkillRating(skill, mySkills);
        if (skillRating > 0) {
          skillsRating += skillRating;
          matchingSkills.push(skill);
          hasRelevantSkills = true; // Positive skill match
        } else if (skillRating < 0 && skillRating !== -5) {
          // Explicitly negative skills (from your skill map) - these are deal breakers
          skillsRating += skillRating; // Add negative points
          negativeSkills.push(skill);
          hasExplicitlyNegativeSkills = true; // Mark as having deal-breaker skills
        } else if (skillRating === -5) {
          // Unknown skills still get penalty but don't make job "relevant"
          skillsRating += skillRating;
          negativeSkills.push(skill);
        }
      }

      // Add work model bonus
      const workModelBonus = getWorkModelBonus(job.workModel);
      const totalRating = skillsRating + workModelBonus;

      return {
        ...job,
        rating: totalRating,
        skillsRating,
        workModelBonus,
        matchingSkills: [...matchingSkills, ...negativeSkills], // Include all skills for display
        hasRelevantSkills, // Track if this job is actually relevant
        hasExplicitlyNegativeSkills // Track if this job has deal-breaker skills
      };
    })
    .filter(job => job.hasRelevantSkills) // Only include jobs with at least one positive skill (negative skills are allowed)
    .sort((a, b) => {
      // Sort by total rating first, then by posting date
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
