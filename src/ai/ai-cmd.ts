import { z, number, string } from "zod";
import { askGemini } from "./gemini";
import { getJobs } from "src/linkedin/jobs/jobs.db";

export const analyzeLinkedInJobs = async () => {
  const jobs = await getJobsToAnalyze();
  for (const j of jobs) {
    const jobInfo = await extractInformationFromAJobPost(JSON.stringify(j));
    console.log("jobInfo: ", jobInfo);
  }
};

export const getJobsToAnalyze = () => {
  return getJobs({ top: 1 });
};

const ExtractedJobInfoSchema = z.object({
  yearsOfExperienceExpected: number().describe(
    "The number of years of experience expected for the job"
  ).optional(),
  numberOfApplicants: number().optional(),
  seniorityLevel: z.enum(["junior", "mid", "senior", "lead"]),
  jobType: z.enum(["frontend", "full-stack", "backend", "other"]),
  industry: string().describe(
    'The industry of the job - e.g. "Tech", "Finance", "Healthcare"... etc.'
  ).optional(),
  workModel: z.enum(["remote", "on-site", "hybrid", "other", "unknown"]),
  language: string().describe(
    'The language the post is written in - e.g. "English", "Swedish"... etc.'
  ),
  salary: string().optional(),
  interviewNotes: z
    .array(string())
    .describe("Key things to know before an interview"),
  techRequired: z
    .array(string())
    .describe("The tech stack required for the job"),
  techOptional: z
    .array(string())
    .describe("The tech stack that is optional for the job"),
});

export const zodToJsonSchema = <T extends z.ZodRawShape>(
  schema: z.ZodObject<T>
) => {
  const shape = schema.shape;
  const jsonSchema: Record<string, any> = { type: string, properties: {} };

  for (const key in shape) {
    const field = shape[key];
    jsonSchema.properties[key] = {
      type: field._def.typeName,
      description: field._def.description || "",
    };
  }

  return jsonSchema;
};

export type ExtractedJobInfo = z.infer<typeof ExtractedJobInfoSchema>;

export const extractInformationFromAJobPost = async (
  jobPost: string
): Promise<ExtractedJobInfo> => {
  let extractedInfo = await askGemini(`
    Extract information from job post: ${jobPost}.

    Make sure to return it in this format: ${zodToJsonSchema(
    ExtractedJobInfoSchema
    )}

    And in this format only! The result will be parsed so it will throw an error unless you return what is expected.
    My code will also throw an error if you leave out the required fields.
    If an option is an enum, make sure to return the exact value - e.g. "senior" not "Senior"!
  `);

  // Remove all characters until the first "{" at the beginngin
  const firstCurly = extractedInfo.indexOf("{");
  const lastCurly = extractedInfo.lastIndexOf("}");
  extractedInfo = extractedInfo.slice(firstCurly, lastCurly + 1);

  const parsedJson = JSON.parse(extractedInfo);

  const validatedInfo = ExtractedJobInfoSchema.parse(parsedJson);

  //TODO: Something like
//     const zodResponse = ExtractedJobInfoSchema.parseSafe(parsedJson);
//   let responseValid = zodResponse.success;
//   while(responseValid === false) {
//     //tell gemini about the errors so that it can fix it
//     const errors = zodResponse.;
//   }
  return validatedInfo;
};
