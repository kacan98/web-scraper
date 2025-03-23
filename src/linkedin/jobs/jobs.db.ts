import { db } from "db";
import {
  jobAIAnalysis,
  jobPostInSearch,
  LinkedinJobPost,
  linkedInJobPostsTable,
  linkedinJobSearch
} from "db/schema/linkedin/linkedin-schema";
import { and, asc, count, eq, exists, inArray, notExists } from 'drizzle-orm';

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

export const getJobById = async (jobId: number) => {
  return await db
    .select()
    .from(linkedInJobPostsTable)
    .where(eq(linkedInJobPostsTable.id, jobId))
    .execute().then(r=>r[0])
}

//count of jobs
export async function getJobIds(params: { onlyGetCount: true; onlyWithoutAnalysis?: boolean }): Promise<number>
//array of ids of jobs
export async function getJobIds(params: { skip?: number; top?: number; onlyWithoutAnalysis?: boolean; jobSearchIds?: number[]; onlyGetCount?: false }): Promise<number[]>;
export async function getJobIds({
  skip,
  top,
  onlyWithoutAnalysis = true,
  jobSearchIds,
  onlyGetCount = false
}: {
  skip?: number;
  top?: number;
  jobSearchIds?: number[];
  onlyWithoutAnalysis?: boolean;
  onlyGetCount?: boolean;
  }): Promise<number[] | number> {
  const baseQuery = onlyGetCount ? db.select({ count: count() }) : db.select({ id: linkedInJobPostsTable.id })

  const actualQuery = baseQuery.from(linkedInJobPostsTable)
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

  if (onlyGetCount) {
    return actualQuery.execute().then(r => {
      const result = r[0] as { count: number };
      return result.count;
    })
  } else {
    top = top ?? 50;
    skip = skip ?? 0;

    return actualQuery
      .orderBy(asc(linkedInJobPostsTable.id))
      .limit(top)
      .offset(skip)
      .execute()
      .then(r =>
        (r as { id: number }[]).map(j => j.id)
      );
  }
};