import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'retain-on-failure',
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: [
    {
      command: 'node --import tsx backend/test/serve.ts',
      url: 'http://localhost:3000/api/health/live',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm run dev:web',
      url: 'http://localhost:8080',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
