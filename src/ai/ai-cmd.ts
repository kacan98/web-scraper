import Bottleneck from "bottleneck";
import { getJobById, getJobIds, insertAIAnalysis } from "src/jobs/generic/ai-job-analysis";
import { logProgress } from "src/utils";
import {
  extractJobInfoWithGemini
} from "./gemini";
import { geminiModels } from "./gemini.model";

export enum AISource {
  Gemini = 'gemini',
  OpenAi = 'openAi'
}

export const analyzeJobsWithAI = async (onlyJobsWithoutAnalysis = true) => {
  console.log('🤖 Starting AI job analysis for all job sources...');
  // Get total count of jobs to analyze
  const totalJobs = await getJobIds({
    onlyWithoutAnalysis: onlyJobsWithoutAnalysis,
    onlyGetCount: true
  }) as number;

  if (totalJobs === 0) {
    console.log('✅ No jobs found that need AI analysis.');
    return;
  }

  console.log(`📊 Found ${totalJobs} jobs to analyze`);

  const model = geminiModels["Gemini 2.0 Flash-Lite"];
  const bottleneckLimiter = new Bottleneck({
    maxConcurrent: 3,
    minTime: Math.floor(60000 / model.requestsPerMinute) // Convert requests per minute to milliseconds
  });

  let processedCount = 0;
  let errorCount = 0;
  const batchSize = 50;

  for (let skip = 0; skip < totalJobs; skip += batchSize) {
    const jobIds = await getJobIds({
      skip,
      top: batchSize,
      onlyWithoutAnalysis: onlyJobsWithoutAnalysis,
    }) as number[];

    if (jobIds.length === 0) break;

    console.log(`\n🔄 Processing batch: jobs ${skip + 1}-${Math.min(skip + batchSize, totalJobs)} of ${totalJobs}`);

    // Process jobs in parallel with rate limiting
    const promises = jobIds.map(jobId =>
      bottleneckLimiter.schedule(async () => {
        try {
          const job = await getJobById(jobId);

          if (!job) {
            console.log(`⚠️  Job ${jobId} not found, skipping...`);
            return;
          }          // Extract job information using AI
          const rawAnalysis = await extractJobInfoWithGemini(job, model.apiName);
          // Convert null values to undefined and ensure proper types
          const analysis = {
            yearsOfExperienceExpected: rawAnalysis.yearsOfExperienceExpected ?? undefined,
            numberOfApplicants: rawAnalysis.numberOfApplicants ?? undefined,
            seniorityLevel: rawAnalysis.seniorityLevel ?? undefined,
            developmentSide: rawAnalysis.developmentSide ?? undefined,
            companyIndustry: rawAnalysis.companyIndustry ?? undefined,
            workModel: rawAnalysis.workModel ?? undefined,
            postLanguage: rawAnalysis.postLanguage || 'Unknown',
            salary: rawAnalysis.salary ?? undefined,
            postedDaysAgo: rawAnalysis.postedDaysAgo ?? undefined,
            jobSummary: rawAnalysis.jobSummary || 'No summary available',
            skillsRequired: rawAnalysis.skillsRequired || [],
            skillsOptional: rawAnalysis.skillsOptional || [],
            isInternship: rawAnalysis.isInternship || false,
            city: rawAnalysis.city ?? undefined
          };

          // Insert the analysis into database
          await insertAIAnalysis(jobId, analysis);

          processedCount++;

          logProgress(processedCount, totalJobs, 1, 'jobs analyzed');

        } catch (error) {
          errorCount++;
          console.error(`❌ Error analyzing job ${jobId}:`, error);
        }
      })
    );

    await Promise.all(promises);
  }

  console.log('\n🎉 AI job analysis completed!');
  console.log(`✅ Successfully analyzed: ${processedCount} jobs`);
  if (errorCount > 0) {
    console.log(`❌ Errors encountered: ${errorCount} jobs`);
  }
};

// Legacy function name for backwards compatibility
export const analyzeLinkedInJobs = analyzeJobsWithAI;