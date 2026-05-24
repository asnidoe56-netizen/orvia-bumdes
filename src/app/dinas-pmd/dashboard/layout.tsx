import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { dinasPmdNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function DinasPmdDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["dinas_pmd"]);

  return (
    <DashboardShell
      title="Dashboard Dinas PMD"
      subtitle="Monitoring BUMDes di wilayah pemerintahan daerah."
      navItems={dinasPmdNav}
    >
      {children}
    </DashboardShell>
  );
}
