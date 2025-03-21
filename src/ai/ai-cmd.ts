import { SchemaType } from "@google/generative-ai";
import { FromSchema } from "json-schema-to-ts";
import { getJobs } from "src/linkedin/jobs/jobs.db";
import {
  extractJobInfoWithGemini
} from "./gemini";
import { JobExtractionSchema } from "./gemini.model";

export enum AISource {
  Gemini = 'gemini',
  OpenAi = 'openAi'
}

export const analyzeLinkedInJobs = async () => {
  const jobs = await getJobsToAnalyze();
  for (const j of jobs) {
    const jobInfo: JobExtractionSchema = await extractJobInfoWithGemini(JSON.stringify(j), JobExtractionSchema as any);
    console.log("jobInfo: ", jobInfo);
  }
};

export const getJobsToAnalyze = () => {
  return getJobs({ top: 1 });
};