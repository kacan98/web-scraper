import { Page } from "playwright-core";
import { openPage } from "src/utils";
import { createNewJobSearch, getOrCreateJobSource } from "./generic/job-db";
import { scrapeJobsJobIndex } from "./jobindex/scrape-jobindex";
import { scrapeJobsLinkedin } from "./linkedin/scrape-linkedin";

export type JobSource = 'linkedin' | 'jobindex';

export interface ScrapeJobsParams {
  jobDescription: string;
  location: string;
  shouldLogin?: boolean;
  postsMaxAgeSeconds?: number;
  sources?: JobSource[];
}

export const scrapeJobsAllSources = async (initialPage: Page, params: ScrapeJobsParams) => {
  const {
    jobDescription,
    location,
    shouldLogin = false,
    postsMaxAgeSeconds,
    sources = ['linkedin'] // default to LinkedIn for backward compatibility
  } = params;

  // Initialize job sources in database
  await getOrCreateJobSource('linkedin', 'https://www.linkedin.com', 'LinkedIn professional network');
  await getOrCreateJobSource('jobindex', 'https://www.jobindex.dk', 'Danish job portal');

  const results: Record<JobSource, { success: boolean; error?: string; searchId?: number }> = {} as any;

  for (const source of sources) {
    try {
      console.log(`\n🔍 Starting scraping for ${source.toUpperCase()}`);
      
      // Create a new search record for this source
      const searchId = await createNewJobSearch(
        source,
        jobDescription,
        location,
        postsMaxAgeSeconds
      );

      // Create a new page for each source to avoid conflicts
      let page: Page;
      if (source === sources[0]) {
        // Use the initial page for the first source
        page = initialPage;
      } else {
        // Create a new page for subsequent sources
        page = await openPage();
      }

      switch (source) {
        case 'linkedin':
          try {
            await scrapeJobsLinkedin(page, {
              jobDescription,
              location,
              searchId,
              shouldLogin,
              postsMaxAgeSeconds
            });
          } catch (error) {
            if (error instanceof Error && (
              error.message.includes('closed') ||
              error.message.includes('Target page, context or browser has been closed') ||
              error.message.includes('Browser has been closed')
            )) {
              console.log(`⚠️ Browser was closed during ${source} scraping, but continuing with next source...`);
            } else {
              throw error; // Re-throw other errors
            }
          }
          break;
        
        case 'jobindex':
          try {
            await scrapeJobsJobIndex(page, {
              jobDescription,
              location,
              searchId,
              postsMaxAgeSeconds
            });
          } catch (error) {
            if (error instanceof Error && (
              error.message.includes('closed') ||
              error.message.includes('Target page, context or browser has been closed') ||
              error.message.includes('Browser has been closed')
            )) {
              console.log(`⚠️ Browser was closed during ${source} scraping, but continuing with next source...`);
            } else {
              throw error; // Re-throw other errors
            }
          }
          break;
        
        default:
          throw new Error(`Unsupported job source: ${source}`);
      }

      results[source] = { success: true, searchId };
      console.log(`✅ Successfully completed scraping for ${source.toUpperCase()}`);
        // Close the page if it's not the initial one
      if (source !== sources[0]) {
        try {
          await page.close();
        } catch (error) {
          // Ignore page close errors
        }
      }
      
    } catch (error) {
      console.error(`❌ Error scraping ${source.toUpperCase()}:`, error);
      results[source] = { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  // Close the initial page and browser after all sources are processed
  try {
    await initialPage.context().close();
  } catch (error) {
    console.log('Warning: Could not close browser context:', error);
  }

  return results;
};


