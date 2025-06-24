import { log } from "console";
import { JobPost } from "db/schema/generic/job-schema";
import { Page } from "playwright-core";
import {
  extractText,
  findFunctioningSelector,
  tryToFindElementsFromSelectors,
  waitForAtLeastOneSelector
} from "src/searchForElements";
import { sleepApprox } from "src/utils";
import { saveJobsBatch } from "../generic/job-db";

const THREE_MINUTES = 3 * 60 * 1000;

export const scrapeJobsJobIndex = async (
  page: Page,
  {
    jobDescription,
    location,
    searchId,
    postsMaxAgeSeconds
  }: {
    jobDescription: string;
    location: string;
    searchId: number;
    postsMaxAgeSeconds?: number;
  }
) => {
  page.setDefaultTimeout(THREE_MINUTES);

  log("Starting JobIndex scraping");

  await page.goto("https://www.jobindex.dk/");

  // Handle initial modals
  await closeModals(page);

  await search(page, jobDescription, location, postsMaxAgeSeconds);
  log("Search completed");  await page.waitForTimeout(3000); // wait for the page to load

  // Try to find job cards using common patterns
  let jobCardsSelector = await findFunctioningSelector(
    page,
    jobIndexSelectors.jobCard
  );

  if (!jobCardsSelector) {
    // If no job cards found, wait a bit more and try again
    await page.waitForTimeout(2000);
    jobCardsSelector = await findFunctioningSelector(
      page,
      jobIndexSelectors.jobCard
    );
    
    if (!jobCardsSelector) {
      throw new Error("No job cards found after search");
    }
  }

  let totalCardsFound = 0;
  let totalNewJobsFound = 0;
  let currentPage = 1;

  let morePagesExist = true;
  while (morePagesExist) {
    const { cardsFound, newJobsFound } = await scrapeAllJobsOnPage(
      page,
      jobCardsSelector,
      searchId,
      totalNewJobsFound
    );
    totalCardsFound += cardsFound;
    totalNewJobsFound += newJobsFound;
    log(
      `Found ${cardsFound} cards on this page. In total ${totalCardsFound} found so far out of which ${totalNewJobsFound} are new.`
    );

    const nextPage = await findNextPageAndNavigateToItIfItExists(
      page,
      currentPage
    );
    if (nextPage) {
      log("Going to page", nextPage);
      currentPage = nextPage;
    } else {
      log("No more pages found.");
      morePagesExist = false;
    }
  }

  log("Done. Found ", totalCardsFound, " cards and ", totalNewJobsFound, " new jobs.");
};

const endOfPageError = new Error('We likely got to the end of the page.');

