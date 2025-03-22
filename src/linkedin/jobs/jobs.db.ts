import { db } from "db";
import {
  jobPostInSearch,
  LinkedinJobPost,
  linkedInJobPostsTable,
  linkedinJobSearch
} from "db/schema/linkedin/linkedin-schema";
import { asc } from 'drizzle-orm';

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
  top = 50
}:{
  skip?: number,
  top?: number
  }): Promise<LinkedinJobPost[]> =>{
  return db
    .select()
    .from(linkedInJobPostsTable)
    .orderBy(asc(linkedInJobPostsTable.id))
    .limit(top)
    .offset(skip)
    .execute();
}