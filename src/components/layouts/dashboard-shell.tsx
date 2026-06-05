import { ReactNode } from "react";
import { DashboardShellClient } from "@/components/layouts/dashboard-shell-client";
import { getLoginContext } from "@/lib/auth/get-login-context";
import type { NavItem } from "@/lib/navigation/dashboard-config";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
};

export async function DashboardShell({
  title,
  subtitle,
  navItems,
  children,
}: DashboardShellProps) {
  const loginContext = await getLoginContext();

  return (
    <DashboardShellClient
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      loginContext={loginContext}
    >
      {children}
    </DashboardShellClient>
  );
}
