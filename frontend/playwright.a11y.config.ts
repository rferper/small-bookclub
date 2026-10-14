import { defineConfig } from '@playwright/test'

// Dedicated fictional-data preview; never reuse an owner's running server.
export default defineConfig({
  testDir: './accessibility',
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:5180', locale: 'es-ES', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 360, height: 800 } } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5180 --strictPort',
    url: 'http://127.0.0.1:5180',
    reuseExistingServer: false,
    env: { VITE_API_MODE: 'mock' },
  },
})
