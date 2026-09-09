import { test, expect } from '@playwright/test'

// iPhone 13 metrics, minus `defaultBrowserType` (not allowed in a describe).
const IPHONE_13 = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
} as const

/**
 * Block B — recorder hero + voice-note detail.
 * Full-page PNGs to screenshots/out/. Run with:
 *   pnpm build:fixtures
 *   npx vite preview --mode fixtures --port 4192 &
 *   npx playwright test -c screenshots/blockB.config.ts
 */

const OUT = 'screenshots/out'

// Give webfonts + fixture render a beat to settle before capture.
async function settle(page: import('@playwright/test').Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  test('index-record', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: 'Speak now. Sort it later.' })
    ).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/index-record.png`, fullPage: true })
  })

  test('index-recording', async ({ page }) => {
    await page.goto('/?demo=recording')
    await expect(page.getByText('REC', { exact: true })).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/index-recording.png`, fullPage: true })
  })

  test('index-notes', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: 'Notes' }).click()
    await expect(
      page.getByText('Field notes — the smallest useful version')
    ).toBeVisible()
    await settle(page)
    await page.screenshot({ path: `${OUT}/index-notes.png`, fullPage: true })
  })

  test('voice-note-detail', async ({ page }) => {
    await page.goto('/voice-note/vn-001')
    await expect(
      page.getByRole('heading', {
        name: 'Field notes — the smallest useful version',
      })
    ).toBeVisible()
    await settle(page)
    await page.screenshot({
      path: `${OUT}/voice-note-detail.png`,
      fullPage: true,
    })
  })
})

test.describe('mobile', () => {
  test.use(IPHONE_13)

  test('voice-note-detail-mobile', async ({ page }) => {
    await page.goto('/voice-note/vn-001')
    await expect(
      page.getByRole('heading', {
        name: 'Field notes — the smallest useful version',
      })
    ).toBeVisible()
    await settle(page)
    await page.screenshot({
      path: `${OUT}/voice-note-detail-mobile.png`,
      fullPage: true,
    })
  })
})
