import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for Electron E2E tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',
  /* Run tests in files in parallel */
  fullyParallel: false, // Electron tests should run sequentially
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Single worker for Electron tests */
  workers: 1,
  /* Reporter configuration */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
  ],
  /* Shared settings for all the projects */
  use: {
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video on failure */
    video: 'on-first-retry',
  },
  /* Configure projects for different test scenarios */
  projects: [
    {
      name: 'electron',
      testMatch: /.*\.e2e\.ts$/,
    },
  ],
  /* Output folder for test artifacts */
  outputDir: 'test-results/',
  /* Timeout for each test */
  timeout: 60000,
  /* Expect timeout */
  expect: {
    timeout: 10000,
  },
});
