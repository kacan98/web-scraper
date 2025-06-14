import { db } from "db";
import { jobAiAnalysisTable, linkedInJobPostsTable, skillJobMappingTable, skillTable } from "db/schema/linkedin/linkedin-schema";
import { and, desc, eq, exists, gt, ilike, inArray, isNull, lt, not, or } from "drizzle-orm";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport";

// Function to get skills for a specific job
const getSkillsForJob = async (jobId: number) => {
    const skills = await db
        .select({
            name: skillTable.name,
            isRequired: skillJobMappingTable.isRequired
        })
        .from(skillJobMappingTable)
        .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
        .where(eq(skillJobMappingTable.jobId, jobId));

    return {
        required: skills.filter(s => s.isRequired).map(s => s.name),
        optional: skills.filter(s => !s.isRequired).map(s => s.name)
    };
};

export const findMatchingJobsForKarel = async () => {
    const jobs = await getFilteredJobs({
        includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript", 'x++'],
        removeJobsWithSkills: ["Java", "AWS", "Python", "Ruby", "PHP", "Kotlin", "Golang", "Scala", "Rust", "Swift", "Objective-C", "Ruby on Rails"],
        acceptableSeniorityLevels: ['mid', 'junior', 'senior'],
        maxYearsOfExperienceRequired: 4,
        includeInternships: false,
        acceptablePosition: ['frontend', 'full-stack'],
        maxDaysOld: 5,
    });

    // Create enhanced info rows for display with cleaner, more relevant data
    const importantInfoRows = await Promise.all(jobs.map(async (j) => {
        const skills = await getSkillsForJob(j.job_posts.id);

        return {
            title: j.job_posts.title,
            company: j.job_posts.company,
            location: j.job_posts.location?.split('·')[0]?.trim() || j.job_posts.location, // Clean location
            requiredSkills: skills.required.join(', ') || 'Not specified',
            optionalSkills: skills.optional.slice(0, 5).join(', ') || 'None', // Limit to 5 to avoid clutter
            yearsExp: j.job_ai_analysis?.yearsOfExperienceExpected || 'Not specified',
            seniority: j.job_ai_analysis?.seniorityLevel || 'Not specified',
            position: j.job_ai_analysis?.decelopmentSide || 'Not specified',
            workModel: j.job_ai_analysis?.workModel || 'Not specified',
            summary: j.job_ai_analysis?.jobSummary || 'No summary available',
            posted: j.job_ai_analysis?.jobPosted || 'Unknown',
            linkedinId: j.job_posts.linkedinId,
        }
    }));

    showImportantInfoRowsInBrowser(importantInfoRows);
}

export function skillSubQuery(skills: string[]) {
    const query = db
        .select()
        .from(skillJobMappingTable)
        .leftJoin(skillTable, eq(skillTable.id, skillJobMappingTable.skillId))
        .where(
            and(
                eq(skillJobMappingTable.jobId, linkedInJobPostsTable.id),
                or(...skills.map(skill => ilike(skillTable.name, skill)))
            )
        );

    return query;
}

export function getFilteredJobs({
    includeJobsWithSkills,
    removeJobsWithSkills,
    maxDaysOld = 7,
    maxYearsOfExperienceRequired: maxYearsOfExperience,
    includeInternships = false,
    acceptableSeniorityLevels = ['lead', 'senior', 'mid', 'junior'],
    acceptablePosition = ['frontend', 'backend', 'full-stack']
}: {
    includeJobsWithSkills: string[],
    removeJobsWithSkills: string[],
    maxDaysOld?: number,
    maxYearsOfExperienceRequired?: number,
    includeInternships?: boolean,
    acceptableSeniorityLevels?: ('lead' | 'senior' | 'mid' | 'junior')[],
    acceptablePosition: ('frontend' | 'backend' | 'full-stack')[]
}
) {
    // Calculate cutoff date for maxDaysOld
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxDaysOld);
    const cutoffDateStr = cutoffDate.toISOString();

    const query = db
        .select()
        .from(linkedInJobPostsTable)
        .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, linkedInJobPostsTable.id))
        .where(
            and(
                maxYearsOfExperience
                    ? or(
                        isNull(jobAiAnalysisTable.yearsOfExperienceExpected),
                        lt(jobAiAnalysisTable.yearsOfExperienceExpected, maxYearsOfExperience)
                    )
                    : undefined,
                includeJobsWithSkills.length ? exists(skillSubQuery(includeJobsWithSkills)) : undefined,
                removeJobsWithSkills.length ? not(exists(skillSubQuery(removeJobsWithSkills))) : undefined,
                includeInternships ? undefined : and(
                    not(ilike(linkedInJobPostsTable.jobDetails, '%internship%')),
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
                    inArray(jobAiAnalysisTable.decelopmentSide, acceptablePosition),
                    isNull(jobAiAnalysisTable.decelopmentSide)
                ) : undefined,
                maxDaysOld ? or(
                    isNull(jobAiAnalysisTable.jobPosted),
                    gt(jobAiAnalysisTable.jobPosted, cutoffDateStr)
                ) : undefined,
            )
        ).orderBy(desc(jobAiAnalysisTable.jobPosted))

    return query;
}