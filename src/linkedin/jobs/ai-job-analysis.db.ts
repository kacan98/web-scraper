import { db } from "db";
import {
    jobAIAnalysis,
    JobAIAnalysis
} from "db/schema/linkedin/linkedin-schema";

export const insertJobAnalysis = async (analysis: JobAIAnalysis) => {
    return await db
        .insert(jobAIAnalysis)
        .values(analysis)
        .returning()
        .execute()
        .then((result) => result[0]);
}