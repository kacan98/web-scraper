import { db } from "db";
import { jobAiAnalysisTable, linkedInJobPostsTable } from "db/schema/linkedin/linkedin-schema";
import { count, eq, isNotNull } from "drizzle-orm";
import { getFilteredJobs } from "./findMatchingJobs";

/**
 * This script tests whether each filter criterion in the getFilteredJobs function
 * actually impacts the results returned.
 */

// Base parameters - same as in findMatchingJobsForKarel
const baseParams = {
    includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript", 'x++'],
    removeJobsWithSkills: ["Java", "AWS", "Python", "Ruby", "PHP", "Kotlin", "Golang", "Scala", "Rust", "Swift", "Objective-C", "Ruby on Rails"],
    acceptableSeniorityLevels: ['mid', 'junior', 'senior'] as ('mid' | 'junior' | 'senior')[],
    maxYearsOfExperienceRequired: 4,
    includeInternships: false,
    acceptablePosition: ['frontend', 'full-stack'] as ('frontend' | 'full-stack')[],
    maxDaysOld: 5,
};

// Function to count results for a given parameter set
async function countJobsWithParams(params: Parameters<typeof getFilteredJobs>[0]) {
    const jobs = await getFilteredJobs(params);
    return jobs.length;
}

// Function to test the impact of a specific parameter
async function testParameterImpact<K extends keyof typeof baseParams>(
    paramName: K, 
    newValue: typeof baseParams[K],
    expectedImpact: 'increase' | 'decrease' | 'same' | 'change' = 'change'
) {
    // Get count with base parameters
    const baseCount = await countJobsWithParams(baseParams);
    
    // Create modified parameters
    const modifiedParams = { ...baseParams };
    modifiedParams[paramName] = newValue;
    
    // Get count with modified parameters
    const modifiedCount = await countJobsWithParams(modifiedParams);
    
    // Determine if the parameter had an impact
    const hasImpact = baseCount !== modifiedCount;
    const actualImpact = modifiedCount > baseCount ? 'increase' : modifiedCount < baseCount ? 'decrease' : 'same';
    
    console.log(`Testing impact of '${paramName}':`);
    console.log(`  Base count: ${baseCount}`);
    console.log(`  Modified count (${JSON.stringify(newValue)}): ${modifiedCount}`);
    console.log(`  Impact: ${hasImpact ? 'YES' : 'NO'}`);
    console.log(`  Change direction: ${actualImpact}`);
    
    // Check if impact matches expected direction
    if (expectedImpact !== 'change' && actualImpact !== expectedImpact) {
        console.log(`  WARNING: Expected ${expectedImpact} but got ${actualImpact}`);
    }
    
    console.log('-------------------------------------------');
    
    return { hasImpact, baseCount, modifiedCount, actualImpact };
}

async function runAllTests() {
    console.log("TESTING CRITERIA IMPACT IN findMatchingJobsForKarel");
    console.log("=================================================");
    
    // Test includeJobsWithSkills (smaller list should reduce results)
    await testParameterImpact('includeJobsWithSkills', ["TypeScript"], 'decrease');
    
    // Test removeJobsWithSkills (empty list should increase results)
    await testParameterImpact('removeJobsWithSkills', [], 'increase');
    
    // Test maxDaysOld (smaller value should decrease results)
    await testParameterImpact('maxDaysOld', 1, 'decrease');
    
    // Test maxYearsOfExperienceRequired (lower value should decrease results)
    await testParameterImpact('maxYearsOfExperienceRequired', 2, 'decrease');
    
    // Test includeInternships (including them should increase results)
    await testParameterImpact('includeInternships', true, 'increase');
    
    // Test acceptableSeniorityLevels (fewer levels should decrease results)
    await testParameterImpact('acceptableSeniorityLevels', ['mid'], 'decrease');
    
    // Test acceptablePosition (fewer positions should decrease results)
    await testParameterImpact('acceptablePosition', ['frontend'], 'decrease');
    
    console.log("All tests completed!");
      // Get total job count for reference
    const totalJobs = await db.select({ count: count() }).from(linkedInJobPostsTable);
    console.log(`Total jobs in database: ${totalJobs[0].count}`);
    
    // Get total jobs with AI analysis
    const jobsWithAnalysis = await db.select({ count: count() })
        .from(linkedInJobPostsTable)
        .leftJoin(jobAiAnalysisTable, eq(jobAiAnalysisTable.jobId, linkedInJobPostsTable.id))
        .where(isNotNull(jobAiAnalysisTable.id));
    
    console.log(`Jobs with AI analysis: ${jobsWithAnalysis[0].count}`);
}

// Run the tests
runAllTests().catch(console.error);
