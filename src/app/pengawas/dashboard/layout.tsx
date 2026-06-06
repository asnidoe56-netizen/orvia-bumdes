import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { pengawasNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function PengawasDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loginContext = await requireRole(["pengawas"]);

  return (
    <DashboardShell
      title="Dashboard Pengawas"
      subtitle="Audit internal dan review laporan BUMDes."
      navItems={pengawasNav}
      loginContext={loginContext}
    >
      {children}
    </DashboardShell>
  );
}

