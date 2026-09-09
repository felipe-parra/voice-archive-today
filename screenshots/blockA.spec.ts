import { test, expect } from '@playwright/test'

/**
 * Block A screenshot capture — shell / auth / account.
 * Full-page PNGs written to screenshots/out/. Runs against the fixture
 * preview build served by playwright.config.ts (desktop = 1440x900 @2x).
 *
 *   pnpm screenshots --project=desktop
 */

const shots: Array<{ name: string; path: string; ready: string }> = [
  { name: 'login', path: '/login', ready: 'Welcome back.' },
  { name: 'register', path: '/register', ready: 'Start your archive.' },
  { name: 'account', path: '/account', ready: 'Your account.' },
]

for (const shot of shots) {
  test(`capture ${shot.name}`, async ({ page }) => {
    await page.goto(shot.path, { waitUntil: 'networkidle' })
    await expect(
      page.getByRole('heading', { name: shot.ready })
    ).toBeVisible()
    // let webfonts settle so display type renders in the capture
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(300)
    await page.screenshot({
      path: `screenshots/out/${shot.name}.png`,
      fullPage: true,
    })
  })
}
