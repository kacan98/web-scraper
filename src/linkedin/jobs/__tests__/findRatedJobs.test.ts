import { getRatedJobIds, karelSkillMap, findRatedJobsForKarel } from '../findRatedJobs';
import { db, dbAvailable } from 'db';
import { linkedInJobPostsTable, skillTable, skillJobMappingTable, jobAiAnalysisTable } from 'db/schema/linkedin/linkedin-schema';
import { eq } from 'drizzle-orm';

describe('findRatedJobs - Integration Tests', () => {
  beforeAll(async () => {
    // Check if database is available before running tests
    const isDbAvailable = await dbAvailable();
    if (!isDbAvailable) {
      console.warn('Database not available - skipping integration tests');
    }
  });

  describe('karelSkillMap', () => {    it('should have the expected skills and ratings', () => {
      expect(karelSkillMap).toEqual({
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
      });
    });    it('should contain mostly positive skill ratings', () => {
      const positiveSkills = Object.values(karelSkillMap).filter(rating => rating > 0);
      expect(positiveSkills.length).toBeGreaterThan(0);
      Object.values(karelSkillMap).forEach(rating => {
        expect(typeof rating).toBe('number');
      });
    });

    it('should have skill names as strings', () => {
      Object.keys(karelSkillMap).forEach(skillName => {
        expect(typeof skillName).toBe('string');
        expect(skillName.length).toBeGreaterThan(0);
      });
    });    it('should have exactly 13 skills defined', () => {
      expect(Object.keys(karelSkillMap)).toHaveLength(13);
    });    it('should include high-priority skills with rating 10 or higher', () => {
      const highPrioritySkills = Object.entries(karelSkillMap)
        .filter(([_, rating]) => rating >= 10)
        .map(([skill, _]) => skill);
      
      expect(highPrioritySkills).toContain('TypeScript');
      expect(highPrioritySkills).toContain('Angular');
      expect(highPrioritySkills).toContain('Node.js');
      expect(highPrioritySkills).toContain('JavaScript');
      expect(highPrioritySkills).toContain('Playwright');
    });

    it('should have skill ratings in expected ranges', () => {
      Object.entries(karelSkillMap).forEach(([skill, rating]) => {
        expect(typeof rating).toBe('number');
        // Most skills should be positive, with some exceptions like PHP
        if (skill === 'PHP') {
          expect(rating).toBeLessThan(0);
        } else {
          expect(rating).toBeGreaterThan(0);
          expect(rating).toBeLessThanOrEqual(25); // Extended range for new ratings
        }
      });
    });
  });

  describe('getRatedJobIds - Database Integration', () => {
    beforeEach(async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping database test - database not available');
        return;
      }
    });

    it('should execute without throwing errors with simple skill set', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const simpleSkills = { "TypeScript": 8, "JavaScript": 7 };
      
      await expect(getRatedJobIds(simpleSkills)).resolves.not.toThrow();
    });

    it('should return an array of job results', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const simpleSkills = { "TypeScript": 8, "JavaScript": 7 };
      const result = await getRatedJobIds(simpleSkills);
      
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return job results with expected structure', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const simpleSkills = { "TypeScript": 8, "JavaScript": 7 };
      const result = await getRatedJobIds(simpleSkills);
      
      if (result.length > 0) {
        const firstJob = result[0];
        expect(firstJob).toHaveProperty('id');
        expect(firstJob).toHaveProperty('linkedinId');
        expect(firstJob).toHaveProperty('rating');
        expect(firstJob).toHaveProperty('title');
        expect(firstJob).toHaveProperty('location');
        expect(typeof firstJob.rating).toBe('number');
        expect(typeof firstJob.title).toBe('string');
      }
    });

    it('should work with karel skill map', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      await expect(getRatedJobIds(karelSkillMap)).resolves.not.toThrow();
    });

    it('should handle empty skill set gracefully', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const emptySkills = {};
      await expect(getRatedJobIds(emptySkills)).resolves.not.toThrow();
    });

    it('should return results sorted by rating (highest first)', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const skills = { "TypeScript": 10, "JavaScript": 8 };
      const result = await getRatedJobIds(skills);
      
      if (result.length > 1) {
        for (let i = 0; i < result.length - 1; i++) {
          // Ratings should be in descending order
          expect(result[i].rating).toBeGreaterThanOrEqual(result[i + 1].rating);
        }
      }
    });
  });

  describe('Database Query Validation', () => {
    it('should verify database tables exist', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      // Test that we can query each table individually
      await expect(db.select().from(linkedInJobPostsTable).limit(1)).resolves.not.toThrow();
      await expect(db.select().from(skillTable).limit(1)).resolves.not.toThrow();
      await expect(db.select().from(skillJobMappingTable).limit(1)).resolves.not.toThrow();
      await expect(db.select().from(jobAiAnalysisTable).limit(1)).resolves.not.toThrow();
    });    it('should verify skills table has data for karel skills', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const karelSkillNames = Object.keys(karelSkillMap);
      let foundSkills = 0;
      
      for (const skillName of karelSkillNames) {
        const skillExists = await db
          .select()
          .from(skillTable)
          .where(eq(skillTable.name, skillName))
          .limit(1);
        
        if (skillExists.length > 0) {
          foundSkills++;
        } else {
          console.warn(`Skill '${skillName}' not found in database - this may affect results`);
        }
      }

      // We should find at least some of Karel's skills in the database
      expect(foundSkills).toBeGreaterThan(0);
    });

    it('should calculate ratings correctly based on skill values', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      // Test with a high-value skill
      const highValueSkills = { "TypeScript": 10 };
      const highResults = await getRatedJobIds(highValueSkills);
      
      // Test with a low-value skill  
      const lowValueSkills = { "TypeScript": 1 };
      const lowResults = await getRatedJobIds(lowValueSkills);
      
      // Jobs should be the same, but ratings should be different
      if (highResults.length > 0 && lowResults.length > 0) {
        const highJob = highResults.find(job => job.requiredSkills.includes('TypeScript'));
        const lowJob = lowResults.find(job => job.linkedinId === highJob?.linkedinId);
        
        if (highJob && lowJob) {
          expect(highJob.rating).toBeGreaterThan(lowJob.rating);
        }
      }
    });

    it('should return jobs with higher ratings when multiple skills match', async () => {
      const isDbAvailable = await dbAvailable();
      if (!isDbAvailable) {
        console.warn('Skipping test - database not available');
        return;
      }

      const multipleSkills = { "TypeScript": 8, "JavaScript": 7, "React": 6 };
      const results = await getRatedJobIds(multipleSkills);
      
      if (results.length > 1) {
        // Find a job that has multiple skills
        const multiSkillJob = results.find(job => 
          job.requiredSkills.filter(skill => Object.keys(multipleSkills).includes(skill)).length > 1
        );
        
        if (multiSkillJob) {
          // The rating should be at least the sum of the skills it has
          const matchingSkills = multiSkillJob.requiredSkills.filter(skill => 
            Object.keys(multipleSkills).includes(skill)
          );          const expectedMinRating = matchingSkills.reduce((sum, skill) => 
            sum + (multipleSkills[skill as keyof typeof multipleSkills] || 0), 0
          );
          
          expect(multiSkillJob.rating).toBeGreaterThanOrEqual(expectedMinRating);
        }
      }
    });
  });
});
