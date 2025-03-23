import { insertAIAnalysis } from "db/schema/linkedin/linkedin-schema";
import { getJobs } from "src/linkedin/jobs/jobs.db";
import {
  extractJobInfoWithGemini
} from "./gemini";
import { geminiModels } from "./gemini.model";
import { logProgress } from "src/utils";

export enum AISource {
  Gemini = 'gemini',
  OpenAi = 'openAi'
}

export const analyzeLinkedInJobs = async (maxJobs?: number) => {
  const jobsCount = await getJobs({ onlyGetCount: true });
  console.log('Total jobs to process:', jobsCount);

  const model: keyof typeof geminiModels = "Gemini 2.0 Flash-Lite";
  const modelProperties = geminiModels[model];
  const limitPerMinute = modelProperties.requestsPerMinute;

  let skip = 0;
  let hasMoreJobs = true;
  const requestTimestamps: number[] = []; // Tracks timestamps of recent requests

  while (hasMoreJobs) {
    logProgress(skip, jobsCount, 5, "jobs");

    // Check rate limit using sliding window
    const now = Date.now();
    // Remove timestamps older than 60 seconds
    while (requestTimestamps.length > 0 && now - requestTimestamps[0] >= 60000) {
      requestTimestamps.shift();
    }

    // If we've hit the limit, wait until the oldest request is 60s old
    if (requestTimestamps.length >= limitPerMinute) {
      const timeToWait = 60000 - (now - requestTimestamps[0]);
      if (timeToWait > 0) {
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
      // Recheck after waiting
      continue;
    }

    // Get one job at a time
    const jobs = await getJobs({ top: 1, skip: skip });

    // If no jobs returned, we're done
    if (jobs.length === 0 || (maxJobs && skip >= maxJobs)) {
      hasMoreJobs = false;
      continue;
    }

    // Process single job
    const j = jobs[0];
    const jobInfo = await extractJobInfoWithGemini(j, modelProperties.apiName);

    if (
      !jobInfo.postLanguage ||
      !jobInfo.jobSummary ||
      !jobInfo.skillsRequired ||
      !jobInfo.skillsOptional
    ) {
      throw new Error('Something is wrong with the data returned from Gemini');
    }

    await insertAIAnalysis(j.id, {
      // required
      postLanguage: jobInfo.postLanguage,
      jobSummary: jobInfo.jobSummary,
      skillsRequired: jobInfo.skillsRequired,
      skillsOptional: jobInfo.skillsOptional,

      // optional
      yearsOfExperienceExpected: jobInfo.yearsOfExperienceExpected ?? undefined,
      numberOfApplicants: jobInfo.numberOfApplicants ?? undefined,
      seniorityLevel: jobInfo.seniorityLevel ?? undefined,
      decelopmentSide: jobInfo.decelopmentSide ?? undefined,
      companyIndustry: jobInfo.companyIndustry ?? undefined,
      workModel: jobInfo.workModel ?? undefined,
      salary: jobInfo.salary ?? undefined,
      postedDaysAgo: jobInfo.postedDaysAgo ?? undefined,
    });

    // Record the request timestamp and move to next job
    requestTimestamps.push(Date.now());
    skip++;
  }
};