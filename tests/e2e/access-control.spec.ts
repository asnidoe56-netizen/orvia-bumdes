import { expect, test } from "@playwright/test";

/**
 * The single most important behaviour to keep true across 123 tenants:
 * an anonymous request must never reach a dashboard.
 *
 * `requireRole` runs in each dashboard layout and redirects to /login. This
 * spec walks one route per role area plus the deep links most likely to be
 * bookmarked, pasted into a group chat, or indexed.
 */

const PROTECTED_ROUTES = [
  // Platform admin — highest blast radius.
  "/platform/dashboard",
  "/platform/dashboard/bumdes",
  "/platform/dashboard/registrations",
  "/platform/dashboard/users",
  "/platform/dashboard/user-online",
  "/platform/dashboard/governance",
  "/platform/dashboard/public-content",

  // BUMDes management.
  "/bumdes/dashboard",
  "/bumdes/dashboard/users",
  "/bumdes/dashboard/units",
  "/bumdes/dashboard/reports",
  "/bumdes/dashboard/bagi-hasil",
  "/bumdes/dashboard/akses-audit",

  // Business unit — where the money is recorded.
  "/unit/dashboard",
  "/unit/dashboard/cash-bank",
  "/unit/dashboard/catat-transaksi",
  "/unit/dashboard/reports/neraca",
  "/unit/dashboard/reports/laba-rugi",
  "/unit/dashboard/reports/buku-besar",
  "/unit/dashboard/simpan-pinjam/pencairan",
  "/unit/dashboard/simpan-pinjam/angsuran",

  // Oversight and government roles.
  "/pengawas/dashboard",
  "/pengawas/dashboard/transparansi-transaksi",
  "/pendamping/dashboard",
  "/bupati/dashboard",
  "/dinas-pmd/dashboard",
  "/inspektorat/dashboard",
];

test.describe("anonymous access is refused", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`redirects ${route} to /login`, async ({ page }) => {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/login/);
    });
  }

  test("no dashboard leaks content before redirecting", async ({ page }) => {
    // A flash of real data still counts as disclosure.
    const response = await page.goto("/unit/dashboard/reports/neraca", {
      waitUntil: "domcontentloaded",
    });

    expect(page.url()).toMatch(/\/login/);
    const body = (await response?.text()) ?? "";
    expect(body).not.toContain("Neraca");
  });
});

test.describe("public routes stay public", () => {
  for (const route of ["/", "/login", "/register", "/aplikasi", "/manajemen", "/tentang"]) {
    test(`serves ${route}`, async ({ page }) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} should render`).toBeLessThan(400);
      await expect(page).not.toHaveURL(/\/login\?/);
    });
  }
});

test.describe("session endpoints", () => {
  test("logout clears the session and lands on login", async ({ page }) => {
    await page.goto("/auth/logout", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout does not honour a spoofed forwarded host", async ({ request }) => {
    // src/app/auth/logout/route.ts builds its redirect from x-forwarded-host.
    // Behind a reverse proxy that passes the client header through, this
    // becomes an open redirect straight after sign-out — prime phishing timing.
    const response = await request.get("/auth/logout", {
      headers: { "x-forwarded-host": "evil.example.com" },
      maxRedirects: 0,
    });

    const location = response.headers()["location"] ?? "";
    expect(
      location,
      "logout redirected to a host supplied by the request header",
    ).not.toContain("evil.example.com");
  });
});
