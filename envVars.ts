export const DEV_MODE = process.env.DEV_MODE && process.env.DEV_MODE != "false";
export const POSTGRES_USER = process.env.POSTGRES_USER;
export const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD;
export const POSTGRES_HOST = process.env.POSTGRES_HOST;
export const POSTGRES_OUTPUT_PORT = process.env.POSTGRES_OUTPUT_PORT;
export const POSTGRES_DB = process.env.POSTGRES_DB;
export const GEMIN_API_KEY = process.env.GEMIN_API_KEY;
export const LINKEDIN_LOGIN = process.env.LINKEDIN_LOGIN;
export const LINKEDIN_PASSWORD = process.env.LINKEDIN_PASSWORD;
export const IG_LOGIN = process.env.IG_LOGIN;
export const IG_PASSWORD = process.env.IG_PASSWORD;
export const IG_USERNAME = process.env.IG_USERNAME;
export const POSTGRES_SSH_REQUIRED = process.env.POSTGRES_SSH_REQUIRED == "true" || process.env.POSTGRES_SSH_REQUIRED == "1";

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