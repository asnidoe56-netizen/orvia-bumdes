import { describe, expect, it } from "vitest";
import {
  listExportedServerActions,
  listServerActionFiles,
  readSource,
} from "../helpers/source-tree";

/**
 * Next.js 16 guide, "Authentication":
 *
 *   "A common pattern in SPAs is to `return null` in a layout [...] This pattern
 *    is **not recommended** since Next.js applications have multiple entry points,
 *    which will not prevent nested route segments and Server Actions from being
 *    accessed."
 *
 *   "Treat Server Actions with the same security considerations as public-facing
 *    API endpoints, and verify if the user is allowed to perform a mutation."
 *
 * Every `"use server"` export is a POST endpoint reachable by any logged-in user
 * of any of the 123 tenants. The dashboard layouts calling `requireRole` do NOT
 * cover them. This suite is a ratchet: the allowlists below capture the state at
 * audit time, and any NEW action module must gate itself.
 */

/** Reachable without a session by design. Their RPC must do its own validation. */
const PUBLIC_BY_DESIGN = new Set([
  "src/app/ajukan-pinjaman/[slug]/[token]/actions.ts", // token-gated public loan intake
  "src/app/register/actions.ts",
  "src/app/register/bupati/actions.ts",
  "src/app/register/pendamping/actions.ts",
  "src/app/register/pengawas/actions.ts",
]);

/**
 * Known gap at audit time: no app-layer role check. These rely entirely on the
 * SECURITY DEFINER RPC behind them (e.g. `platform_assert_super_admin()`).
 * That is a single point of failure — shrink this list, do not grow it.
 */
const KNOWN_UNGATED = new Set([
  "src/app/platform/dashboard/bumdes/actions.ts",
  "src/app/platform/dashboard/bupati-registrations/actions.ts",
  "src/app/platform/dashboard/pendamping-registrations/actions.ts",
  "src/app/platform/dashboard/pengawas-registrations/actions.ts",
  "src/app/platform/dashboard/public-content/actions.ts",
  "src/app/platform/dashboard/registrations/actions.ts",
  "src/app/unit/dashboard/catat-transaksi/_actions/capital-debt-payment-actions.ts",
  "src/app/unit/dashboard/simpan-pinjam/angsuran/actions.ts",
  "src/app/unit/dashboard/simpan-pinjam/pencairan/actions.ts",
]);

function hasAuthGate(file: string) {
  return /requireRole|getLoginContext|getOrviaAiContext/.test(readSource(file));
}

describe("Server Action authorization", () => {
  const actionFiles = listServerActionFiles();

  it("finds the Server Action modules to audit", () => {
    expect(actionFiles.length).toBeGreaterThan(40);
  });

  it("gates every Server Action module that is not explicitly exempt", () => {
    const unexpected = actionFiles.filter(
      (file) =>
        !hasAuthGate(file) &&
        !PUBLIC_BY_DESIGN.has(file) &&
        !KNOWN_UNGATED.has(file),
    );

    expect(
      unexpected,
      `New Server Action module(s) without an auth gate.\n` +
        `Call requireRole([...]) before touching Supabase, or add the file to\n` +
        `PUBLIC_BY_DESIGN with a justification:\n  ${unexpected.join("\n  ")}`,
    ).toEqual([]);
  });

  it("keeps the known-ungated list from growing", () => {
    const stillUngated = [...KNOWN_UNGATED].filter(
      (file) => actionFiles.includes(file) && !hasAuthGate(file),
    );

    // When a file gets its gate, this fails and tells you to delete the entry.
    expect(
      stillUngated.sort(),
      "Remove now-gated files from KNOWN_UNGATED.",
    ).toEqual([...KNOWN_UNGATED].filter((f) => actionFiles.includes(f)).sort());
  });

  it("never derives tenant_id or unit_id from client FormData without a gate", () => {
    // The client controls FormData. An action that reads tenant_id from it and
    // passes it to Supabase lets tenant A act on tenant B unless the RPC
    // re-checks ownership. Pair it with a server-derived login context.
    const offenders = listServerActionFiles().filter((file) => {
      const source = readSource(file);
      const takesScopeFromClient =
        /formData\.get\(\s*["'](tenant_id|unit_id)["']\s*\)/.test(source);
      return takesScopeFromClient && !hasAuthGate(file);
    });

    expect(
      offenders.sort(),
      "Server Action takes tenant_id/unit_id from the client with no auth gate",
    ).toEqual(
      [
        "src/app/platform/dashboard/bumdes/actions.ts",
        "src/app/register/pengawas/actions.ts",
      ].sort(),
    );
  });

  it("exposes no action that mutates without any validation at all", () => {
    // Each exported action must at minimum validate its inputs or resolve a
    // session before it reaches the database.
    const bare: string[] = [];

    for (const file of listServerActionFiles()) {
      const source = readSource(file);
      if (!listExportedServerActions(file).length) continue;

      const validates =
        /if\s*\(|throw new Error|return\s*{\s*success:\s*false|redirectWith/.test(
          source,
        );
      if (!validates && !hasAuthGate(file)) bare.push(file);
    }

    expect(bare, "Server Action with neither validation nor auth").toEqual([]);
  });
});
