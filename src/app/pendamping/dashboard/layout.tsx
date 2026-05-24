import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { pendampingNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function PendampingDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["pendamping"]);

  return (
    <DashboardShell
      title="Dashboard Pendamping"
      subtitle="Pendampingan dan progress pengembangan BUMDes."
      navItems={pendampingNav}
    >
      {children}
    </DashboardShell>
  );
}
