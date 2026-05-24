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
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden h-screen w-72 border-r border-slate-200 bg-white p-5 lg:flex lg:flex-col">
        <div className="shrink-0 rounded-2xl bg-emerald-700 p-4 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            ERP BUMDes
          </p>
          <h1 className="mt-1 text-lg font-bold">{title}</h1>
        </div>

        <nav className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1">
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

          <aside className="relative flex h-full w-80 max-w-[85vw] flex-col bg-white p-5 shadow-2xl">
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="rounded-2xl bg-emerald-700 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                  ERP BUMDes
                </p>
                <h1 className="mt-1 text-lg font-bold">{title}</h1>
              </div>

              <button
                type="button"
                aria-label="Tutup menu"
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav
              className="mt-6 flex-1 space-y-1 overflow-y-auto pr-1"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href ?? item.label} item={item} />
              ))}
            </nav>
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen lg:pl-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Buka menu"
                className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm hover:bg-slate-50 lg:hidden"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <h2 className="text-lg font-bold text-slate-950 sm:text-xl">
                  {title}
                </h2>
                <p className="text-xs text-slate-600 sm:text-sm">{subtitle}</p>
              </div>
            </div>

            <LogoutButton />
          </div>
        </header>

        <main className="p-4 sm:p-5">{children}</main>
      </div>
    </div>
  );
}
