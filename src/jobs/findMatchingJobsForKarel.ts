import { and, desc, eq, exists, gt, ilike, inArray, isNull, lt, not, or } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
    jobAiAnalysisTable,
    jobPostsTable,
    jobSourcesTable,
    skillJobMappingTable,
    skillTable
} from "../../db/schema/generic/job-schema.js";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport.js";

// Function to get skills for multiple jobs in a single query (optimized)
const getSkillsForJobs = async (jobIds: number[]) => {
    if (jobIds.length === 0) return {};
    
    const skills = await db
        .select({
            jobId: skillJobMappingTable.jobId,
            name: skillTable.name,
            isRequired: skillJobMappingTable.isRequired
        })
        .from(skillJobMappingTable)
        .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
        .where(inArray(skillJobMappingTable.jobId, jobIds));

    // Group skills by job ID
    const skillsByJob: Record<number, { required: string[], optional: string[] }> = {};
    
    for (const skill of skills) {
        if (!skillsByJob[skill.jobId]) {
            skillsByJob[skill.jobId] = { required: [], optional: [] };
        }
        
        if (skill.name) {
            if (skill.isRequired) {
                skillsByJob[skill.jobId].required.push(skill.name);
            } else {
                skillsByJob[skill.jobId].optional.push(skill.name);
            }
        }
    }
    
    return skillsByJob;
};

export const findMatchingJobsForKarel = async () => {
    console.log("🔍 Finding matching jobs for Karel...");
    
    // First, let's check how many jobs we have per source
    const allJobs = await db
        .select({
            job_posts: jobPostsTable,
            job_sources: jobSourcesTable
        })
        .from(jobPostsTable)
        .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId));
    
    const sourceCount: Record<string, number> = {};
    allJobs.forEach(job => {
        const sourceName = job.job_sources?.name || 'unknown';
        sourceCount[sourceName] = (sourceCount[sourceName] || 0) + 1;
    });
    
    console.log("📊 Available jobs by source:");
    Object.entries(sourceCount).forEach(([source, count]) => {
        console.log(`  - ${source}: ${count} jobs`);
    });    const jobs = await getFilteredJobs({
        includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript", 'x++'],
        removeJobsWithSkills: [], // Temporarily remove the exclude list to see more JobIndex jobs
        acceptableSeniorityLevels: ['mid', 'junior', 'senior'],
        maxYearsOfExperienceRequired: 10, // Increase to include jobs with null experience
        includeInternships: false,
        acceptablePosition: ['frontend', 'full-stack'],
        maxDaysOld: 10, // Increase days to catch more jobs
        relaxSkillRequirements: true // Add a flag to be more lenient with skill matching
    });

    console.log(`📊 Found ${jobs.length} matching jobs after filtering`);
    
    // Let's also see the source breakdown of filtered jobs
    const filteredSourceCount: Record<string, number> = {};
    jobs.forEach(job => {
        const sourceName = job.job_sources?.name || 'unknown';
        filteredSourceCount[sourceName] = (filteredSourceCount[sourceName] || 0) + 1;
    });
    
    console.log("📊 Filtered jobs by source:");
    Object.entries(filteredSourceCount).forEach(([source, count]) => {
        console.log(`  - ${source}: ${count} jobs`);
    });    // Get all job IDs for bulk skills fetching
    const jobIds = jobs.map(j => j.job_posts.id);
    console.log(`🔍 Fetching skills for ${jobIds.length} jobs...`);
    
    // Fetch all skills in one query to avoid timeout
    const allSkills = await getSkillsForJobs(jobIds);
    
    // Create enhanced info rows for display with cleaner, more relevant data
    const importantInfoRows = jobs.map((j) => {
        const skills = allSkills[j.job_posts.id] || { required: [], optional: [] };
        
        return {
            title: j.job_posts.title,
            company: j.job_posts.company,
            location: j.job_posts.location?.split('·')[0]?.trim() || j.job_posts.location, // Clean location
            requiredSkills: skills.required.join(', ') || 'Not specified',
            optionalSkills: skills.optional.slice(0, 5).join(', ') || 'None', // Limit to 5 to avoid clutter
            yearsExp: j.job_ai_analysis?.yearsOfExperienceExpected || 'Not specified',
            seniority: j.job_ai_analysis?.seniorityLevel || 'Not specified',
            position: j.job_ai_analysis?.developmentSide || 'Not specified', // Fixed typo: decelopmentSide -> developmentSide
            workModel: j.job_ai_analysis?.workModel || 'Not specified',
            summary: j.job_ai_analysis?.jobSummary || 'No summary available',
            posted: j.job_ai_analysis?.jobPosted || 'Unknown',
            numberOfApplicants: j.job_ai_analysis?.numberOfApplicants,
            externalId: j.job_posts.externalId, // Using generic externalId instead of linkedinId
            originalUrl: j.job_posts.originalUrl,            source: j.job_sources?.name || 'Unknown source'
        };
    });    console.log("🌐 Opening results in browser...");
    showImportantInfoRowsInBrowser(importantInfoRows);
    
    // Keep the server running by waiting for user input
    console.log(`\n🌐 HTML report is now running. Press Enter to continue or Ctrl+C to exit...`);
    await new Promise<void>((resolve) => {
        process.stdin.once('data', () => {
            resolve();
        });
    });
    
    return importantInfoRows;
};

