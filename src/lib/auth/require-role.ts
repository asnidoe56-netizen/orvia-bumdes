import { redirect } from "next/navigation";
import { getLoginContext } from "@/lib/auth/get-login-context";
import type { AppRole } from "@/types/auth";

const tenantOperationalRoles: AppRole[] = [
  "direktur_bumdes",
  "admin_bumdes",
  "manager_unit",
  "operator_unit",
  "viewer_unit",
];

export async function requireRole(allowedRoles: AppRole[]) {
  const context = await getLoginContext();

  if (!context?.role) {
    redirect("/login");
  }

  if (
    context.tenant_id &&
    context.tenant_status === "suspended" &&
    tenantOperationalRoles.includes(context.role)
  ) {
    redirect("/tenant-suspended");
  }

  if (!allowedRoles.includes(context.role)) {
    redirect(context.redirect_path || "/login");
  }

  return context;
}
