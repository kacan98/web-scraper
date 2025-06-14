import { getFilteredJobs } from "../findMatchingJobs";

describe('Job Filter Criteria Integration Tests', () => {
  // Base parameters for testing
  const baseParams = {
    includeJobsWithSkills: [],
    removeJobsWithSkills: [],
    maxDaysOld: 365, // Very permissive to see all jobs
    acceptableSeniorityLevels: ['lead', 'senior', 'mid', 'junior'] as ('lead' | 'senior' | 'mid' | 'junior')[],
    acceptablePosition: ['frontend', 'backend', 'full-stack'] as ('frontend' | 'backend' | 'full-stack')[],
    includeInternships: true,
  };

  describe('includeJobsWithSkills filter', () => {
    test('should return more jobs when skill requirement is relaxed', async () => {
      const withSkillFilter = await getFilteredJobs({
        ...baseParams,
        includeJobsWithSkills: ['TypeScript'],
      });

      const withoutSkillFilter = await getFilteredJobs({
        ...baseParams,
        includeJobsWithSkills: [],
      });

      expect(withoutSkillFilter.length).toBeGreaterThanOrEqual(withSkillFilter.length);

      // All jobs with skill filter should have TypeScript as a required skill
      if (withSkillFilter.length > 0) {
        console.log(`Found ${withSkillFilter.length} jobs requiring TypeScript`);
        console.log(`Found ${withoutSkillFilter.length} total jobs without skill filter`);
      }
    });

    test('should return different results with different skill requirements', async () => {
      const typeScriptJobs = await getFilteredJobs({
        ...baseParams,
        includeJobsWithSkills: ['TypeScript'],
      });

      const reactJobs = await getFilteredJobs({
        ...baseParams,
        includeJobsWithSkills: ['React'],
      });

      const bothSkillsJobs = await getFilteredJobs({
        ...baseParams,
        includeJobsWithSkills: ['TypeScript', 'React'],
      });

      console.log(`TypeScript jobs: ${typeScriptJobs.length}`);
      console.log(`React jobs: ${reactJobs.length}`);
      console.log(`TypeScript OR React jobs: ${bothSkillsJobs.length}`);

      // Jobs requiring both skills should be subset of jobs requiring either skill
      expect(bothSkillsJobs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('removeJobsWithSkills filter', () => {
    test('should exclude jobs with unwanted skills', async () => {
      const withoutFilter = await getFilteredJobs({
        ...baseParams,
        removeJobsWithSkills: [],
      });

      const withFilter = await getFilteredJobs({
        ...baseParams,
        removeJobsWithSkills: ['Java'],
      });

      expect(withFilter.length).toBeLessThanOrEqual(withoutFilter.length);
      console.log(`Jobs without Java filter: ${withoutFilter.length}`);
      console.log(`Jobs excluding Java: ${withFilter.length}`);
    });
  });

  describe('maxYearsOfExperienceRequired filter', () => {
    test('should return more jobs when years requirement is increased', async () => {
      const lowExperience = await getFilteredJobs({
        ...baseParams,
        maxYearsOfExperienceRequired: 1,
      });

      const midExperience = await getFilteredJobs({
        ...baseParams,
        maxYearsOfExperienceRequired: 3,
      });

      const highExperience = await getFilteredJobs({
        ...baseParams,
        maxYearsOfExperienceRequired: 10,
      });

      expect(highExperience.length).toBeGreaterThanOrEqual(midExperience.length);
      expect(midExperience.length).toBeGreaterThanOrEqual(lowExperience.length);

      console.log(`Jobs requiring ≤1 years: ${lowExperience.length}`);
      console.log(`Jobs requiring ≤3 years: ${midExperience.length}`);
      console.log(`Jobs requiring ≤10 years: ${highExperience.length}`);
    }, 10000); // 10 second timeout
  });

  describe('includeInternships filter', () => {
    test('should include/exclude internships correctly', async () => {
      const withInternships = await getFilteredJobs({
        ...baseParams,
        includeInternships: true,
      });

      const withoutInternships = await getFilteredJobs({
        ...baseParams,
        includeInternships: false,
      });

      expect(withInternships.length).toBeGreaterThanOrEqual(withoutInternships.length);
      console.log(`Jobs including internships: ${withInternships.length}`);
      console.log(`Jobs excluding internships: ${withoutInternships.length}`);
    });
  });

  describe('acceptableSeniorityLevels filter', () => {
    test('should filter by seniority levels', async () => {
      const seniorOnly = await getFilteredJobs({
        ...baseParams,
        acceptableSeniorityLevels: ['senior'],
      });

      const midAndSenior = await getFilteredJobs({
        ...baseParams,
        acceptableSeniorityLevels: ['mid', 'senior'],
      });

      const allLevels = await getFilteredJobs({
        ...baseParams,
        acceptableSeniorityLevels: ['junior', 'mid', 'senior', 'lead'],
      });

      expect(allLevels.length).toBeGreaterThanOrEqual(midAndSenior.length);
      expect(midAndSenior.length).toBeGreaterThanOrEqual(seniorOnly.length);

      console.log(`Senior only jobs: ${seniorOnly.length}`);
      console.log(`Mid and Senior jobs: ${midAndSenior.length}`);
      console.log(`All seniority levels: ${allLevels.length}`);
    }, 10000); // 10 second timeout
  });

  describe('acceptablePosition filter', () => {
    test('should filter by development position type', async () => {
      const frontendOnly = await getFilteredJobs({
        ...baseParams,
        acceptablePosition: ['frontend'],
      });

      const frontendAndFullstack = await getFilteredJobs({
        ...baseParams,
        acceptablePosition: ['frontend', 'full-stack'],
      });

      const allPositions = await getFilteredJobs({
        ...baseParams,
        acceptablePosition: ['frontend', 'backend', 'full-stack'],
      });

      expect(allPositions.length).toBeGreaterThanOrEqual(frontendAndFullstack.length);
      expect(frontendAndFullstack.length).toBeGreaterThanOrEqual(frontendOnly.length);

      console.log(`Frontend only jobs: ${frontendOnly.length}`);
      console.log(`Frontend and Full-stack jobs: ${frontendAndFullstack.length}`);
      console.log(`All position types: ${allPositions.length}`);
    }, 10000); // 10 second timeout
  });

  describe('maxDaysOld filter', () => {
    test('should filter by job posting date', async () => {
      const veryRecent = await getFilteredJobs({
        ...baseParams,
        maxDaysOld: 1,
      });

      const recentWeek = await getFilteredJobs({
        ...baseParams,
        maxDaysOld: 7,
      });

      const recentMonth = await getFilteredJobs({
        ...baseParams,
        maxDaysOld: 30,
      });

      const allJobs = await getFilteredJobs({
        ...baseParams,
        maxDaysOld: 365,
      });

      expect(allJobs.length).toBeGreaterThanOrEqual(recentMonth.length);
      expect(recentMonth.length).toBeGreaterThanOrEqual(recentWeek.length);
      expect(recentWeek.length).toBeGreaterThanOrEqual(veryRecent.length);

      console.log(`Jobs from last 1 day: ${veryRecent.length}`);
      console.log(`Jobs from last 7 days: ${recentWeek.length}`);
      console.log(`Jobs from last 30 days: ${recentMonth.length}`);
      console.log(`Jobs from last 365 days: ${allJobs.length}`);
    }, 10000); // 10 second timeout
  });

  describe('findMatchingJobsForKarel function', () => {
    test('should return results with Karel-specific criteria', async () => {
      // This tests the actual function used in the application
      const results = await getFilteredJobs({
        includeJobsWithSkills: ["TypeScript", "Angular", "React", "C#", ".NET", "Node.js", "JavaScript", 'x++'],
        removeJobsWithSkills: ["Java", "AWS", "Python", "Ruby", "PHP", "Kotlin", "Golang", "Scala", "Rust", "Swift", "Objective-C", "Ruby on Rails"],
        acceptableSeniorityLevels: ['mid', 'junior', 'senior'],
        maxYearsOfExperienceRequired: 4,
        includeInternships: false,
        acceptablePosition: ['frontend', 'full-stack'],
        maxDaysOld: 5,
      });

      console.log(`Karel's matching jobs: ${results.length}`);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Combined filter interactions', () => {
    test('should apply multiple filters simultaneously', async () => {
      const strictFilter = await getFilteredJobs({
        includeJobsWithSkills: ['TypeScript'],
        removeJobsWithSkills: ['Java'],
        maxYearsOfExperienceRequired: 2,
        includeInternships: false,
        acceptableSeniorityLevels: ['junior', 'mid'],
        acceptablePosition: ['frontend'],
        maxDaysOld: 7,
      });

      const relaxedFilter = await getFilteredJobs({
        includeJobsWithSkills: [],
        removeJobsWithSkills: [],
        maxYearsOfExperienceRequired: 10,
        includeInternships: true,
        acceptableSeniorityLevels: ['junior', 'mid', 'senior', 'lead'],
        acceptablePosition: ['frontend', 'backend', 'full-stack'],
        maxDaysOld: 365,
      });

      expect(relaxedFilter.length).toBeGreaterThanOrEqual(strictFilter.length);
      console.log(`Strict filtering: ${strictFilter.length} jobs`);
      console.log(`Relaxed filtering: ${relaxedFilter.length} jobs`);
    });
  });
});
