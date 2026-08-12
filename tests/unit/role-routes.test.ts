import { describe, expect, it } from "vitest";
import {
  getFallbackRedirectPath,
  roleRedirectMap,
} from "@/lib/navigation/role-routes";
import type { AppRole } from "@/types/auth";

const ALL_ROLES: AppRole[] = [
  "super_admin_platform",
  "direktur_bumdes",
  "admin_bumdes",
  "manager_unit",
  "operator_unit",
  "viewer_unit",
  "pengawas",
  "pendamping_kecamatan",
  "pendamping",
  "dinas_pmd",
  "inspektorat",
  "bupati",
];

describe("roleRedirectMap", () => {
  it("routes every declared role somewhere", () => {
    for (const role of ALL_ROLES) {
      expect(roleRedirectMap[role], `role ${role} has no landing route`).toBeTruthy();
    }
  });

  it("never lands a role outside the dashboard area it owns", () => {
    // A wrong entry here silently drops a user into another role's dashboard,
    // which for 123 tenants means cross-role data exposure on the very first page.
    const expectedPrefix: Record<AppRole, string> = {
      super_admin_platform: "/platform/",
      direktur_bumdes: "/bumdes/",
      admin_bumdes: "/bumdes/",
      manager_unit: "/unit/",
      operator_unit: "/unit/",
      viewer_unit: "/unit/",
      pengawas: "/pengawas/",
      pendamping_kecamatan: "/pendamping/",
      pendamping: "/pendamping/",
      dinas_pmd: "/dinas-pmd/",
      inspektorat: "/inspektorat/",
      bupati: "/bupati/",
    };

    for (const role of ALL_ROLES) {
      expect(roleRedirectMap[role]).toMatch(
        new RegExp(`^${expectedPrefix[role]}`),
      );
    }
  });

  it("uses absolute in-app paths, never an external redirect", () => {
    // An absolute URL here would turn login into an open-redirect gadget.
    for (const role of ALL_ROLES) {
      const path = roleRedirectMap[role];
      expect(path.startsWith("/")).toBe(true);
      expect(path.startsWith("//")).toBe(false);
      expect(path).not.toMatch(/^https?:/i);
    }
  });
});

describe("getFallbackRedirectPath", () => {
  it("sends anonymous visitors to login", () => {
    expect(getFallbackRedirectPath(null)).toBe("/login");
    expect(getFallbackRedirectPath(undefined)).toBe("/login");
  });

  it("resolves each known role to its mapped dashboard", () => {
    for (const role of ALL_ROLES) {
      expect(getFallbackRedirectPath(role)).toBe(roleRedirectMap[role]);
    }
  });

  it("fails closed for a role string the app does not know", () => {
    // e.g. a role added in SQL but not yet in the TS union.
    expect(getFallbackRedirectPath("ghost_role" as AppRole)).toBe("/login");
  });
});