const scrapeAllJobsOnPage = async (
  page: Page,
  cardSelector: string,
  searchId: number,
  newJobsFoundBefore: number
): Promise<{
  cardsFound: number;
  newJobsFound: number;
}> => {
  // First, try to close any modal that might be open
  await closeModals(page);

  let continueScrapingJobs = true;
  let cardsFoundOnCurrentPage = 0;
  const jobsToSave: Omit<JobPost, 'id' | 'dateScraped' | 'sourceId'>[] = [];
  
  while (continueScrapingJobs) {
    try {
      // Get all job cards on the page
      const jobCards = await page.$$(cardSelector);
      
      if (cardsFoundOnCurrentPage >= jobCards.length) {
        log("No more job cards to process on this page");
        break;
      }
      
      const currentJobCard = jobCards[cardsFoundOnCurrentPage];
      cardsFoundOnCurrentPage++;

      // Scroll to the job card
      await currentJobCard.hover();
      await page.mouse.wheel(0, 250);
      await sleepApprox(page, 1000, false, 'for scrolling');      // Find the job link within this card - prioritize JobIndex internal links
      const jobLinkSelectors = [
        'a[href*="/vis-job/"]',     // JobIndex job detail links
        'a[href*="/job/"]',         // Alternative job link pattern
        'a[href*="jobindex.dk/vis-job"]', // Full JobIndex job URLs
      ];
      let jobLink = null;
      
      // First try to find JobIndex internal job links
      for (const selector of jobLinkSelectors) {
        const links = await currentJobCard.$$(selector);
        for (const link of links) {
          const href = await link.getAttribute('href');
          // Make sure it's not a share link or other non-job link
          if (href && 
              !href.includes('facebook') && 
              !href.includes('linkedin') && 
              !href.includes('twitter') &&
              !href.includes('sharer') &&
              !href.includes('virksomhed') &&
              href.includes('job')) {
            jobLink = link;
            break;
          }
        }
        if (jobLink) break;
      }
      
      // If no direct job link found, look for the "Se jobbet" button or similar
      if (!jobLink) {
        const buttonSelectors = jobIndexSelectors.jobLinkInCard;
        for (const selector of buttonSelectors) {
          jobLink = await currentJobCard.$(selector);
          if (jobLink) break;
        }
      }
      
      // Last resort: look for external job site links
      if (!jobLink) {
        const allLinks = await currentJobCard.$$('a');
        for (const link of allLinks) {
          const href = await link.getAttribute('href');
          if (href && 
              !href.includes('facebook') &&
              !href.includes('linkedin') &&
              !href.includes('twitter') &&
              !href.includes('sharer') &&
              !href.includes('virksomhed') &&
              (href.includes('jobteam.dk') || 
               href.includes('hr-manager.net') || 
               href.includes('enaportal.com') ||
               href.includes('thehub.io') ||
               href.includes('candidate.') ||
               (href.startsWith('http') && !href.includes('jobindex.dk')))) {
            jobLink = link;
            break;
          }
        }
      }if (!jobLink) {
        log(`No job link found in card ${cardsFoundOnCurrentPage}, skipping...`);
        continue;
      }

      // Get job ID from the card's data attribute
      const jobId = await currentJobCard.getAttribute('data-jobad-tid') || `job-${cardsFoundOnCurrentPage}`;
      
      // Get the job URL
      const jobUrl = await jobLink.getAttribute('href');
      if (!jobUrl) {
        log(`No job URL found in card ${cardsFoundOnCurrentPage}, skipping...`);
        continue;
      }      try {
        // Visit the job detail page to get complete information
        const jobUrl = await jobLink.getAttribute('href');
        log(`📖 Visiting job detail page: ${jobUrl}`);
        
        // Store current page URL to return later
        const searchPageUrl = page.url();
        
        // Check if this is an external job site
        const isExternalSite = jobUrl && !jobUrl.includes('jobindex.dk');
          if (isExternalSite) {
          log(`🔗 External job site detected: ${jobUrl}`);
            try {
            // For external sites, navigate to them directly and extract info
            log(`📖 Attempting to extract detailed info from external site...`);
            
            // Store current page URL to return later
            const searchPageUrl = page.url();
            
            try {
              // Set a longer timeout for external sites
              page.setDefaultTimeout(20000);
              
              // Visit the external job page with more robust loading
              await page.goto(jobUrl, { 
                waitUntil: 'networkidle',
                timeout: 20000 
              });
              
              // Wait for dynamic content to load
              await page.waitForTimeout(5000);
              
              // Extract detailed job information from external site
              const detailedJobInfo = await extractJobDetailsFromPage(page, jobId, jobUrl);
              
              if (detailedJobInfo && detailedJobInfo.title && detailedJobInfo.company) {
                jobsToSave.push(detailedJobInfo);
                log(`✅ Extracted detailed external job info: ${detailedJobInfo.title} at ${detailedJobInfo.company}`);
              } else {
                // Fallback to basic info from card
                log(`⚠️ Could not extract detailed info, using basic info from card`);
                const basicJobInfo = await extractJobInfoFromCard(currentJobCard);
                if (basicJobInfo && basicJobInfo.title && basicJobInfo.company) {
                  const job = {
                    title: basicJobInfo.title,
                    company: basicJobInfo.company,
                    location: basicJobInfo.location || "",
                    jobDetails: basicJobInfo.description || "Job details available on external site",
                    skills: "",
                    externalId: jobId,
                    originalUrl: jobUrl || page.url()
                  };
                  jobsToSave.push(job);
                  log(`✅ Used fallback basic job info: ${job.title} at ${job.company}`);
                }
              }
              
              // Navigate back to the search page
              log(`🔙 Returning to search page: ${searchPageUrl}`);
              await page.goto(searchPageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
              await page.waitForTimeout(2000); // Wait for page to load
              
            } catch (navigationError) {
              log(`⚠️ Navigation error: ${navigationError}`);
              // Try to go back to search page
              try {
                await page.goto(searchPageUrl, { waitUntil: 'domcontentloaded' });
              } catch (backError) {
                log(`❌ Could not return to search page: ${backError}`);
                throw backError;
              }
              throw navigationError;
            }
            
          } catch (externalError) {
            log(`⚠️ Failed to extract from external site: ${externalError}`);
            // Fallback to basic info from card
            const basicJobInfo = await extractJobInfoFromCard(currentJobCard);
            if (basicJobInfo && basicJobInfo.title && basicJobInfo.company) {
              const job = {
                title: basicJobInfo.title,
                company: basicJobInfo.company,
                location: basicJobInfo.location || "",
                jobDetails: basicJobInfo.description || "Job details available on external site",
                skills: "",
                externalId: jobId,
                originalUrl: jobUrl || page.url()
              };
              jobsToSave.push(job);
              log(`✅ Extracted basic job info (fallback): ${job.title} at ${job.company}`);
            }
          }
          
        } else {
          // For JobIndex internal pages, visit and extract detailed info
          await jobLink.click();
          await page.waitForTimeout(3000); // Wait for navigation
          
          // Close any modals that might appear on the job page
          await closeModals(page);
          
          // Extract detailed job information
          const jobDetails = await extractJobDetailsFromPage(page, jobId, jobUrl || '');
          
          if (jobDetails) {
            jobsToSave.push(jobDetails);
            log(`✅ Extracted detailed job info: ${jobDetails.title} at ${jobDetails.company}`);
          } else {
            log(`❌ Failed to extract job details from ${jobUrl}`);
          }
          
          // Navigate back to search results
          await page.goBack();
          await page.waitForTimeout(2000); // Wait for page to load
          
          // Close any modals that might have appeared
          await closeModals(page);
        }
        
      } catch (error) {
        console.error(`Error processing job ${jobId}:`, error);
        // Try to get back to search results if we're lost
        try {
          await page.goBack();
          await page.waitForTimeout(1000);
        } catch (backError) {
          console.error("Failed to go back to search results:", backError);
        }
      }

    } catch (error: any) {
      if (error === endOfPageError) {
        log(endOfPageError.message);
      } else {
        console.error("Something went wrong with getting a job:", error);
        if (cardsFoundOnCurrentPage === 0)
          throw new Error("Something went wrong. No jobs found.");
      }
      continueScrapingJobs = false;
    }
  }

  // Batch save all jobs to reduce database operations
  let newJobsFound = 0;
  if (jobsToSave.length > 0) {
    log(`💾 Batch saving ${jobsToSave.length} jobs to database...`);
    const { newJobs, updatedJobs, totalProcessed } = await saveJobsBatch(jobsToSave, 'jobindex');
    newJobsFound = newJobs;
    
    log(`✅ Batch save complete: ${newJobs} new, ${updatedJobs} updated, ${totalProcessed} total`);
    
    // Mark all jobs as part of this search (we need individual job IDs for this, so we'll do it after batch save)
    // For now, we'll skip this step to minimize database operations
    // TODO: Implement batch markJobAsInSearch if needed
  }

  return { cardsFound: cardsFoundOnCurrentPage, newJobsFound };
};

const findNextPageAndNavigateToItIfItExists = async (
  page: Page,
  currentPageNumber: number
): Promise<undefined | number> => {
  const nextPageNumber = currentPageNumber + 1;
  
  // Try various patterns for next page buttons
  const nextPageSelectors = [
    `a[aria-label*="Page ${nextPageNumber}"]`,
    `a[href*="page=${nextPageNumber}"]`,
    'a[aria-label*="Next"]',
    'button[aria-label*="Next"]',
    '.pagination-next',
    '.next-page'
  ];

  for (const selector of nextPageSelectors) {
    const nextPageButton = await page.$(selector);
    if (nextPageButton) {
      await nextPageButton.click();
      await page.waitForTimeout(3000); // wait for the next page to load
      return nextPageNumber;
    }
  }
  
  console.log("No more pages found");
  return undefined;
};

const extractJob = async (page: Page): Promise<Omit<JobPost, 'id' | 'dateScraped' | 'sourceId'> | null> => {
  try {
    // Wait for job details to load
    await waitForAtLeastOneSelector(
      page,
      jobIndexSelectors.jobDetails.jobTitle
    );

    const { jobTitle, company, location, jobDetails } =
      await tryToFindElementsFromSelectors(
        page,
        {
          jobTitle: jobIndexSelectors.jobDetails.jobTitle,
          company: jobIndexSelectors.jobDetails.company,
          location: jobIndexSelectors.jobDetails.jobLocation,
          jobDetails: jobIndexSelectors.jobDetails.jobDetails,
        },
        {
          allOrNothing: false,
        }
      );

    const url = page.url();
    
    // Extract job ID from URL - JobIndex typically uses patterns like /job/ID or /job-ID
    const jobIdMatch = url.match(/\/job[\/\-](\d+)/i) || url.match(/jobid[=\:](\d+)/i);
    const jobId = jobIdMatch ? jobIdMatch[1] : url.split('/').pop() || url;

    const title = await extractText(jobTitle);
    const companyName = await extractText(company);
    
    if (!title || !companyName) {
      log("Missing required job data, skipping...");
      return null;
    }

    return {
      title,
      company: companyName,
      location: await extractText(location) || "",
      jobDetails: await extractText(jobDetails) || "",
      skills: "", // JobIndex might not have structured skills section
      externalId: jobId,
      originalUrl: url
    };
  } catch (error) {
    console.error("Error extracting job data:", error);
    return null;
  }
};

const extractJobInfoFromCard = async (jobCard: any): Promise<{
  title: string;
  company: string;
  location: string;
  description: string;
} | null> => {
  try {
    let title = "";
    let company = "";
    let location = "";
    
    // Get all text content first
    const fullText = await jobCard.textContent();
    const lines = fullText?.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0) || [];
    
    // Look for job title - usually the first significant link or heading
    const titleSelectors = ['h3', 'h4', '.job-title', '[class*="title"]'];
    for (const selector of titleSelectors) {
      const element = await jobCard.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 5) {
          title = text.trim();
          break;
        }
      }
    }
    
    // If no title found with selectors, look in links
    if (!title) {
      const titleLinks = await jobCard.$$('a:not(.btn):not([href*="virksomhed"])');
      for (const link of titleLinks) {
        const text = await link.textContent();
        const href = await link.getAttribute('href');
        
        if (text && text.trim().length > 10 && 
            href && 
            !href.includes('facebook') &&
            !href.includes('linkedin') &&
            !href.includes('gem') &&
            !href.includes('fejlmelding')) {
          title = text.trim();
          break;
        }
      }
    }
    
    // Look for company name - try company links first
    const companyLinks = await jobCard.$$('a[href*="virksomhed"]');
    for (const link of companyLinks) {
      const text = await link.textContent();
      if (text && text.trim()) {
        company = text.trim();
        break;
      }
    }
    
    // If no company found in links, look for company-like text
    if (!company) {
      // Look for text that appears to be a company name
      for (const line of lines) {
        if (line.length > 3 && 
            line.length < 60 && 
            !line.includes('Gem') && 
            !line.includes('Se jobbet') &&
            !line.includes('Ansøg') &&
            !line.toLowerCase().includes('developer') &&
            !line.toLowerCase().includes('programmer') &&
            !line.toLowerCase().includes('engineer') &&
            !line.toLowerCase().includes('jobs') &&
            !line.includes('TypeScript') &&
            !line.includes('København') &&
            line.includes(' ')) { // Companies usually have spaces
          company = line;
          break;
        }
      }
    }
    
    // Look for location information
    for (const line of lines) {
      if (line.toLowerCase().includes('københavn') || 
          line.toLowerCase().includes('copenhagen') ||
          line.toLowerCase().includes('aarhus') ||
          line.toLowerCase().includes('odense') ||
          line.toLowerCase().includes('aalborg')) {
        location = line;
        break;
      }
    }
    
    // If we still don't have a good title, try to extract it from the first meaningful line
    if (!title || title.length < 5) {
      for (const line of lines) {
        if (line.length > 10 && 
            line.length < 100 &&
            !line.includes('Gem') && 
            !line.includes('Se jobbet') &&
            !line.includes('Ansøg') &&
            !line.includes('©') &&
            line !== company) {
          title = line;
          break;
        }
      }
    }
    
    return {
      title: title || "Unknown Job",
      company: company || "Unknown Company", 
      location: location,
      description: fullText?.substring(0, 500) || "" // First 500 chars as description
    };
    
  } catch (error) {
    console.error("Error extracting job info from card:", error);
    return null;
  }
};

