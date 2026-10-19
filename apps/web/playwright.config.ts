import { defineConfig } from '@playwright/test'

const PORT = 4175
export const BASE = `http://localhost:${PORT}/HRmit/`

/** Smoke test of the demo build: build once, serve it with vite preview, drive it with Chromium. */
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: BASE, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `pnpm build:demo && pnpm preview:demo --port ${PORT} --strictPort`,
    url: BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
})
