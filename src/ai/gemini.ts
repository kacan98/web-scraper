import { GoogleGenerativeAI } from "@google/generative-ai";
import "dotenv/config";
import { z } from "zod";
import { zodToJsonSchema } from "./ai-cmd";

export const GEMIN_API_KEY = process.env.GEMIN_API_KEY;
if (!GEMIN_API_KEY) {
  throw new Error("GEMIN_API_KEY is not defined");
}

const genAI = new GoogleGenerativeAI(GEMIN_API_KEY);

export const askGemini = async (prompt: string) => {
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent(prompt);
  return result.response.text();
};