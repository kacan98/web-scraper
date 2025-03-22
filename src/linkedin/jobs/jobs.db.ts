import { db } from "db";
import {
  jobAIAnalysis,
  jobPostInSearch,
  LinkedinJobPost,
  linkedInJobPostsTable,
  linkedinJobSearch
} from "db/schema/linkedin/linkedin-schema";
import { asc, eq, isNull, inArray, and, notExists, exists } from 'drizzle-orm';
import { AnyPgSelect, PgSelect, PgSelectBase } from "drizzle-orm/pg-core";

export const saveLinkedinJobInDb = async (job: Omit<LinkedinJobPost, 'id'>) => {
  return await db
    .insert(linkedInJobPostsTable)
    .values(job)
    .onConflictDoUpdate({
      target: linkedInJobPostsTable.linkedinId,
      set: job,
    })
    .returning()
    .execute().then((result) => result[0]);
};

export const createNewJobSearch = async (job: string, location: string) => {
  const result = await db
    .insert(linkedinJobSearch)
    .values({ job, location, date: new Date() })
    .returning({ id: linkedinJobSearch.id })
    .execute();

  return result[0].id;
};

export const markJobAsInSearch = async (jobId: number, jobSearchId: number) => {
  await db.insert(jobPostInSearch).values({ jobId, jobSearchId }).execute();
};

export const getJobs = ({
  skip = 0,
  top = 50,
  onlyWithoutAnalysis = true,
  jobSearchIds,
}: {
  skip?: number;
  top?: number;
  jobSearchIds?: number[];
  onlyWithoutAnalysis?: boolean;
}): Promise<LinkedinJobPost[]> => {
  return db.select()
    .from(linkedInJobPostsTable)
    .where(and(
      onlyWithoutAnalysis ? notExists(
        db
          .select()
          .from(jobAIAnalysis)
          .where(eq(jobAIAnalysis.jobId, linkedInJobPostsTable.id))
      ) : undefined,
      (jobSearchIds && jobSearchIds.length > 0) ? exists(
        db
          .select()
          .from(jobPostInSearch)
          .where(and(
            eq(jobPostInSearch.jobId, linkedInJobPostsTable.id),
            inArray(jobPostInSearch.jobSearchId, jobSearchIds)
          ))
      )
        : undefined,
    ))
    .orderBy(asc(linkedInJobPostsTable.id))
    .limit(top)
    .offset(skip)
    .execute();
};