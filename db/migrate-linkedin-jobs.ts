/**
 * Migration script to move LinkedIn jobs from the old linkedin.job_posts table 
 * to the new generic jobs.job_posts table and consolidate data.
 */

import { db } from "db";
import { jobPostInSearchTable as genericJobPostInSearchTable, jobPostsTable, jobSearchTable, jobSourcesTable } from "db/schema/generic/job-schema";
import { jobPostInSearchTable, linkedInJobPostsTable, linkedinJobSearchTable } from "db/schema/linkedin/linkedin-schema";
import { and, eq } from "drizzle-orm";

export async function migrateLinkedInJobsToGeneric() {
  console.log("🔄 Starting migration of LinkedIn jobs to generic table...");

  try {
    // 1. Ensure LinkedIn job source exists
    console.log("📋 Ensuring LinkedIn job source exists...");
    let linkedinSource = await db
      .select()
      .from(jobSourcesTable)
      .where(eq(jobSourcesTable.name, 'linkedin'))
      .execute()
      .then(r => r[0]);

    if (!linkedinSource) {
      linkedinSource = await db
        .insert(jobSourcesTable)
        .values({
          name: 'linkedin',
          baseUrl: 'https://linkedin.com',
          description: 'LinkedIn job postings'
        })
        .returning()
        .execute()
        .then(r => r[0]);
      console.log("✅ Created LinkedIn job source");
    } else {
      console.log("✅ LinkedIn job source already exists");
    }

    // 2. Get all LinkedIn jobs from old table
    console.log("📊 Fetching LinkedIn jobs from old table...");
    const linkedinJobs = await db
      .select()
      .from(linkedInJobPostsTable)
      .execute();

    console.log(`📈 Found ${linkedinJobs.length} LinkedIn jobs to migrate`);

    if (linkedinJobs.length === 0) {
      console.log("✅ No LinkedIn jobs to migrate");
      return;
    }

    // 3. Check which jobs already exist in generic table
    const existingJobs = await db
      .select({
        externalId: jobPostsTable.externalId,
        id: jobPostsTable.id
      })
      .from(jobPostsTable)
      .where(eq(jobPostsTable.sourceId, linkedinSource.id))
      .execute();

    const existingExternalIds = new Set(existingJobs.map(job => job.externalId));
    console.log(`📋 Found ${existingJobs.length} jobs already in generic table`);

    // 4. Prepare jobs for migration (only new ones)
    const jobsToMigrate = linkedinJobs.filter(job => !existingExternalIds.has(job.linkedinId));
    console.log(`🔄 Migrating ${jobsToMigrate.length} new jobs`);

    if (jobsToMigrate.length > 0) {
      // Batch insert in chunks of 50
      const BATCH_SIZE = 50;
      let migratedCount = 0;

      for (let i = 0; i < jobsToMigrate.length; i += BATCH_SIZE) {
        const batch = jobsToMigrate.slice(i, i + BATCH_SIZE);
        
        const genericJobs = batch.map(job => ({
          title: job.title,
          company: job.company,
          location: job.location,
          jobDetails: job.jobDetails,
          skills: job.skills,
          externalId: job.linkedinId,
          sourceId: linkedinSource.id,
          originalUrl: `https://linkedin.com/jobs/view/${job.linkedinId}`,
          dateScraped: job.dateScraped
        }));

        await db
          .insert(jobPostsTable)
          .values(genericJobs)
          .execute();

        migratedCount += batch.length;
        console.log(`✅ Migrated batch: ${migratedCount}/${jobsToMigrate.length} jobs`);
      }
    }

    // 5. Migrate job searches
    console.log("🔄 Migrating LinkedIn job searches...");
    const linkedinSearches = await db
      .select()
      .from(linkedinJobSearchTable)
      .execute();

    console.log(`📊 Found ${linkedinSearches.length} LinkedIn searches to migrate`);

    const searchIdMap = new Map<number, number>();

    for (const search of linkedinSearches) {
      // Check if search already exists
      const existingSearch = await db
        .select()
        .from(jobSearchTable)
        .where(
          and(
            eq(jobSearchTable.sourceId, linkedinSource.id),
            eq(jobSearchTable.keywords, search.job),
            eq(jobSearchTable.location, search.location)
          )
        )
        .execute()
        .then(r => r[0]);

      let searchId: number;
      if (existingSearch) {
        searchId = existingSearch.id;
      } else {        const newSearch = await db
          .insert(jobSearchTable)
          .values({
            sourceId: linkedinSource.id,
            keywords: search.job,
            location: search.location,
            searchDate: search.date
          })
          .returning()
          .execute()
          .then(r => r[0]);
        searchId = newSearch.id;
      }

      searchIdMap.set(search.id, searchId);
    }

    console.log(`✅ Migrated ${linkedinSearches.length} job searches`);

    // 6. Migrate job-search relationships
    console.log("🔄 Migrating job-search relationships...");
    const jobSearchRelations = await db
      .select()
      .from(jobPostInSearchTable)
      .execute();

    console.log(`📊 Found ${jobSearchRelations.length} job-search relations to migrate`);

    for (const relation of jobSearchRelations) {
      // Find corresponding job in generic table
      const oldJob = await db
        .select()
        .from(linkedInJobPostsTable)
        .where(eq(linkedInJobPostsTable.id, relation.jobId))
        .execute()
        .then(r => r[0]);

      if (!oldJob) continue;

      const genericJob = await db
        .select()
        .from(jobPostsTable)
        .where(
          and(
            eq(jobPostsTable.externalId, oldJob.linkedinId),
            eq(jobPostsTable.sourceId, linkedinSource.id)
          )
        )
        .execute()
        .then(r => r[0]);

      if (!genericJob) continue;

      const newSearchId = searchIdMap.get(relation.jobSearchId);
      if (!newSearchId) continue;

      // Check if relation already exists
      const existingRelation = await db
        .select()
        .from(genericJobPostInSearchTable)
        .where(
          and(
            eq(genericJobPostInSearchTable.jobId, genericJob.id),
            eq(genericJobPostInSearchTable.jobSearchId, newSearchId)
          )
        )
        .execute()
        .then(r => r[0]);

      if (!existingRelation) {
        await db
          .insert(genericJobPostInSearchTable)
          .values({
            jobId: genericJob.id,
            jobSearchId: newSearchId
          })
          .execute();
      }
    }

    console.log(`✅ Migrated ${jobSearchRelations.length} job-search relationships`);

    console.log("🎉 Migration completed successfully!");
    console.log(`📈 Total jobs in generic table: ${(await db.select().from(jobPostsTable).execute()).length}`);

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

// Run migration if called directly
migrateLinkedInJobsToGeneric()
  .then(() => {
    console.log("✅ Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Migration script failed:", error);
    process.exit(1);
  });