// JobIndex selectors - Updated based on detailed site analysis
export const jobIndexSelectors = {
  searchInput: [
    'input[placeholder*="job"]',
    'input[aria-label*="job"]',
    'input[type="search"]',
    '.jobsearch-frontpage__input--general'
  ],  locationInput: [
    '.jobsearch-frontpage__input--geo',
    'input[placeholder*="Hvor vil du arbejde"]',
    'input[placeholder*="Where"]',
    'input[placeholder*="Location"]', 
    'input[placeholder*="lokation"]',
    'input[placeholder*="område"]',
    '.location-input input',
    'input[data-testid="location-input"]'
  ],  buttonSearch: [
    'button[type="submit"]',
    '.btn.btn-primary.btn-lg',
    'button:has-text("Søg")',
    'button:has-text("Search")',
    '[class*="search-button"]',
    '[class*="submit"]'
  ],jobDetails: {
    jobTitle: [
      'h1',
      '.job-title',
      '.jobad-title', 
      '.job-header h1',
      '[class*="title"]',
      '.jobheader h1',
      '.jobtitle'
    ],
    company: [
      '.company-name',
      '.job-company',
      '.employer-name',
      '.company',
      '[class*="company"]',
      '.jobheader .company',
      'a[href*="virksomhed"]'
    ],
    jobLocation: [
      '.job-location',
      '.location',
      '.workplace-address',
      '[class*="location"]',
      '.jobheader .location'
    ],    jobDetails: [
      '.job-description',
      '.job-content',
      '.jobad-content',
      '.job-text',
      '.description',
      '.content',
      'main .content',
      '[class*="description"]',
      '.jobdetails',
      // More specific JobIndex selectors
      '.jobad-text',
      '.job-body',
      '.ad-content',
      '.job-posting-content',
      '.job-ad-description',
      'section[class*="description"]',
      'div[class*="jobad"]',
      // Try broader selectors if specific ones fail
      'main',
      'article',
      '[role="main"]'
    ],
  },  jobCard: [
    '.jix_robotjob',  // Main job container
    '[data-jobad-tid]', // Jobs with data attributes
    '.job-card',
    '.jobad',
    '.job-item',
    '[class*="job"][class*="card"]',
    '[class*="robotjob"]'
  ],
  jobLinkInCard: [
    '.seejobdesktop',  // "Se jobbet" button
    'a[href*="jobteam.dk"]',
    'a[href*="hr-manager.net"]',
    'a[href*="enaportal.com"]'
  ],
  modalsToClose: {
    cookieConsent: [
      '#jix-cookie-consent-accept-selected',
      '.jix-cookie-consent-modal__buttons .btn-secondary',
      'button:has-text("Afvis")'
    ],
    jobAgent: [
      '#jobmail_popup .close',
      '#jobmail_popup button[data-dismiss="modal"]',
      '#jobmail_popup_label ~ .close',
      '.modal-header .close'
    ],
    anyModal: [
      '.modal.show .close',
      '.modal.show .btn-secondary',
      '.modal .close'
    ]
  }
};

