export const DEV_MODE = process.env.DEV_MODE === "true" || process.env.DEV_MODE === "1";
// POSTGRES_USER
// POSTGRES_PASSWORD
// POSTGRES_HOST = 'localhost'

// POSTGRES_OUTPUT_PORT
// POSTGRES_DB
// GEMIN_API_KEY
// LINKEDIN_LOGIN
// LINKEDIN_PASSWORD
// IG_LOGIN
// IG_PASSWORD
export const POSTGRES_USER = process.env.POSTGRES_USER;
export const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
export const POSTGRES_HOST = process.env.POSTGRES_HOST || 'localhost';
export const POSTGRES_OUTPUT_PORT = process.env.POSTGRES_OUTPUT_PORT || '5432';
export const POSTGRES_DB = process.env.POSTGRES_DB || 'job-scraper';
export const GEMIN_API_KEY = process.env.GEMIN_API_KEY;
export const LINKEDIN_LOGIN = process.env.LINKEDIN_LOGIN;
export const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;
export const IG_LOGIN = process.env.IG_LOGIN;
export const IG_PASSWORD = process.env.IG_PASSWORD;
export const IG_USERNAME = process.env.IG_USERNAME;

export const validateLinkedInEnv = () => {
    if (!LINKEDIN_LOGIN) {
        throw new Error('LINKEDIN_LOGIN is not set');
    }
    
    if (!LINKEDIN_PASSWORD) {
        throw new Error('LINKEDIN_PASSWORD is not set');
    }

    if (!GEMIN_API_KEY) {
        throw new Error('GEMIN_API_KEY is not set');
    }
}