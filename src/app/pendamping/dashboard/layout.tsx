import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { pendampingNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function PendampingDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["pendamping_kecamatan"]);

  return (
    <DashboardShell
      title="Dashboard Pendamping Kecamatan"
      subtitle="Review proposal, pendampingan, dan progress pengembangan BUMDes di wilayah kerja."
      navItems={pendampingNav}
    >
      {children}
    </DashboardShell>
  );
}

