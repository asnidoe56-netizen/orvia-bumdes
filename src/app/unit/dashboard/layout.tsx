import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { unitNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function UnitDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["manager_unit", "operator_unit", "viewer_unit"]);

  return (
    <DashboardShell
      title="Dashboard Unit"
      subtitle="Operasional unit: pembelian, penjualan, inventory, kas-bank, dan laporan."
      navItems={unitNav}
    >
      {children}
    </DashboardShell>
  );
}
