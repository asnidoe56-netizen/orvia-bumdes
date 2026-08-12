import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

/**
 * E2E covers what unit tests structurally cannot: async Server Components,
 * redirects, and the real request pipeline. The Next.js 16 testing guide is
 * explicit that async Server Components should be covered by E2E rather than
 * unit tests.
 *
 * Requires a working .env.local (Supabase URL + anon key). Set E2E_BASE_URL to
 * run against an already-running server or a deployed environment.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,

  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Most BUMDes operators work from a phone; keep a mobile profile in the loop.
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],

  // Reuse an already-running dev server locally; boot a production build in CI.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
