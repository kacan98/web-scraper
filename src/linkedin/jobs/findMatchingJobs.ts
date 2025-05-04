import { db } from "db";
import { linkedInJobPostsTable, skillTable, skillJobMappingTable, jobAiAnalysisTable } from "db/schema/linkedin/linkedin-schema";
import { and, desc, eq, exists, inArray, isNull, lt, not, or } from "drizzle-orm";
import { ilike } from "drizzle-orm";
import { showImportantInfoRowsInBrowser } from "./showJobsInHtmlReport";

export const findMatchingJobsForKarel = async () => {
    const jobs = await getFilteredJobs({
        includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript", 'x++'],
        removeJobsWithSkills: ["Java", "AWS", "Python", "Ruby", "PHP", "Kotlin", "Golang", "Scala", "Rust", "Swift", "Objective-C", "Ruby on Rails"],
        acceptableSeniorityLevels: ['mid', 'junior', 'senior'],
        maxYearsOfExperienceRequired: 4,
        includeInternships: false,
        acceptablePosition: ['frontend', 'full-stack'],
    });

    console.log('Found jobs: ', jobs.length);
    const importantInfoRows = (jobs.map((j) => {
        return {
            title: j.job_posts.title,
            location: j.job_posts.location,
            skills: j.job_posts.skills,
            yearsOfExperienceExpected: j.job_ai_analysis?.yearsOfExperienceExpected,
            seniorityLevel: j.job_ai_analysis?.seniorityLevel,
            decelopmentSide: j.job_ai_analysis?.decelopmentSide,
            workModel: j.job_ai_analysis?.workModel,
            jobSumary: j.job_ai_analysis?.jobSummary,
            jobPosted: j.job_ai_analysis?.jobPosted
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
                maxDaysOld ? lt(jobAiAnalysisTable.jobPosted, new Date(Date.now() - maxDaysOld * 24 * 60 * 60 * 1000).toISOString()) : undefined,
            )
        ).orderBy(desc(jobAiAnalysisTable.jobPosted))

    return query;
}