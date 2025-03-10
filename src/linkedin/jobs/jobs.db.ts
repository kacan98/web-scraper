import { db } from "db";
import { LinkedinJob } from "./get";
import { jobPostsTable } from "db/schema/linkedin/linkedin-schema";
import { log } from "src/utils";

export const saveLinkedinJobInDb = async (job: LinkedinJob) => {
    const { id, ...jobWithoutId } = job;
    const jobInsert: typeof jobPostsTable.$inferInsert = {
        ...jobWithoutId,
        linkedinId: id,
    };
    const result = await db.insert(jobPostsTable).values(jobInsert).execute();
    console.log('result: '+ result);
    log("inserted job", job.title);
}