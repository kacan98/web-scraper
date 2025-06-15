import { getOrCreateJobSource } from "../src/jobs/generic/job-db";

export const initializeJobSources = async () => {
  console.log("🔄 Initializing job sources...");
  
  try {
    // Create job sources
    const linkedin = await getOrCreateJobSource(
      'linkedin', 
      'https://www.linkedin.com',
      'LinkedIn professional network - the world\'s largest professional social media platform'
    );
    console.log(`✅ LinkedIn source initialized: ID ${linkedin.id}`);

    const jobindex = await getOrCreateJobSource(
      'jobindex',
      'https://www.jobindex.dk',
      'JobIndex.dk - Danish job portal with thousands of job postings'
    );
    console.log(`✅ JobIndex source initialized: ID ${jobindex.id}`);

    console.log("🎉 Job sources initialization completed successfully!");
    
    return { linkedin, jobindex };
  } catch (error) {
    console.error("❌ Error initializing job sources:", error);
    throw error;
  }
};

// Run if this file is executed directly
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check if this file is being run directly
if (process.argv[1] === __filename) {
  initializeJobSources()
    .then(() => {
      console.log("Database initialization completed.");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Database initialization failed:", error);
      process.exit(1);
    });
}