async function search(
  page: Page,
  jobDescription: string,
  location: string,
  postsMaxAgeSeconds?: number
) {
  const elements = await tryToFindElementsFromSelectors(
    page,
    {
      searchInput: jobIndexSelectors.searchInput,
      searchButton: jobIndexSelectors.buttonSearch,
      locationInput: jobIndexSelectors.locationInput,
    },
    {
      allOrNothing: false, // Some sites might not have separate location input
    }
  );

  if (!elements || !elements.searchInput || !elements.searchButton) {
    throw new Error("Required search elements not found");
  }

  const { searchInput, searchButton, locationInput } = elements;

  // Step 1: Fill in job description
  await searchInput.click();
  await searchInput.clear();
  await searchInput.type(jobDescription, { delay: 100 });
  await page.waitForTimeout(500);
  log('Job description filled in');

  // Step 2: Handle location if input exists
  if (locationInput) {
    // Click on location input
    await locationInput.click();
    await page.waitForTimeout(500);
    
    // Clear and type location
    await locationInput.clear();
    await locationInput.type(location, { delay: 100 });
    await page.waitForTimeout(1500); // Wait longer for autocomplete
    
    // Try to find and click a location suggestion
    const locationSuggestionSelectors = [
      `li:has-text("${location}")`,
      `[class*="suggestion"]:has-text("${location}")`,
      `[class*="dropdown"] li:has-text("${location}")`,
      `.suggestions li:first-child`,
      `.dropdown-menu li:first-child`,
      `[role="listbox"] [role="option"]:first-child`,
      `ul li:first-child`
    ];
    
    let locationSelected = false;
    for (const selector of locationSuggestionSelectors) {
      try {
        const elements = await page.$$(selector);
        if (elements.length > 0) {
          const element = elements[0];
          if (await element.isVisible()) {
            await element.click();
            locationSelected = true;
            log(`Location suggestion clicked using selector: ${selector}`);
            break;
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }
      if (!locationSelected) {
      // Try keyboard navigation
      log('Trying keyboard navigation for location...');
      await locationInput.press('ArrowDown');
      await page.waitForTimeout(300);
      await locationInput.press('Enter');
      locationSelected = true;
      log('Location selected using keyboard navigation');
    }
      await page.waitForTimeout(1000); // Wait after location selection
    log('Location selection completed');
  }

  // Step 3: CLICK THE SEARCH BUTTON!
  log('🔍 NOW CLICKING SEARCH BUTTON...');
  
  await page.waitForTimeout(1000); // Make sure form is ready
  
  // Make sure button is visible and click it
  await searchButton.scrollIntoViewIfNeeded();
  await searchButton.click({ force: true });
  
  log('✅ Search button clicked! Waiting for results...');
  
  // Wait for page to navigate/load results
  await page.waitForTimeout(5000);
  
  log(`Current URL after search: ${page.url()}`);
  
  // Close any modals
  await closeModals(page);
  
  log('Search completed!');
}

const closeModals = async (page: Page) => {
  log("Checking for and closing modal popups...");
  
  // Wait a bit for modals to appear
  await page.waitForTimeout(2000);
  
  // Close cookie consent modal
  try {
    for (const selector of jobIndexSelectors.modalsToClose.cookieConsent) {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(1000);
        log("✅ Closed cookie consent modal");
        break;
      }
    }
  } catch (error) {
    log("No cookie consent modal found or error closing it");
  }
  
  // Close job agent modal - try multiple approaches
  try {
    // First try the close button
    for (const selector of jobIndexSelectors.modalsToClose.jobAgent) {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        await button.click();
        await page.waitForTimeout(1000);
        log("✅ Closed job agent modal with close button");
        return;
      }
    }
    
    // If close button doesn't work, try pressing Escape key
    const modal = await page.$('#jobmail_popup, .modal.show');
    if (modal && await modal.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      log("✅ Closed job agent modal with Escape key");
      return;
    }
    
    // As last resort, try clicking outside the modal
    if (modal) {
      await page.click('body', { position: { x: 10, y: 10 } });
      await page.waitForTimeout(1000);
      log("✅ Closed job agent modal by clicking outside");
    }
    
  } catch (error) {
    log("No job agent modal found or error closing it");
  }
  
  // Additional check for any remaining modals with Escape key
  try {
    const remainingModal = await page.$('.modal.show, [aria-modal="true"]');
    if (remainingModal && await remainingModal.isVisible()) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(1000);
      log("✅ Closed remaining modal with Escape key");
    }
  } catch (error) {
    // Ignore
  }
};

