import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { platformNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function PlatformDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["super_admin_platform"]);

  return (
    <DashboardShell
      title="Dashboard Platform"
      subtitle="Kontrol registrasi, tenant, user, dan governance global."
      navItems={platformNav}
    >
      {children}
    </DashboardShell>
  );
}
