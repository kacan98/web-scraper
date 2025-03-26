import { db } from "db";
import { linkedInJobPostsTable, skillTable, skillJobMappingTable, jobAiAnalysisTable } from "db/schema/linkedin/linkedin-schema";
import { and, desc, eq, exists, inArray, isNull, lt, not, or } from "drizzle-orm";
import { ilike } from "drizzle-orm";

export const findMatchingJobs = async () => {
    const jobs = await getFilteredJobs({
        includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript"],
        removeJobsWithSkills: ["Java", "AWS", "Python", "Ruby", "PHP", "Kotlin", "Golang", "Scala", "Rust", "Swift", "Objective-C", ],
        acceptableSeniorityLevels: ['mid', 'junior'],
        maxYearsOfExperienceRequired: 4,
        includeInternships: false,
        acceptablePosition: ['frontend', 'full-stack'],
    });

    console.log('Found jobs: ', jobs.length);
    //log a random job
    const jobNumber = Math.floor(Math.random() * jobs.length);
    console.log('Here is job number: ', jobNumber);
    console.log(jobs[jobNumber]);
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
    maxDaysOld = 30,
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
                ) : undefined
            )
        ).orderBy(desc(jobAiAnalysisTable.jobPosted))

    console.log('getFilteredJobs', query.toSQL());

    return query;
}