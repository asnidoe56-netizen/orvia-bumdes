import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, LoginContext } from "@/types/auth";

export type OrviaAiScope = "unit" | "tenant";

export type OrviaAiContext = {
  userId: string;
  role: AppRole;
  tenantId: string;
  unitId: string | null;
  scope: OrviaAiScope;
  fullName?: string | null;
  loginContext: LoginContext;
};

const UNIT_AI_ROLES: AppRole[] = ["manager_unit", "operator_unit", "viewer_unit"];

const TENANT_AI_ROLES: AppRole[] = [
  "direktur_bumdes",
  "admin_bumdes",
  "pengawas",
];

const INITIAL_ALLOWED_AI_ROLES: AppRole[] = [
  ...UNIT_AI_ROLES,
  ...TENANT_AI_ROLES,
];

async function assertOrviaAiTenantAccess(tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("is_orvia_ai_enabled_for_tenant", {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(
      `Izin ORVIA AI tenant belum dapat diverifikasi: ${error.message}`
    );
  }

  if (data !== true) {
    throw new Error(
      "ORVIA AI belum diaktifkan untuk BUMDes ini oleh Super Admin Platform."
    );
  }
}
/**
 * Central context guard for ORVIA AI / future MCP tools.
 *
 * Hard rules:
 * - tenant_id is always taken from authenticated login context
 * - unit_id is always taken from authenticated login context for unit roles
 * - never trust tenant_id or unit_id from prompt/user text
 * - no posting permission is granted here
 */
export async function getOrviaAiContext(): Promise<OrviaAiContext> {
  const context = await getLoginContext();

  if (!context?.user_id || !context.role) {
    throw new Error("Sesi AI tidak valid. Silakan login ulang.");
  }

  if (!INITIAL_ALLOWED_AI_ROLES.includes(context.role)) {
    throw new Error("Role ini belum diizinkan memakai ORVIA AI.");
  }

  if (!context.tenant_id) {
    throw new Error("Konteks tenant tidak ditemukan.");
  }

  await assertOrviaAiTenantAccess(context.tenant_id);

  const scope: OrviaAiScope = UNIT_AI_ROLES.includes(context.role)
    ? "unit"
    : "tenant";

  if (scope === "unit" && !context.unit_id) {
    throw new Error("Konteks unit tidak ditemukan untuk role unit.");
  }

  return {
    userId: context.user_id,
    role: context.role,
    tenantId: context.tenant_id,
    unitId: context.unit_id,
    scope,
    fullName: context.full_name ?? null,
    loginContext: context,
  };
}

export function isUnitAiRole(role: AppRole) {
  return UNIT_AI_ROLES.includes(role);
}

export function isTenantAiRole(role: AppRole) {
  return TENANT_AI_ROLES.includes(role);
}
