import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { bupatiNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function BupatiDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loginContext = await requireRole(["bupati"]);

  return (
    <DashboardShell
      title="Dashboard Bupati"
      subtitle="Executive summary dan performa BUMDes daerah."
      navItems={bupatiNav}
      loginContext={loginContext}
    >
      {children}
    </DashboardShell>
  );
}

