import { describe, expect, it } from "vitest";
import {
  listClientComponentFiles,
  listPageFiles,
  listSourceFiles,
  readSource,
} from "../helpers/source-tree";

const SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

/**
 * `createAdminClient()` uses the service_role key, which bypasses every RLS
 * policy. With 123 tenants in one database, RLS is the only thing separating
 * them, so each use of this client is a place where isolation is hand-rolled.
 */
const ADMIN_CLIENT_CALLERS = [
  "src/app/bumdes/dashboard/units/actions.ts",
  "src/app/bumdes/dashboard/users/actions.ts",
  "src/app/platform/dashboard/pengawas-registrations/actions.ts",
  "src/app/platform/dashboard/pengawas-registrations/page.tsx",
  "src/app/register/actions.ts",
  "src/app/register/bupati/actions.ts",
  "src/app/register/pendamping/actions.ts",
  "src/app/register/pengawas/actions.ts",
  "src/app/register/pengawas/page.tsx",
];

describe("service-role key containment", () => {
  it("is read in exactly one module", () => {
    const readers = listSourceFiles().filter((file) =>
      readSource(file).includes(SERVICE_ROLE_ENV),
    );
    expect(readers).toEqual(["src/lib/supabase/admin.ts"]);
  });

  it("never reaches a Client Component", () => {
    // Anything a "use client" module imports is shipped to the browser.
    const leaked = listClientComponentFiles().filter((file) => {
      const source = readSource(file);
      return (
        source.includes(SERVICE_ROLE_ENV) ||
        source.includes("@/lib/supabase/admin") ||
        source.includes("createAdminClient")
      );
    });

    expect(leaked, "service_role client imported into browser code").toEqual([]);
  });

  it("is not exposed through a NEXT_PUBLIC_ variable", () => {
    // NEXT_PUBLIC_* is inlined into the client bundle at build time.
    const publicEnvRefs = new Set<string>();
    for (const file of listSourceFiles()) {
      for (const match of readSource(file).matchAll(
        /process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g,
      )) {
        publicEnvRefs.add(match[1]);
      }
    }

    for (const name of publicEnvRefs) {
      expect(name).not.toMatch(/SERVICE_ROLE|SECRET|PRIVATE_KEY/i);
    }
    // The anon key is public by design; the service key must never join it.
    expect([...publicEnvRefs].sort()).toEqual([
      "NEXT_PUBLIC_SITE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "NEXT_PUBLIC_SUPABASE_URL",
    ]);
  });

  it("keeps the set of RLS-bypassing modules to the reviewed list", () => {
    const callers = listSourceFiles()
      .filter(
        (file) =>
          file !== "src/lib/supabase/admin.ts" &&
          readSource(file).includes("createAdminClient"),
      )
      .sort();

    expect(
      callers,
      "A new module bypasses RLS. It must scope every query by tenant itself.",
    ).toEqual([...ADMIN_CLIENT_CALLERS].sort());
  });
});

describe("provider API keys", () => {
  it("keeps AI credentials out of client code", () => {
    const leaked = listClientComponentFiles().filter((file) =>
      /GEMINI_API_KEY|OPENAI_API_KEY/.test(readSource(file)),
    );
    expect(leaked).toEqual([]);
  });

  it("never hardcodes a credential-shaped literal in source", () => {
    const offenders: string[] = [];
    const patterns = [
      /\bsk-[A-Za-z0-9]{20,}/, // OpenAI
      /\bAIza[0-9A-Za-z_-]{30,}/, // Google
      /\beyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\./, // JWT (Supabase keys)
    ];

    for (const file of listSourceFiles()) {
      const source = readSource(file);
      if (patterns.some((pattern) => pattern.test(source))) offenders.push(file);
    }

    expect(offenders, "hardcoded credential in source").toEqual([]);
  });
});

describe("tenant scoping in direct table reads", () => {
  it("filters by tenant wherever a Server Component reads a tenant table", () => {
    // Pages that call .from(...) but never mention tenant_id are relying purely
    // on RLS. That is acceptable only if RLS truly covers the table — list them
    // so the set stays deliberate rather than accidental.
    const unscoped = listPageFiles().filter((file) => {
      const source = readSource(file);
      if (!source.includes(".from(")) return false;
      if (readSource(file).includes("createAdminClient")) return false;
      return !/tenant_id|unit_id/.test(source);
    });

    expect(unscoped.sort()).toEqual(
      [
        // Regency-wide rollup. Relies on RLS to scope the regent to their own
        // kabupaten — the one entry here worth re-verifying against the policy.
        "src/app/bupati/dashboard/page.tsx",

        // Platform-admin surfaces: cross-tenant by design, gated by the
        // super_admin_platform check in src/app/platform/dashboard/layout.tsx.
        "src/app/platform/dashboard/bupati-registrations/page.tsx",
        "src/app/platform/dashboard/pendamping-registrations/page.tsx",
        "src/app/platform/dashboard/registrations/[id]/page.tsx",
        "src/app/platform/dashboard/registrations/page.tsx",

        // Landing-page CMS: global content, not tenant data.
        "src/app/platform/dashboard/public-content/branding/page.tsx",
        "src/app/platform/dashboard/public-content/items/[id]/edit/page.tsx",
        "src/app/platform/dashboard/public-content/news/[id]/edit/page.tsx",
        "src/app/platform/dashboard/public-content/page.tsx",
        "src/app/platform/dashboard/public-content/sections/[id]/edit/page.tsx",
      ].sort(),
    );
  });
});
