/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "<rootDir>"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          module: "ES2022",
          target: "ES2022",
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
        },
      },
    ],
  },
  extensionsToTreatAsEsm: [".ts"],
  // Increase timeout for browser tests
  testTimeout: 30000,
  // Force Jest to exit after tests complete to handle persistent connections
  forceExit: true,
  // Detect open handles for debugging
  detectOpenHandles: false,
  // Set test environment variable to avoid database connections
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Add globals for import.meta support
  globals: {
    "ts-jest": {
      useESM: true,
    },
  },
};
