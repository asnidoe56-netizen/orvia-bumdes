import { describe, expect, it } from "vitest";
import { listApiRouteFiles, readSource } from "../helpers/source-tree";

/**
 * Route Handlers are plain HTTP endpoints — no layout runs in front of them.
 * Each one must establish a session itself, either directly or through a
 * helper that does (`getOrviaAiContext` calls `getLoginContext` and then
 * checks the tenant's AI entitlement).
 */

const AUTH_HELPERS =
  /requireRole|getLoginContext|auth\.getUser|getOrviaAiContext|getAi[A-Za-z]+\(/;

/** Routes whose auth lives one level down, in src/lib/orvia-ai/read-tools.ts. */
const AUTH_VIA_READ_TOOLS = new Set([
  "src/app/api/orvia-ai/chat/route.ts",
  "src/app/api/orvia-ai/read/cash-bank-position/route.ts",
  "src/app/api/orvia-ai/read/customer-receivables/route.ts",
  "src/app/api/orvia-ai/read/inventory-position/route.ts",
  "src/app/api/orvia-ai/read/supplier-payables/route.ts",
  "src/app/api/orvia-ai/read/unit-health-summary/route.ts",
]);

describe("Route Handler authorization", () => {
  const routes = listApiRouteFiles();

  it("finds the route handlers", () => {
    expect(routes.length).toBeGreaterThan(5);
  });

  /**
   * Known gaps at audit time. All three are reachable by *any* logged-in user
   * from any of the 123 tenants; only Supabase RLS and storage policies stand
   * behind them. Shrink this list, do not grow it.
   */
  const KNOWN_UNAUTHENTICATED = [
    // Writes global landing-page content + uploads to the public bucket.
    "src/app/api/platform/public-content/sections/[id]/route.ts",
    // Upserts platform-wide branding + uploads a logo.
    "src/app/platform/dashboard/public-content/branding/update/route.ts",
    // Sign-out: no session needed to end a session.
    "src/app/auth/logout/route.ts",
  ];

  it("authenticates every route handler that is not a reviewed exception", () => {
    const unauthenticated = routes.filter(
      (file) =>
        !AUTH_HELPERS.test(readSource(file)) &&
        !KNOWN_UNAUTHENTICATED.includes(file),
    );

    expect(
      unauthenticated,
      `Route handler with no session check:\n  ${unauthenticated.join("\n  ")}`,
    ).toEqual([]);
  });

  it("keeps the unauthenticated list from growing", () => {
    const stillOpen = KNOWN_UNAUTHENTICATED.filter(
      (file) => routes.includes(file) && !AUTH_HELPERS.test(readSource(file)),
    );
    expect(
      stillOpen.sort(),
      "A listed route now checks auth — remove it from KNOWN_UNAUTHENTICATED.",
    ).toEqual([...KNOWN_UNAUTHENTICATED].sort());
  });

  it("does not let an unauthenticated route accept SVG uploads", () => {
    // SVG is an active-content format. Served from a public bucket it is a
    // stored-XSS primitive, and these two routes upload before any role check.
    const svgUploaders = KNOWN_UNAUTHENTICATED.filter((file) =>
      /image\/svg\+xml/.test(readSource(file)),
    );

    expect(
      svgUploaders.sort(),
      "Drop image/svg+xml from allowedTypes, or gate the route on super_admin_platform.",
    ).toEqual(
      [
        "src/app/api/platform/public-content/sections/[id]/route.ts",
        "src/app/platform/dashboard/public-content/branding/update/route.ts",
      ].sort(),
    );
  });

  it("keeps the indirectly-authenticated AI routes wired to the read tools", () => {
    // These routes look bare on their own; their guard is getOrviaAiContext()
    // inside the read tool they call. If a route stops importing a read tool,
    // it stops being authenticated.
    for (const file of AUTH_VIA_READ_TOOLS) {
      expect(
        readSource(file),
        `${file} must keep calling a read tool that resolves the login context`,
      ).toMatch(/@\/lib\/orvia-ai\/read-tools/);
    }
  });

  it("derives tenant scope from the session, never from the request body", () => {
    // The AI surface is the easiest place to smuggle another village's id in.
    for (const file of routes) {
      const source = readSource(file);
      expect(
        source,
        `${file} appears to read a tenant/unit id from the request`,
      ).not.toMatch(/body\.(tenant_?[Ii]d|unit_?[Ii]d)/);
      expect(source).not.toMatch(
        /searchParams\.get\(\s*["'](tenant_id|unit_id)["']\s*\)/,
      );
    }
  });
});
