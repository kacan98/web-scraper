import { getJobById, getJobIds } from "src/linkedin/jobs/jobs.db";
import { logProgress } from "src/utils";
import {
  extractJobInfoWithGemini
} from "./gemini";
import { geminiModels } from "./gemini.model";
import { insertAIAnalysis } from "src/linkedin/jobs/ai-job-analysis.db";
import Bottleneck from "bottleneck";

export enum AISource {
  Gemini = 'gemini',
  OpenAi = 'openAi'
}

export const analyzeLinkedInJobs = async (onlyJobsWithoutAnalysis = true) => {
  // For debugging
  const maxJobs: number | undefined = undefined;
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

  // Configure rate limiter
  const minTime = 60000 / limitPerMinute; // Time between requests in ms
  const maxConcurrent = 5; // Adjust based on API concurrency limits if specified

  const limiter = new Bottleneck({
    minTime: minTime,
    maxConcurrent: maxConcurrent
  });

  let completed = 0;
  const total = jobIds.length;

  // Process all jobs concurrently
  const processJob = async (jobId: number) => {
    try {
      const job = await getJobById(jobId);
      const jobInfo = await limiter.schedule(() => extractJobInfoWithGemini(job, modelProperties.apiName));

      // Validate mandatory fields
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
        // Required fields
        postLanguage: jobInfo.postLanguage,
        jobSummary: jobInfo.jobSummary,
        skillsRequired: jobInfo.skillsRequired,
        skillsOptional: jobInfo.skillsOptional,
        isInternship: jobInfo.isInternship,
        // Optional fields
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
    } catch (error) {
      console.error(`Error processing job ${jobId}:`, error);
    } finally {
      completed++;
      logProgress(completed, total, 1, 'jobs processed with AI');
    }
  };

  await Promise.all(jobIds.map(processJob));
  console.log('Done - All jobs have been processed.');
};