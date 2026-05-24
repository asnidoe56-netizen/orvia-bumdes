import { redirect } from "next/navigation";
import { getLoginContext } from "@/lib/auth/get-login-context";
import type { AppRole } from "@/types/auth";

export async function requireRole(allowedRoles: AppRole[]) {
  const context = await getLoginContext();

  if (!context?.role) {
    redirect("/login");
  }

  if (!allowedRoles.includes(context.role)) {
    redirect(context.redirect_path || "/login");
  }

  return context;
}
