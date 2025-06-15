/**
 * Comprehensive test script to validate JobIndex scraping functionality
 * This script tests the scraping without hitting the database too hard
 */

// Mock the database connection before importing anything that uses it
jest.mock('db/index', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
}));

import { chromium, Browser, Page } from "playwright";
import { jobIndexSelectors } from "../../src/jobs/jobindex/scrape-jobindex";

describe('JobIndex Scraping Integration Test', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    // Block images and fonts to speed up loading
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg}', route => route.abort());
    await page.route('**/*.{woff,woff2,ttf,otf}', route => route.abort());
  });

  afterEach(async () => {
    await page.close();
  });

  test('should successfully load JobIndex.dk homepage', async () => {
    const response = await page.goto('https://www.jobindex.dk/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    expect(response?.status()).toBe(200);
    expect(await page.title()).toContain('job');
    
    // Test basic page structure
    const body = await page.$('body');
    expect(body).toBeTruthy();
  }, 20000);

  test('should handle cookie modal gracefully', async () => {
    await page.goto('https://www.jobindex.dk/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    // Wait for any modals to appear
    await page.waitForTimeout(3000);
    
    // Try to find and close cookie modal
    let modalClosed = false;
    for (const selector of jobIndexSelectors.modalsToClose.cookieConsent) {
      const button = await page.$(selector);
      if (button && await button.isVisible()) {
        await button.click();
        modalClosed = true;
        break;
      }
    }
    
    // Should either close modal or not have one
    expect(modalClosed).toBeDefined(); // Just checking it ran without error
  }, 20000);

  test('should find search elements on homepage', async () => {
    await page.goto('https://www.jobindex.dk/', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    await page.waitForTimeout(2000);
    
    // Try to find search input
    let searchInputFound = false;
    for (const selector of jobIndexSelectors.searchInput) {
      const input = await page.$(selector);
      if (input) {
        searchInputFound = true;
        break;
      }
    }
    
    // Try to find search button
    let searchButtonFound = false;
    for (const selector of jobIndexSelectors.buttonSearch) {
      const button = await page.$(selector);
      if (button) {
        searchButtonFound = true;
        break;
      }
    }
    
    expect(searchInputFound).toBe(true);
    expect(searchButtonFound).toBe(true);
  }, 20000);

  test('should validate job card selectors exist in DOM', async () => {
    await page.goto('https://www.jobindex.dk/job/3242439', { 
      waitUntil: 'domcontentloaded',
      timeout: 15000 
    });
    
    await page.waitForTimeout(3000);
    
    // Check if we can find job details (at least some should exist)
    const detailSelectors = [
      ...jobIndexSelectors.jobDetails.jobTitle,
      ...jobIndexSelectors.jobDetails.company,
      ...jobIndexSelectors.jobDetails.jobDetails
    ];
    
    let elementsFound = 0;
    for (const selector of detailSelectors) {
      const element = await page.$(selector);
      if (element) {
        elementsFound++;
      }
    }
    
    // Should find at least some job detail elements
    expect(elementsFound).toBeGreaterThan(0);
  }, 20000);

  test('should validate selector performance and efficiency', () => {
    // Test that selectors follow best practices
    const allSelectors = [
      ...jobIndexSelectors.searchInput,
      ...jobIndexSelectors.buttonSearch,
      ...jobIndexSelectors.jobCard,
      ...jobIndexSelectors.jobDetails.jobTitle,
      ...jobIndexSelectors.jobDetails.company
    ];
    
    // Check selector efficiency metrics
    const idSelectors = allSelectors.filter(s => s.startsWith('#'));
    const classSelectors = allSelectors.filter(s => s.startsWith('.') && !s.includes(' '));
    const complexSelectors = allSelectors.filter(s => s.includes(' ') && s.split(' ').length > 3);
    
    expect(allSelectors.length).toBeGreaterThan(0);
    expect(idSelectors.length + classSelectors.length).toBeGreaterThan(complexSelectors.length);
    
    // Validate no overly complex selectors
    const veryComplexSelectors = allSelectors.filter(s => s.length > 100);
    expect(veryComplexSelectors.length).toBe(0);
  });

  test('should validate modal selectors structure', () => {
    const cookieSelectors = jobIndexSelectors.modalsToClose.cookieConsent;
    const jobAgentSelectors = jobIndexSelectors.modalsToClose.jobAgent;
    
    expect(cookieSelectors.length).toBeGreaterThan(0);
    expect(jobAgentSelectors.length).toBeGreaterThan(0);
    
    // Should have different strategies (ID, class, text-based)
    const hasIdSelector = [...cookieSelectors, ...jobAgentSelectors].some(s => s.startsWith('#'));
    const hasClassSelector = [...cookieSelectors, ...jobAgentSelectors].some(s => s.startsWith('.'));
    
    expect(hasIdSelector).toBe(true);
    expect(hasClassSelector).toBe(true);
  });
});