// Simple function to close modals without throwing errors
const closeModalsSilently = async (page: Page) => {
  try {
    await closeModals(page);
  } catch (error) {
    // Silently ignore modal closing errors
  }
};

const extractJobDetailsFromPage = async (
  page: Page, 
  jobId: string, 
  jobUrl: string
): Promise<Omit<JobPost, 'id' | 'dateScraped' | 'sourceId'> | null> => {
  try {
    // Wait for job details to load
    await page.waitForLoadState('networkidle', { timeout: 15000 });
    
    log(`🔍 Extracting all text from: ${page.url()}`);
    
    // Close any cookie banners or modals
    await closeModals(page);
    
    // Extract basic info using simple selectors first
    let jobTitle = "";
    let company = "";
    let location = "";
    
    // Try to find job title using common patterns
    const titleSelectors = ['h1', '.job-title', '.jobad-title', '[data-testid="job-title"]', '.title', '.position-title'];
    for (const selector of titleSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0 && text.trim().length < 200) {
          jobTitle = text.trim();
          break;
        }
      }
    }
    
    // Try to find company using common patterns
    const companySelectors = ['.company-name', '.employer', '.jobad-company', '[data-testid="company-name"]', '.company', '.organization'];
    for (const selector of companySelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0 && text.trim().length < 100) {
          company = text.trim();
          break;
        }
      }
    }
    
    // Try to find location
    const locationSelectors = ['.location', '.jobad-location', '[data-testid="job-location"]', '.job-location', '.workplace'];
    for (const selector of locationSelectors) {
      const element = await page.$(selector);
      if (element) {
        const text = await element.textContent();
        if (text && text.trim().length > 0 && text.trim().length < 100) {
          location = text.trim();
          break;
        }
      }
    }
    
    // If we couldn't find title or company, try to extract from page title or URL
    if (!jobTitle) {
      const pageTitle = await page.title();
      if (pageTitle && pageTitle.length > 0) {
        // Clean up page title to get job title
        jobTitle = pageTitle.replace(/\s*-\s*.*$/, '').trim(); // Remove company part after dash
      }
    }
    
    if (!company && jobUrl) {
      // Try to extract company from domain
      const domain = new URL(jobUrl).hostname;
      const domainParts = domain.split('.');
      if (domainParts.length > 1) {
        company = domainParts[domainParts.length - 2]; // Get the main domain part
        company = company.charAt(0).toUpperCase() + company.slice(1); // Capitalize
      }
    }
      // Extract ALL text content from the page - this will include job description, requirements, everything
    log(`📄 Extracting all page content...`);
    
    // First, try to find and extract text from likely job content areas
    let jobDetails = "";
    const contentSelectors = [
      '.job-description', '.job-content', '.description', '.content', 
      'main', '[role="main"]', 'article', '.job-details', '.job-posting',
      '.position-description', '.role-description', '.ad-description',
      // TheHub specific selectors
      '.job-card', '.job-info', '.job-body', '.position-info'
    ];
    
    for (const selector of contentSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await element.textContent();
          if (text && text.trim().length > 200) { // Must be substantial content
            jobDetails = text.trim();
            log(`✅ Found content in ${selector}: ${text.length} chars`);
            break;
          }
        }
      } catch (error) {
        // Continue to next selector
      }
    }
    
    // If no specific content found, get full page text but filter it better
    if (!jobDetails || jobDetails.length < 200) {
      log(`🔄 No specific content found, extracting from full page...`);
      const fullPageText = await page.textContent('body');
      
      if (fullPageText) {
        // Split into lines and filter out navigation/menu text
        const lines = fullPageText.split('\n')
          .map(line => line.trim())
          .filter(line => {
            // Filter out common navigation/menu text
            const lowerLine = line.toLowerCase();
            const skipPatterns = [
              'gem', 'ikke interesseret', 'fejlmeld', 'del annoncen', 'kopier link',
              'facebook', 'linkedin', 'twitter', 'via apps', 'menu', 'navigation',
              'cookie', 'privacy', 'terms', 'contact', 'about', 'home', 'login',
              'sign up', 'register', 'search jobs', 'all jobs', 'apply now'
            ];
            
            return line.length > 10 && 
                   line.length < 300 && 
                   !skipPatterns.some(pattern => lowerLine.includes(pattern)) &&
                   !lowerLine.match(/^\s*(menu|nav|footer|header)\s*$/);
          });
        
        // Take the meaningful lines and join them
        jobDetails = lines.slice(0, 100).join(' '); // Limit to avoid too much noise
      }
    }
    
    // For skills, we'll let the AI analysis handle this later
    // Just extract any obvious skill mentions using our existing function
    const extractedSkills = extractSkillsFromText(jobDetails);
    
    log(`📊 Extracted job data:`);
    log(`  Title: ${jobTitle || 'Not found'}`);
    log(`  Company: ${company || 'Not found'}`);
    log(`  Location: ${location || 'Not found'}`);
    log(`  Full text length: ${jobDetails.length} chars`);
    log(`  Skills found: ${extractedSkills || 'None detected'}`);
    
    // Fallback values
    const finalTitle = jobTitle || "Job Title (see description)";
    const finalCompany = company || "Company (see description)";
    const finalLocation = location || "";
    const finalJobDetails = jobDetails || "Could not extract job details from page";
    
    if (finalJobDetails.length < 50) {
      log(`❌ Extracted text too short (${finalJobDetails.length} chars) for job ${jobId}`);
      return null;
    }
    
    const result = {
      title: finalTitle,
      company: finalCompany,
      location: finalLocation,
      jobDetails: finalJobDetails,
      skills: extractedSkills || "",
      externalId: jobId,
      originalUrl: jobUrl
    };
    
    log(`✅ Successfully extracted job with ${finalJobDetails.length} chars of content`);
    return result;
    
  } catch (error) {
    console.error(`Error extracting job details for ${jobId}:`, error);
    return null;
  }
};

