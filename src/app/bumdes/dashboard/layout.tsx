import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { bumdesNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function BumdesDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["direktur_bumdes", "admin_bumdes"]);

  return (
    <DashboardShell
      title="Dashboard BUMDes"
      subtitle="Monitoring tenant, unit usaha, user, dan laporan konsolidasi."
      navItems={bumdesNav}
    >
      {children}
    </DashboardShell>
  );
}
