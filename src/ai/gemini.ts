import { GoogleGenerativeAI } from "@google/generative-ai";
import { LinkedinJobPost } from "db/schema/linkedin/linkedin-schema";
import "dotenv/config";
import { GeminiExtractedJob, GeminiJobExtractionSchema, geminiModels } from "./gemini.model";


export const GEMIN_API_KEY = process.env.GEMIN_API_KEY;
if (!GEMIN_API_KEY) {
  throw new Error("GEMIN_API_KEY is not defined");
}

const genAI = new GoogleGenerativeAI(GEMIN_API_KEY);

export const askGemini = async (prompt: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
};

export const extractJobInfoWithGemini = async (jobPost: LinkedinJobPost, model: typeof geminiModels[keyof typeof geminiModels]['apiName']): Promise<GeminiExtractedJob> => {
  const client = genAI.getGenerativeModel({
    model, generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GeminiJobExtractionSchema as any,
    }
  });

  const prompt = `
    Extract information from job post:
    ${JSON.stringify(jobPost)}.
    `

  const result = await client.generateContent(prompt);
  const textResult = result.response.text();
  const jsonResult: GeminiExtractedJob = JSON.parse(textResult);
  return jsonResult;
}