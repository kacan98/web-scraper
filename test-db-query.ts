import { db } from "db";
import { jobPostsTable, jobSourcesTable } from "db/schema/generic/job-schema";
import { sql } from "drizzle-orm";

async function testDatabaseQueries() {
  console.log("🔍 Testing database queries...");
  
  try {
    // Test basic connection
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log("✅ Database connection works");
      // Check job sources
    const sources = await db.select().from(jobSourcesTable).limit(5);
    console.log(`📊 Found ${sources.length} job sources:`);
    sources.forEach(source => {
      console.log(`  - ${source.name} (${source.baseUrl})`);
    });
    
    // Check recent jobs
    const recentJobs = await db.select().from(jobPostsTable).limit(10);
    console.log(`📋 Found ${recentJobs.length} recent jobs:`);
    recentJobs.forEach(job => {
      console.log(`  - ${job.title} at ${job.company} (ID: ${job.id})`);
    });
      // Count total jobs
    const totalJobsResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${jobPostsTable}`);
    const totalJobs = totalJobsResult.rows?.[0] || { count: 'unknown' };
    console.log(`📈 Total jobs in database: ${(totalJobs as any).count}`);
    
  } catch (error) {
    console.error("❌ Database query failed:", error);
  }
  
  process.exit(0);
}

testDatabaseQueries();
