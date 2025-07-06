import { db } from "db";
import {
  JobPost,
  jobPostInSearchTable,
  jobPostsTable,
  jobSearchTable,
  JobSource,
  jobSourcesTable
} from "db/schema/generic/job-schema";
import { and, desc, eq, inArray } from "drizzle-orm";

// Job Sources management
export const getOrCreateJobSource = async (name: string, baseUrl: string, description?: string): Promise<JobSource> => {
  const existing = await db
    .select()
    .from(jobSourcesTable)
    .where(eq(jobSourcesTable.name, name))
    .execute();

  if (existing.length > 0) {
    return existing[0] as JobSource;
  }

  const result = await db
    .insert(jobSourcesTable)
    .values({ name, baseUrl, description })
    .returning()
    .execute();

  return result[0] as JobSource;
};

// Job posts management
export const saveJobInDb = async (
  job: Omit<JobPost, 'id' | 'dateScraped' | 'sourceId'>,
  sourceName: string
): Promise<{ insertedNewLine: boolean; upsertResult: JobPost }> => {
  // Get the source ID
  const source = await db
    .select()
    .from(jobSourcesTable)
    .where(eq(jobSourcesTable.name, sourceName))
    .execute()
    .then(r => r[0]);

  if (!source) {
    throw new Error(`Job source '${sourceName}' not found. Please create it first.`);
  }

  const jobWithSource = { ...job, sourceId: source.id };

  // Check if job already exists (by externalId + sourceId)
  const alreadyExists = await db
    .select({ id: jobPostsTable.id })
    .from(jobPostsTable)
    .where(
      and(
        eq(jobPostsTable.externalId, job.externalId),
        eq(jobPostsTable.sourceId, source.id)
      )
    )
    .execute()
    .then(r => r.length > 0);

  const upsertResult = await db
    .insert(jobPostsTable)
    .values(jobWithSource)
    .onConflictDoUpdate({
      target: [jobPostsTable.externalId, jobPostsTable.sourceId],
      set: jobWithSource,
    })
    .returning()
    .execute()
    .then((result) => result[0] as JobPost);

  return { insertedNewLine: !alreadyExists, upsertResult };
};

// Batch save jobs to reduce database load
export const saveJobsBatch = async (
  jobs: Omit<JobPost, 'id' | 'sourceId' | 'dateScraped'>[],
  sourceName: string
): Promise<{ newJobs: number, updatedJobs: number, totalProcessed: number }> => {
  if (jobs.length === 0) {
    return { newJobs: 0, updatedJobs: 0, totalProcessed: 0 };
  }

  const source = await getOrCreateJobSource(sourceName, `https://${sourceName}.com`);
  
  // Prepare all jobs with source ID
  const jobsWithSource = jobs.map(job => ({
    ...job,
    sourceId: source.id,
  }));

  // Check which jobs already exist in a single query
  const externalIds = jobs.map(job => job.externalId);
  const existingJobs = await db
    .select({
      externalId: jobPostsTable.externalId,
      id: jobPostsTable.id
    })
    .from(jobPostsTable)
    .where(
      and(
        inArray(jobPostsTable.externalId, externalIds),
        eq(jobPostsTable.sourceId, source.id)
      )
    )
    .execute();

  const existingExternalIds = new Set(existingJobs.map(job => job.externalId));
    let newJobs = 0;
  let updatedJobs = 0;

  // Process jobs individually to handle upserts properly
  for (const job of jobsWithSource) {
    try {
      // Try to insert first
      await db
        .insert(jobPostsTable)
        .values(job)
        .execute();
      newJobs++;
    } catch (error: any) {
      // If conflict (unique constraint violation), do update
      if (error.code === '23505') { // PostgreSQL unique violation
        await db
          .update(jobPostsTable)
          .set({
            title: job.title,
            company: job.company,
            location: job.location,
            jobDetails: job.jobDetails,
            skills: job.skills,
            originalUrl: job.originalUrl,
            dateScraped: new Date()
          })
          .where(
            and(
              eq(jobPostsTable.externalId, job.externalId),
              eq(jobPostsTable.sourceId, job.sourceId)
            )
          )
          .execute();
        updatedJobs++;
      } else {
        throw error; // Re-throw if it's not a unique constraint violation
      }
    }
  }

  console.log(`Batch saved: ${newJobs} new jobs, ${updatedJobs} updated jobs, ${jobsWithSource.length} total processed`);
  
  return { 
    newJobs, 
    updatedJobs, 
    totalProcessed: jobsWithSource.length 
  };
};

