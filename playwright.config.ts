import { defineConfig, devices } from '@playwright/test'

/**
 * Screenshot capture harness for the editorial redesign.
 * Runs the fixture build (no backend) and captures on-brand PNGs to screenshots/out/.
 *   pnpm screenshots
 */
export default defineConfig({
  testDir: './screenshots',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  webServer: {
    command: 'pnpm build:fixtures && pnpm preview:fixtures',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:4173',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'] },
    },
  ],
})
