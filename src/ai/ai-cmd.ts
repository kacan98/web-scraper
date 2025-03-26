import { getJobById, getJobIds } from "src/linkedin/jobs/jobs.db";
import { logProgress } from "src/utils";
import {
  extractJobInfoWithGemini
} from "./gemini";
import { geminiModels } from "./gemini.model";
import { insertAIAnalysis } from "src/linkedin/jobs/ai-job-analysis.db";

export enum AISource {
  Gemini = 'gemini',
  OpenAi = 'openAi'
}

export const analyzeLinkedInJobs = async (onlyJobsWithoutAnalysis = true) => {
  //for debugging 👇
  const maxJobs: number | undefined = undefined;
  //for debugging 👆

  const jobIds = await getJobIds({ onlyWithoutAnalysis: onlyJobsWithoutAnalysis }).then(r => r.slice(0, maxJobs));
  const jobsToAnalyze = jobIds.length;
  
  if (jobsToAnalyze === 0) {
    console.log('No jobs to process. Exiting...');

    return;
  }

  console.log('Total jobs to process:', jobsToAnalyze);

  const model: keyof typeof geminiModels = "Gemini 2.0 Flash-Lite";
  const modelProperties = geminiModels[model];
  const limitPerMinute = modelProperties.requestsPerMinute;

  let index = 0;
  const requestTimestamps: number[] = []; // Tracks timestamps of recent requests

  for (let jobId of jobIds) {
    logProgress(index, jobsToAnalyze, 1, "jobs");

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

    const job = await getJobById(jobId);
    const jobInfo = await extractJobInfoWithGemini(job, modelProperties.apiName);

    //We don't 100% trust the AI so check that the mandatory fields are there:
    if (
      !jobInfo.postLanguage ||
      !jobInfo.jobSummary ||
      !jobInfo.skillsRequired ||
      !jobInfo.skillsOptional ||
      jobInfo.isInternship === undefined
    ) {
      throw new Error('Something is wrong with the data returned from the AI');
    }

    await insertAIAnalysis(job.id, {
      // required
      postLanguage: jobInfo.postLanguage,
      jobSummary: jobInfo.jobSummary,
      skillsRequired: jobInfo.skillsRequired,
      skillsOptional: jobInfo.skillsOptional,
      isInternship: jobInfo.isInternship,

      // optional
      yearsOfExperienceExpected: jobInfo.yearsOfExperienceExpected ?? undefined,
      numberOfApplicants: jobInfo.numberOfApplicants ?? undefined,
      seniorityLevel: jobInfo.seniorityLevel ?? undefined,
      decelopmentSide: jobInfo.decelopmentSide ?? undefined,
      companyIndustry: jobInfo.companyIndustry ?? undefined,
      workModel: jobInfo.workModel ?? undefined,
      salary: jobInfo.salary ?? undefined,
      postedDaysAgo: jobInfo.postedDaysAgo ?? undefined,
      city: jobInfo.city ?? undefined
    });

    // Record the request timestamp and move to next job
    requestTimestamps.push(Date.now());
    index++;
  }

  console.log('Done ✅ - All jobs have been processed.');
};