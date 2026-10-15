import { defineConfig } from '@playwright/test'

if (!process.env.E2E_BASE_URL || !process.env.E2E_PROVIDER_URL || !process.env.E2E_WORLD) throw new Error('Run npm run test:e2e to own a disposable stack')
export default defineConfig({
  testDir: './e2e', workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  timeout: 90000, globalTimeout: 180000,
  expect: { timeout: 10000 },
  reporter: 'list', outputDir: 'test-results/e2e',
  use: { baseURL: process.env.E2E_BASE_URL, locale: 'es-ES', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
  ],
})
