import type { AppRole } from "@/types/auth";

export const roleRedirectMap: Record<AppRole, string> = {
  super_admin_platform: "/platform/dashboard",
  direktur_bumdes: "/bumdes/dashboard",
  admin_bumdes: "/bumdes/dashboard",
  manager_unit: "/unit/dashboard",
  operator_unit: "/unit/dashboard",
  viewer_unit: "/unit/dashboard",
  pengawas: "/pengawas/dashboard",
  pendamping: "/pendamping/dashboard",
  dinas_pmd: "/dinas-pmd/dashboard",
  inspektorat: "/inspektorat/dashboard",
  bupati: "/bupati/dashboard",
};

export function getFallbackRedirectPath(role?: AppRole | null) {
  if (!role) return "/login";
  return roleRedirectMap[role] ?? "/login";
}
