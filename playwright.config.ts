import { defineConfig } from '@playwright/test';
import { join, resolve } from 'node:path';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 300_000,
  expect: { timeout: 15_000 },
  outputDir: process.env.BROWSER_E2E_RUN_DIR
    ? join(process.env.BROWSER_E2E_RUN_DIR, 'test-results')
    : resolve('test-results'),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3110',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    locale: 'es-PE',
    timezoneId: 'America/Lima',
    reducedMotion: 'reduce',
    acceptDownloads: true,
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
