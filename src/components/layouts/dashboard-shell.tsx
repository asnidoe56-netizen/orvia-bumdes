import { ReactNode } from "react";
import { DashboardShellClient } from "@/components/layouts/dashboard-shell-client";
import type { LoginContext } from "@/types/auth";
import type { NavItem } from "@/lib/navigation/dashboard-config";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  loginContext: LoginContext | null;
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  navItems,
  loginContext,
  children,
}: DashboardShellProps) {
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
