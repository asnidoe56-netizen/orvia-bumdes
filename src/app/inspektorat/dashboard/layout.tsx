import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { inspektoratNav } from "@/lib/navigation/dashboard-config";
import { requireRole } from "@/lib/auth/require-role";

export default async function InspektoratDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const loginContext = await requireRole(["inspektorat"]);

  return (
    <DashboardShell
      title="Dashboard Inspektorat"
      subtitle="Audit findings dan compliance monitoring."
      navItems={inspektoratNav}
      loginContext={loginContext}
    >
      {children}
    </DashboardShell>
  );
}

