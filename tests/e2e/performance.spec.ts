import { expect, test } from "@playwright/test";

/**
 * Load-speed budgets.
 *
 * Context that sets the numbers: every dashboard route is `export const
 * dynamic = "force-dynamic"`, so nothing is cached and each navigation is a
 * fresh round of Supabase queries. Several pages issue those queries
 * sequentially rather than through Promise.all, so their latency is the sum of
 * the round trips, not the max. Operators are on rural mobile connections.
 *
 * These budgets are deliberately generous — they are regression alarms, not
 * targets. Tighten them as the waterfalls get fixed.
 */

const TTFB_BUDGET_MS = 1_500;
const LOAD_BUDGET_MS = 5_000;
const JS_BUDGET_KB = 800;

const PUBLIC_ROUTES = ["/", "/login", "/aplikasi", "/manajemen", "/tentang"];

test.describe("public page budgets", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} responds within budget`, async ({ page }) => {
      const started = Date.now();
      const response = await page.goto(route, { waitUntil: "load" });
      const elapsed = Date.now() - started;

      expect(response?.status()).toBeLessThan(400);
      expect(elapsed, `${route} took ${elapsed}ms`).toBeLessThan(LOAD_BUDGET_MS);
    });
  }

  test("landing page time-to-first-byte stays low", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });

    const ttfb = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType(
        "navigation",
      ) as PerformanceNavigationTiming[];
      return nav ? nav.responseStart - nav.requestStart : 0;
    });

    expect(ttfb, `TTFB was ${Math.round(ttfb)}ms`).toBeLessThan(TTFB_BUDGET_MS);
  });
});

test.describe("bundle weight", () => {
  test("landing page ships a reasonable amount of JavaScript", async ({ page }) => {
    let jsBytes = 0;

    page.on("response", (response) => {
      const url = response.url();
      if (!url.includes("/_next/static/")) return;
      if (!url.endsWith(".js")) return;
      const length = Number(response.headers()["content-length"] ?? 0);
      jsBytes += length;
    });

    await page.goto("/", { waitUntil: "load" });

    const jsKb = Math.round(jsBytes / 1024);
    expect(jsKb, `landing page pulled ${jsKb} KB of JS`).toBeLessThan(JS_BUDGET_KB);
  });

  test("does not eagerly load the PDF libraries", async ({ page }) => {
    // jspdf is ~400 KB and is correctly behind `await import("jspdf")` in
    // src/lib/reports/*.ts. This guards that boundary: a static import would
    // put it on the critical path of every report page.
    const loaded: string[] = [];

    page.on("response", (response) => {
      if (/jspdf|html2canvas/i.test(response.url())) loaded.push(response.url());
    });

    await page.goto("/", { waitUntil: "load" });
    expect(loaded, "PDF library loaded before any export was requested").toEqual([]);
  });
});

test.describe("caching and compression", () => {
  test("static chunks are served immutable", async ({ request }) => {
    const page = await request.get("/");
    const html = await page.text();
    const match = html.match(/\/_next\/static\/chunks\/[^"']+\.js/);

    test.skip(!match, "no static chunk referenced on the landing page");

    const asset = await request.get(match![0]);
    const cacheControl = asset.headers()["cache-control"] ?? "";
    expect(cacheControl).toContain("immutable");
  });

  test("HTML responses are compressed", async ({ request }) => {
    const response = await request.get("/", {
      headers: { "accept-encoding": "gzip, br" },
    });
    const encoding = response.headers()["content-encoding"] ?? "";
    expect(
      encoding,
      "landing HTML served uncompressed — check the reverse proxy",
    ).toMatch(/gzip|br|deflate|zstd/);
  });
});
