import { describe, expect, it } from "vitest";
import {
  assertAiRoleAllowed,
  assertAiTenantScope,
  assertAiUnitScope,
  getAiReadableScopeFilter,
  type OrviaAiToolPermission,
} from "@/lib/orvia-ai/permissions";
import type { OrviaAiContext } from "@/lib/orvia-ai/context";
import type { AppRole } from "@/types/auth";

function makeContext(overrides: Partial<OrviaAiContext> = {}): OrviaAiContext {
  return {
    userId: "user-1",
    role: "operator_unit",
    tenantId: "tenant-a",
    unitId: "unit-1",
    scope: "unit",
    fullName: "Operator Satu",
    loginContext: {
      user_id: "user-1",
      role: "operator_unit",
      tenant_id: "tenant-a",
      unit_id: "unit-1",
      redirect_path: "/unit/dashboard",
    },
    ...overrides,
  };
}

describe("assertAiRoleAllowed", () => {
  it("lets an operator read the operational data it owns", () => {
    const context = makeContext();
    expect(() => assertAiRoleAllowed(context, "read.cash_bank")).not.toThrow();
    expect(() => assertAiRoleAllowed(context, "read.inventory")).not.toThrow();
  });

  it("denies operators the audit and report surfaces", () => {
    const context = makeContext();
    expect(() => assertAiRoleAllowed(context, "read.audit")).toThrow();
    expect(() => assertAiRoleAllowed(context, "read.reports")).toThrow();
  });

  it("keeps viewer_unit strictly read-only", () => {
    // viewer must never be able to have the AI draft a transaction.
    const context = makeContext({ role: "viewer_unit" });
    expect(() => assertAiRoleAllowed(context, "draft.transaction")).toThrow();
    expect(() => assertAiRoleAllowed(context, "read.reports")).not.toThrow();
  });

  it("keeps pengawas (supervisor) out of transaction drafting", () => {
    const context = makeContext({ role: "pengawas", scope: "tenant" });
    expect(() => assertAiRoleAllowed(context, "read.audit")).not.toThrow();
    expect(() => assertAiRoleAllowed(context, "draft.transaction")).toThrow();
  });

  it("grants government and platform roles no AI permissions at all", () => {
    const externalRoles: AppRole[] = [
      "super_admin_platform",
      "pendamping",
      "pendamping_kecamatan",
      "dinas_pmd",
      "inspektorat",
      "bupati",
    ];
    const permissions: OrviaAiToolPermission[] = [
      "read.cash_bank",
      "read.receivables",
      "read.payables",
      "read.inventory",
      "read.reports",
      "read.audit",
      "draft.transaction",
      "visualize.reports",
    ];

    for (const role of externalRoles) {
      for (const permission of permissions) {
        expect(
          () => assertAiRoleAllowed(makeContext({ role }), permission),
          `${role} must not hold ${permission}`,
        ).toThrow();
      }
    }
  });

  it("fails closed for a role missing from the permission table", () => {
    const context = makeContext({ role: "not_a_real_role" as AppRole });
    expect(() => assertAiRoleAllowed(context, "read.cash_bank")).toThrow();
  });
});

describe("tenant and unit scoping", () => {
  it("rejects a context with no tenant", () => {
    const context = makeContext({ tenantId: "" as unknown as string });
    expect(() => assertAiTenantScope(context)).toThrow();
  });

  it("rejects a unit-scoped context with no unit", () => {
    const context = makeContext({ scope: "unit", unitId: null });
    expect(() => assertAiUnitScope(context)).toThrow();
  });

  it("allows a tenant-scoped role to carry no unit", () => {
    const context = makeContext({
      role: "direktur_bumdes",
      scope: "tenant",
      unitId: null,
    });
    expect(() => assertAiUnitScope(context)).not.toThrow();
  });

  it("narrows a unit role's filter to its own unit", () => {
    const filter = getAiReadableScopeFilter(makeContext());
    expect(filter).toEqual({
      tenantId: "tenant-a",
      unitId: "unit-1",
      scope: "unit",
    });
  });

  it("does not leak a unitId into a tenant-scoped filter", () => {
    const filter = getAiReadableScopeFilter(
      makeContext({ role: "direktur_bumdes", scope: "tenant", unitId: "unit-1" }),
    );
    expect(filter.unitId).toBeNull();
    expect(filter.tenantId).toBe("tenant-a");
  });

  it("always carries a tenantId so a query can never run unscoped", () => {
    // The read tools apply this filter directly; a null tenantId would
    // widen a village's question into a cross-village answer.
    const filter = getAiReadableScopeFilter(makeContext());
    expect(filter.tenantId).toBeTruthy();
  });
});