// Job search management
export const createNewJobSearch = async (
  sourceName: string,
  keywords: string,
  location: string,
  maxAgeSeconds?: number
): Promise<number> => {
  const source = await db
    .select()
    .from(jobSourcesTable)
    .where(eq(jobSourcesTable.name, sourceName))
    .execute()
    .then(r => r[0]);

  if (!source) {
    throw new Error(`Job source '${sourceName}' not found. Please create it first.`);
  }

  const result = await db
    .insert(jobSearchTable)
    .values({ 
      sourceId: source.id, 
      keywords, 
      location, 
      maxAgeSeconds,
      searchDate: new Date() 
    })
    .returning({ id: jobSearchTable.id })
    .execute();

  return result[0].id;
};

/**
 * Calculate the optimal search timeframe based on the last search in the database.
 * If the last search was less than 24 hours ago, default to 24 hours.
 * Otherwise, search for jobs posted since the last search.
 * @returns The number of seconds to search back from now
 */
export const calculateDynamicSearchTimeframe = async (): Promise<number> => {
  const DEFAULT_24_HOURS = 86400; // 24 hours in seconds
  
  try {
    // Get the most recent search across all sources
    const lastSearch = await db
      .select({
        searchDate: jobSearchTable.searchDate,
      })
      .from(jobSearchTable)
      .orderBy(desc(jobSearchTable.searchDate))
      .limit(1)
      .execute();

    if (!lastSearch || lastSearch.length === 0) {
      console.log('🔍 No previous searches found, defaulting to 24 hours');
      return DEFAULT_24_HOURS;
    }

    const lastSearchDate = new Date(lastSearch[0].searchDate);
    const now = new Date();
    const timeDifferenceMs = now.getTime() - lastSearchDate.getTime();
    const timeDifferenceSeconds = Math.floor(timeDifferenceMs / 1000);
    const timeDifferenceMinutes = Math.floor(timeDifferenceSeconds / 60);

    console.log(`⏰ Last search was ${timeDifferenceMinutes} minutes ago (${new Date(lastSearchDate).toLocaleString()})`);

    // If less than 24 hours ago, default to 24 hours
    if (timeDifferenceSeconds < DEFAULT_24_HOURS) {
      console.log('🔍 Last search was less than 24 hours ago, defaulting to 24 hours search timeframe');
      return DEFAULT_24_HOURS;
    }

    // Otherwise, search since the last search (with a small buffer to avoid missing jobs)
    const bufferMinutes = 5; // 5 minute buffer to ensure we don't miss anything
    const searchTimeframeSeconds = timeDifferenceSeconds + (bufferMinutes * 60);
    
    console.log(`🔍 Using dynamic timeframe: ${Math.floor(searchTimeframeSeconds / 60)} minutes (${Math.floor(searchTimeframeSeconds / 3600)} hours)`);
    
    return searchTimeframeSeconds;
  } catch (error) {
    console.error('Error calculating dynamic search timeframe:', error);
    console.log('🔍 Falling back to default 24 hours');
    return DEFAULT_24_HOURS;
  }
};

export const markJobAsInSearch = async (jobId: number, jobSearchId: number) => {
  await db
    .insert(jobPostInSearchTable)
    .values({ jobId, jobSearchId })
    .execute();
};

// Utility functions
export const getJobById = async (jobId: number): Promise<JobPost | undefined> => {
  return await db
    .select()
    .from(jobPostsTable)
    .where(eq(jobPostsTable.id, jobId))
    .execute()
    .then(r => r[0] as JobPost | undefined);
};

export const getJobsBySource = async (sourceName: string): Promise<JobPost[]> => {
  const source = await db
    .select()
    .from(jobSourcesTable)
    .where(eq(jobSourcesTable.name, sourceName))
    .execute()
    .then(r => r[0]);

  if (!source) {
    return [];
  }

  return await db
    .select()
    .from(jobPostsTable)
    .where(eq(jobPostsTable.sourceId, source.id))
    .execute() as JobPost[];
};
