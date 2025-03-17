import { db } from "db";
import {
  jobPostInSearch,
  LinkedinJobPost,
  linkedInJobPostsTable,
  LinkedinJobSearch,
  linkedinJobSearch,
} from "db/schema/linkedin/linkedin-schema";
import { QueryResult } from "pg";
import { log } from "src/utils";

export const saveLinkedinJobInDb = async (job: LinkedinJobPost) => {
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
