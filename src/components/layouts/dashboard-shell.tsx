"use client";

import { ReactNode, useState } from "react";
import { Menu, X } from "lucide-react";
import { SidebarMenuItem } from "@/components/layouts/sidebar-menu-item";
import { LogoutButton } from "@/components/auth/logout-button";
import type { NavItem } from "@/lib/navigation/dashboard-config";

type DashboardShellProps = {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  navItems,
  children,
}: DashboardShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-72 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col">
        <div className="shrink-0 rounded-2xl bg-emerald-700 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            ERP BUMDes
          </p>
          <h1 className="mt-1 truncate text-lg font-bold">{title}</h1>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-1">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href ?? item.label} item={item} />
          ))}
        </nav>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside className="relative flex h-full w-80 max-w-[85vw] flex-col overflow-hidden bg-white p-5 shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1 rounded-2xl bg-emerald-700 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  ERP BUMDes
                </p>
                <h1 className="mt-1 truncate text-lg font-bold">{title}</h1>
              </div>

              <button
                type="button"
                aria-label="Tutup menu"
                className="shrink-0 rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav
              className="mt-6 flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-1"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href ?? item.label} item={item} />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen min-w-0 lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5 lg:left-72">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                aria-label="Buka menu"
                className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold text-slate-950 sm:text-xl">
                  {title}
                </h2>
                <p className="truncate text-xs text-slate-600 sm:text-sm">
                  {subtitle}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <LogoutButton />
            </div>
          </div>
        </header>

        <main className="min-w-0 overflow-x-hidden px-4 pb-4 pt-24 sm:px-5 sm:pb-5 sm:pt-24">
          {children}
        </main>
      </div>
    </div>
  );
}
