import { db } from "db";
import {
  LinkedinJobPost,
  linkedInJobPostsTable,
} from "db/schema/linkedin/linkedin-schema";
import { log } from "src/utils";

export const saveLinkedinJobInDb = async (job: LinkedinJobPost) => {
  const result = await db
    .insert(linkedInJobPostsTable)
    .values(job)
    .onConflictDoUpdate({
      target: linkedInJobPostsTable.linkedinId,
      set: job,
    })
    .execute();
  if (result.rowCount === 1) {
    log("inserted job", job.title);
  } else {
    log("result of insert", result);
  }
};