export function skillSubQuery(skills: string[]) {
    const query = db
        .select()
        .from(skillJobMappingTable)
        .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
        .where(
            and(
                eq(skillJobMappingTable.jobId, jobPostsTable.id),
                or(...skills.map(skill => ilike(skillTable.name, skill)))
            )
        );

    return query;
}

export function getFilteredJobs({
    includeJobsWithSkills,
    removeJobsWithSkills,    maxDaysOld = 7,
    maxYearsOfExperienceRequired: maxYearsOfExperience,
    includeInternships = false,
    acceptableSeniorityLevels = ['lead', 'senior', 'mid', 'junior'],
    acceptablePosition = ['frontend', 'backend', 'full-stack'],
    includeJobsWithoutSkills = false,
    includeJobsWithNullExperience = false,
    relaxSkillRequirements = false
}: {
    includeJobsWithSkills: string[],
    removeJobsWithSkills: string[],
    maxDaysOld?: number,
    maxYearsOfExperienceRequired?: number,
    includeInternships?: boolean,
    acceptableSeniorityLevels?: ('lead' | 'senior' | 'mid' | 'junior')[],
    acceptablePosition: ('frontend' | 'backend' | 'full-stack')[],
    includeJobsWithoutSkills?: boolean,
    includeJobsWithNullExperience?: boolean,
    relaxSkillRequirements?: boolean
}) {
    // Calculate cutoff date for maxDaysOld
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysOld);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = db
        .select({
            job_posts: jobPostsTable,
            job_ai_analysis: jobAiAnalysisTable,
            job_sources: jobSourcesTable
        })
        .from(jobPostsTable)
        .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, jobPostsTable.id))
        .leftJoin(jobSourcesTable, eq(jobSourcesTable.id, jobPostsTable.sourceId))
        .where(
            and(
                maxYearsOfExperience
                    ? or(
                        isNull(jobAiAnalysisTable.yearsOfExperienceExpected),
                        lt(jobAiAnalysisTable.yearsOfExperienceExpected, maxYearsOfExperience)
                    )
                    : undefined,                // Skill filtering - be more relaxed if relaxSkillRequirements is true
                includeJobsWithSkills.length && !relaxSkillRequirements ? exists(skillSubQuery(includeJobsWithSkills)) : undefined,
                removeJobsWithSkills.length && !relaxSkillRequirements ? not(exists(skillSubQuery(removeJobsWithSkills))) : undefined,
                includeInternships ? undefined : and(
                    not(ilike(jobPostsTable.jobDetails, '%internship%')),
                    or(
                        isNull(jobAiAnalysisTable.isInternship),
                        eq(jobAiAnalysisTable.isInternship, false)
                    )
                ),
                or(
                    inArray(jobAiAnalysisTable.seniorityLevel, acceptableSeniorityLevels),
                    isNull(jobAiAnalysisTable.seniorityLevel)
                ),
                acceptablePosition.length ? or(
                    inArray(jobAiAnalysisTable.developmentSide, acceptablePosition), // Fixed typo
                    isNull(jobAiAnalysisTable.developmentSide)
                ) : undefined,
                maxDaysOld ? or(
                    isNull(jobAiAnalysisTable.jobPosted),
                    gt(jobAiAnalysisTable.jobPosted, cutoffDateStr)
                ) : undefined,
            )
        ).orderBy(desc(jobAiAnalysisTable.jobPosted));

    return query;
}
