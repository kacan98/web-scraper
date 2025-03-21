import { GoogleGenerativeAI, Schema } from "@google/generative-ai";
import "dotenv/config";

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

export const extractJobInfoWithGemini = async (jobPost: string, schema: Schema) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    }
  });

  const prompt = `
    Extract information from job post: ${jobPost}.`

  const result = await model.generateContent(prompt);
  const textResult = result.response.text();
  const jsonResult = JSON.parse(textResult);
  return jsonResult;
}