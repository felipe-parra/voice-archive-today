import { defineConfig } from '@playwright/test'

/**
 * Block B screenshot config — recorder hero + voice-note detail.
 * Runs against a preview server that the operator starts SEPARATELY on :4192
 * (`pnpm build:fixtures && vite preview --mode fixtures --port 4192`) so it does
 * not collide with Block A's parallel run on :4173. No managed webServer here.
 */
export default defineConfig({
  testDir: '.',
  testMatch: 'blockB.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4192',
  },
})