/**
 * Extract skills from job description text using pattern matching
 * This looks for common programming languages, frameworks, and technologies
 */
const extractSkillsFromText = (text: string): string => {
  if (!text) return "";
  
  // Convert to lowercase for matching
  const lowerText = text.toLowerCase();
  
  // Define skill patterns to look for (including Danish variations)
  const skillPatterns = [
    // Programming languages
    'javascript', 'js', 'typescript', 'ts', 'python', 'java', 'c#', 'c\\+\\+', 'cpp', 'php', 'ruby', 'go', 'golang', 'rust', 'swift', 'kotlin', 'scala', 'c', 'perl',
    // Frontend frameworks/libraries
    'react', 'reactjs', 'vue', 'vuejs', 'angular', 'angularjs', 'svelte', 'ember', 'backbone', 'jquery', 'bootstrap', 'tailwind', 'css', 'html', 'html5', 'css3', 'sass', 'scss', 'less',
    // Backend frameworks
    'node\\.?js', 'nodejs', 'express', 'expressjs', 'nestjs', 'django', 'flask', 'laravel', 'symfony', 'spring', 'spring boot', 'asp\\.?net', '\\.net', 'dotnet',
    // Databases
    'mysql', 'postgresql', 'postgres', 'mongodb', 'mongo', 'redis', 'elasticsearch', 'sqlite', 'oracle', 'sql server', 'mssql', 'sql', 'nosql', 'database',
    // Cloud platforms
    'aws', 'amazon web services', 'azure', 'microsoft azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'k8s', 'terraform', 'ansible', 'jenkins',
    // Tools and technologies
    'git', 'github', 'gitlab', 'bitbucket', 'ci/cd', 'webpack', 'babel', 'npm', 'yarn', 'eslint', 'prettier', 'jest', 'cypress', 'selenium',
    // Mobile
    'react native', 'flutter', 'xamarin', 'ionic', 'android', 'ios', 'swift', 'objective-c',
    // DevOps and Systems
    'linux', 'unix', 'bash', 'powershell', 'ubuntu', 'centos', 'debian', 'nginx', 'apache', 'iis',
    // Testing
    'jest', 'mocha', 'jasmine', 'cypress', 'selenium', 'junit', 'pytest', 'testing', 'unit test', 'integration test',
    // Other common skills
    'api', 'rest', 'restful', 'graphql', 'microservices', 'agile', 'scrum', 'kanban', 'jira', 'confluence',
    // Danish technical terms
    'udvikling', 'programmering', 'softwareudvikling', 'webudvikling', 'systemudvikling',
    // Architecture and methodologies
    'mvc', 'mvvm', 'solid', 'clean code', 'tdd', 'bdd', 'ddd', 'cqrs', 'event sourcing'
  ];
  
  const foundSkills: string[] = [];
  
  // Look for each skill pattern in the text
  for (const pattern of skillPatterns) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      // Add the original case version if found
      const originalPattern = pattern.replace(/\\./g, '.').replace(/\\\+/g, '+');
      if (!foundSkills.some(skill => skill.toLowerCase() === originalPattern.toLowerCase())) {
        foundSkills.push(originalPattern);
      }
    }
  }
  
  // Look for skill lists with various patterns
  const skillListPatterns = [
    // English patterns
    /(?:skills?|technologies?|tools?|experience with|knowledge of|proficient in|familiar with|working with)[:\s]*([^.!?]{10,100})/gi,
    /(?:must have|should have|required|requirements?)[:\s]*([^.!?]{10,100})/gi,
    /(?:technologies|tech stack|technology stack)[:\s]*([^.!?]{10,100})/gi,
    /(?:you will work with|you'll work with|working with)[:\s]*([^.!?]{10,100})/gi,
    // Danish patterns
    /(?:teknologier|værktøjer|erfaring med|kendskab til|kompetencer)[:\s]*([^.!?]{10,100})/gi,
    /(?:krav|kravene|requirements)[:\s]*([^.!?]{10,100})/gi,
    /(?:du skal kunne|du skal have)[:\s]*([^.!?]{10,100})/gi
  ];
  
  for (const pattern of skillListPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        // Extract potential skills from the matched text
        const skillText = match.replace(/^[^:]*:/, '').trim();
        const potentialSkills = skillText.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 25);
        foundSkills.push(...potentialSkills.slice(0, 5)); // Limit to avoid noise
      }
    }
  }
  
  // Look for programming languages in parentheses or after keywords
  const langPatterns = [
    /\b(?:programming|coded?|written) in\s+([a-zA-Z#.+]+)/gi,
    /\b(?:using|with|in)\s+([a-zA-Z#.+]{2,15})\s+(?:programming|language|framework)/gi,
    /\(([a-zA-Z#.+, ]{3,50})\)/g // Skills in parentheses
  ];
  
  for (const pattern of langPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const extracted = match.replace(/[()]/g, '').replace(/^[^a-zA-Z]*/, '').trim();
        if (extracted.length > 1 && extracted.length < 20) {
          foundSkills.push(extracted);
        }
      }
    }
  }
  
  // Remove duplicates and filter out noise
  const uniqueSkills = [...new Set(foundSkills)]
    .filter(skill => skill.length > 1 && skill.length < 25)
    .filter(skill => !/^(and|or|the|a|an|in|on|at|to|for|with|by)$/i.test(skill)); // Remove common words
  
  return uniqueSkills.slice(0, 20).join(', '); // Limit to 20 skills to avoid clutter
};
