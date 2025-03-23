import { SchemaType } from "@google/generative-ai";
import { FromSchema } from "json-schema-to-ts";

export const GeminiJobExtractionSchema = {
    description: "Extracted job information schema",
    type: SchemaType.OBJECT,
    properties: {
        yearsOfExperienceExpected: {
            type: SchemaType.NUMBER,
            description: "The number of years of experience expected for the job",
            nullable: true,
        },
        numberOfApplicants: {
            type: SchemaType.NUMBER,
            nullable: true,
        },
        seniorityLevel: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["junior", "mid", "senior", "lead"],
            nullable: true,
        },
        decelopmentSide: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["frontend", "full-stack", "backend", "other"],
            nullable: true,
        },
        companyIndustry: {
            type: SchemaType.STRING,
            description: 'The industry of the job - e.g. "Tech", "Finance", "Healthcare"... etc.',
            nullable: true,
        },
        workModel: {
            type: SchemaType.STRING,
            format: "enum",
            enum: ["remote", "on-site", "hybrid", "other", "unknown"],
            nullable: true,
        },
        postLanguage: {
            type: SchemaType.STRING,
            description: 'The language the post is written in - e.g. "English", "Swedish"... etc.',
            nullable: false
        },
        salary: {
            type: SchemaType.STRING,
            description: "The salary range for the job, if available. Remember to include the currency.",
            nullable: true,
        },
        jobSummary: {
            type: SchemaType.STRING,
            description: "2-3 sentence, no bullshit summary of what the employee is going to be doing.",
            nullable: false
        },
        skillsRequired: {
            type: SchemaType.ARRAY,
            items: {
                description: "The skills or technology stack required for the job. I want this to be easy to search in the database so make it as specific as possible. E.g. put 'AWS' and 'Amazon Web Services' in the same array instead of having them in one entry as 'Amazon Web Services (AWS)'",
                type: SchemaType.STRING,
            },
            nullable: false
        },
        skillsOptional: {
            type: SchemaType.ARRAY,
            items: {
                description: "The skills or technology stack that is optional/nice to have for the job",
                type: SchemaType.STRING
            },
            nullable: false
        },
        postedDaysAgo: {
            type: SchemaType.NUMBER,
            description: "The number of days ago the job was posted",
            nullable: true
        }
    },
} as const;

export type GeminiExtractedJob = FromSchema<typeof GeminiJobExtractionSchema>;

export const geminiModels = {
    "Gemini 2.0 Flash": {
        apiName: "gemini-2.0-flash",
        requestsPerMinute: 15,
        tokensPerMinute: 1000000,
        requestsPerDay: 1500,
    },
    "Gemini 2.0 Flash Experimental": {
        apiName: "gemini-2.0-flash",
        requestsPerMinute: 10,
        tokensPerMinute: 1000000,
        requestsPerDay: 1500,
    },
    "Gemini 2.0 Flash-Lite": {
        apiName: "gemini-2.0-flash",
        requestsPerMinute: 30,
        tokensPerMinute: 1000000,
        requestsPerDay: 1500,
    },
    "Gemini 2.0 Pro Experimental 02-05": {
        apiName: "gemini-2.0-pro",
        requestsPerMinute: 2,
        tokensPerMinute: 1000000,
        requestsPerDay: 50,
    },
    "Gemini 2.0 Flash Thinking Experimental 01-21": {
        apiName: "gemini-2.0-flash-thinking",
        requestsPerMinute: 10,
        tokensPerMinute: 4000000,
        requestsPerDay: 1500,
    },
    "Gemini 1.5 Flash": {
        apiName: "gemini-1.5-flash",
        requestsPerMinute: 15,
        tokensPerMinute: 1000000,
        requestsPerDay: 1500,
    },
    "Gemini 1.5 Flash-8B": {
        apiName: "gemini-1.5-flash-8b",
        requestsPerMinute: 15,
        tokensPerMinute: 1000000,
        requestsPerDay: 1500,
    },
    "Gemini 1.5 Pro": {
        apiName: "gemini-1.5-pro",
        requestsPerMinute: 2,
        tokensPerMinute: 32000,
        requestsPerDay: 50,
    }
} as const;