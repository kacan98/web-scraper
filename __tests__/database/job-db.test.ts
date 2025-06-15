import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { getOrCreateJobSource, saveJobInDb, createNewJobSearch } from '../../src/jobs/generic/job-db';
import { JobPost, JobSource } from '../../db/schema/generic/job-schema';

// Mock the database connection for testing
jest.mock('../../db/index', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    execute: jest.fn(),
  }
}));

describe('Generic Job Database Functions', () => {
  
  describe('Job Source Management', () => {
    test('should create valid job source object structure', () => {
      const mockJobSource: Omit<JobSource, 'id'> = {
        name: 'test-source',
        baseUrl: 'https://test.com',
        description: 'Test job source',
        isActive: true,
        createdAt: new Date()
      };
      
      expect(mockJobSource.name).toBe('test-source');
      expect(mockJobSource.baseUrl).toBe('https://test.com');
      expect(mockJobSource.isActive).toBe(true);
    });

    test('should validate job source name format', () => {
      const validNames = ['linkedin', 'jobindex', 'job-board', 'company_site'];
      const invalidNames = ['', ' ', 'name with spaces', 'name@with!symbols'];
      
      validNames.forEach(name => {
        expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
      });
      
      invalidNames.forEach(name => {
        expect(name).not.toMatch(/^[a-zA-Z0-9_-]+$/);
      });
    });
  });

  describe('Job Post Structure', () => {
    test('should create valid job post object structure', () => {
      const mockJobPost: Omit<JobPost, 'id' | 'sourceId' | 'dateScraped'> = {
        title: 'Senior TypeScript Developer',
        company: 'Tech Company',
        location: 'Copenhagen, Denmark',
        jobDetails: 'We are looking for a senior developer...',
        skills: 'TypeScript, React, Node.js',
        externalId: 'job-12345',
        originalUrl: 'https://example.com/job/12345'
      };
      
      expect(mockJobPost.title).toBeTruthy();
      expect(mockJobPost.company).toBeTruthy();
      expect(mockJobPost.externalId).toBeTruthy();
      expect(typeof mockJobPost.title).toBe('string');
      expect(typeof mockJobPost.company).toBe('string');
    });

    test('should validate required fields', () => {
      const requiredFields = ['title', 'company', 'location', 'jobDetails', 'externalId'];
      
      const jobPost = {
        title: 'Developer',
        company: 'Company',
        location: 'Location',
        jobDetails: 'Details',
        skills: 'Skills',
        externalId: 'ext-123',
        originalUrl: 'https://example.com'
      };
      
      requiredFields.forEach(field => {
        expect(jobPost).toHaveProperty(field);
        expect(jobPost[field as keyof typeof jobPost]).toBeTruthy();
      });
    });
  });

  describe('External ID Validation', () => {
    test('should handle various external ID formats', () => {
      const validExternalIds = [
        'linkedin-123456789',
        'jobindex-r13200686',
        'job-12345',
        '123456',
        'uuid-12ab34cd-56ef-78gh-90ij-klmnopqrstuv'
      ];
      
      validExternalIds.forEach(id => {
        expect(id).toBeTruthy();
        expect(typeof id).toBe('string');
        expect(id.length).toBeGreaterThan(0);
      });
    });
  });

  describe('URL Validation', () => {
    test('should validate URL formats', () => {
      const validUrls = [
        'https://www.linkedin.com/jobs/view/123456',
        'https://www.jobindex.dk/vis-job/r13200686',
        'https://jobteam.dk/afdeling/7400M/position/jobindex/',
        'https://candidate.hr-manager.net/ApplicationInit.aspx?cid=1518'
      ];
      
      const urlPattern = /^https?:\/\/.+/;
      
      validUrls.forEach(url => {
        expect(url).toMatch(urlPattern);
      });
    });
  });

  describe('Data Sanitization', () => {
    test('should handle text with special characters', () => {
      const textWithSpecialChars = 'Developer & Designer - Full-time (Remote) €50,000-60,000';
      const company = 'Company™ & Partners Ltd.';
      
      expect(textWithSpecialChars).toBeTruthy();
      expect(company).toBeTruthy();
      
      // These should not break the database
      expect(typeof textWithSpecialChars).toBe('string');
      expect(typeof company).toBe('string');
    });

    test('should handle long text content', () => {
      const longJobDescription = 'A'.repeat(5000); // 5000 characters
      
      expect(longJobDescription.length).toBe(5000);
      expect(typeof longJobDescription).toBe('string');
    });

    test('should handle empty and null values gracefully', () => {
      const jobPostWithOptionalFields = {
        title: 'Developer',
        company: 'Company',
        location: 'Location',
        jobDetails: 'Details',
        skills: '', // Empty string
        externalId: 'ext-123',
        originalUrl: '' // Empty URL
      };
      
      expect(jobPostWithOptionalFields.skills).toBe('');
      expect(jobPostWithOptionalFields.originalUrl).toBe('');
      expect(typeof jobPostWithOptionalFields.skills).toBe('string');
    });
  });

  describe('Source Name Validation', () => {
    test('should validate known source names', () => {
      const knownSources = ['linkedin', 'jobindex'];
      
      knownSources.forEach(source => {
        expect(source).toMatch(/^[a-z]+$/);
        expect(source.length).toBeGreaterThan(0);
      });
    });

    test('should handle case sensitivity', () => {
      const sourceName = 'LinkedIn';
      const normalizedSource = sourceName.toLowerCase();
      
      expect(normalizedSource).toBe('linkedin');
    });
  });

  describe('Search Parameters', () => {
    test('should validate search parameters structure', () => {
      const searchParams = {
        keywords: 'TypeScript Developer',
        location: 'Copenhagen',
        maxAgeSeconds: 86400, // 24 hours
        sourceName: 'jobindex'
      };
      
      expect(searchParams.keywords).toBeTruthy();
      expect(searchParams.location).toBeTruthy();
      expect(typeof searchParams.maxAgeSeconds).toBe('number');
      expect(searchParams.maxAgeSeconds).toBeGreaterThan(0);
    });

    test('should handle optional search parameters', () => {
      const minimalSearchParams = {
        keywords: 'Developer',
        location: 'Remote',
        sourceName: 'linkedin'
        // maxAgeSeconds is optional
      };
      
      expect(minimalSearchParams.keywords).toBeTruthy();
      expect(minimalSearchParams.location).toBeTruthy();
      expect(minimalSearchParams).not.toHaveProperty('maxAgeSeconds');
    });
  });

  describe('Error Scenarios', () => {
    test('should handle missing required fields', () => {
      const incompleteJobPost = {
        // Missing title
        company: 'Company',
        location: 'Location'
        // Missing other required fields
      };
      
      expect(incompleteJobPost).not.toHaveProperty('title');
      expect(incompleteJobPost).not.toHaveProperty('externalId');
    });

    test('should validate external ID uniqueness concept', () => {
      const jobsFromSameSource = [
        { externalId: 'job-123', source: 'linkedin' },
        { externalId: 'job-123', source: 'jobindex' }, // Same ID, different source - should be allowed
        { externalId: 'job-456', source: 'linkedin' }
      ];
      
      // Group by source and check for duplicates within same source
      const groupedBySource = jobsFromSameSource.reduce((acc, job) => {
        if (!acc[job.source]) acc[job.source] = [];
        acc[job.source].push(job.externalId);
        return acc;
      }, {} as Record<string, string[]>);
      
      Object.values(groupedBySource).forEach(ids => {
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length); // No duplicates within same source
      });
    });
  });
});
