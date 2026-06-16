import type { AppRole } from "@/types/auth";
import type { OrviaAiContext } from "./context";

export type OrviaAiToolPermission =
  | "read.cash_bank"
  | "read.receivables"
  | "read.payables"
  | "read.inventory"
  | "read.reports"
  | "read.audit"
  | "draft.transaction"
  | "visualize.reports";

const ROLE_PERMISSIONS: Record<AppRole, OrviaAiToolPermission[]> = {
  super_admin_platform: [],
  direktur_bumdes: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "read.reports",
    "read.audit",
    "draft.transaction",
    "visualize.reports",
  ],
  admin_bumdes: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "read.reports",
    "read.audit",
    "draft.transaction",
    "visualize.reports",
  ],
  manager_unit: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "read.reports",
    "draft.transaction",
    "visualize.reports",
  ],
  operator_unit: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "draft.transaction",
  ],
  viewer_unit: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "read.reports",
    "visualize.reports",
  ],
  pengawas: [
    "read.cash_bank",
    "read.receivables",
    "read.payables",
    "read.inventory",
    "read.reports",
    "read.audit",
    "visualize.reports",
  ],
  pendamping_kecamatan: [],
  pendamping: [],
  dinas_pmd: [],
  inspektorat: [],
  bupati: [],
};

export function assertAiRoleAllowed(
  context: OrviaAiContext,
  permission: OrviaAiToolPermission
) {
  const permissions = ROLE_PERMISSIONS[context.role] ?? [];

  if (!permissions.includes(permission)) {
    throw new Error("Role ini tidak memiliki izin AI untuk aksi tersebut.");
  }
}

export function assertAiTenantScope(context: OrviaAiContext) {
  if (!context.tenantId) {
    throw new Error("Akses AI ditolak karena tenant tidak valid.");
  }
}

export function assertAiUnitScope(context: OrviaAiContext) {
  if (context.scope === "unit" && !context.unitId) {
    throw new Error("Akses AI ditolak karena unit tidak valid.");
  }
}

export function getAiReadableScopeFilter(context: OrviaAiContext) {
  assertAiTenantScope(context);

  return {
    tenantId: context.tenantId,
    unitId: context.scope === "unit" ? context.unitId : null,
    scope: context.scope,
  };
}
