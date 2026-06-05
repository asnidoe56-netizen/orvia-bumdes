"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo, useState } from "react";
import { Bell, Menu, UserRound, X } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { SidebarMenuItem } from "@/components/layouts/sidebar-menu-item";
import type { NavItem } from "@/lib/navigation/dashboard-config";
import type { LoginContext } from "@/types/auth";

type DashboardShellClientProps = {
  title: string;
  subtitle: string;
  navItems: NavItem[];
  loginContext: LoginContext | null;
  children: ReactNode;
};

const roleLabels: Record<string, string> = {
  super_admin_platform: "Super Admin Platform",
  direktur_bumdes: "Direktur BUMDes",
  admin_bumdes: "Admin BUMDes",
  manager_unit: "Manager Unit",
  operator_unit: "Operator Unit",
  viewer_unit: "Viewer Unit",
  pengawas: "Pengawas",
  pendamping_kecamatan: "Pendamping Kecamatan",
  pendamping: "Pendamping",
  dinas_pmd: "Dinas PMD",
  inspektorat: "Inspektorat",
  bupati: "Bupati",
};

function isRootDashboardPath(href: string) {
  return href.endsWith("/dashboard");
}

function isPathActive(pathname: string, href?: string) {
  if (!href) return false;

  if (href === "/unit/dashboard/reports") {
    return pathname === href;
  }

  return isRootDashboardPath(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function getDisplayName(loginContext: LoginContext | null) {
  return loginContext?.full_name?.trim() || "Pengguna";
}

function getInitials(name: string) {
  const words = name
    .split(" ")
    .map((word) => word.trim())
    .filter(Boolean);

  if (words.length === 0) return "U";

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function getRoleLabel(role: string | null | undefined) {
  if (!role) return "Role belum tersedia";
  return roleLabels[role] ?? role.replace(/_/g, " ");
}

function getScopeLabel(loginContext: LoginContext | null) {
  if (!loginContext) return "Belum login";

  if (loginContext.unit_id) {
    return "Scope Unit";
  }

  if (loginContext.tenant_id) {
    return "Scope BUMDes";
  }

  return "Scope Platform";
}

export function DashboardShellClient({
  title,
  subtitle,
  navItems,
  loginContext,
  children,
}: DashboardShellClientProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const topNavItems = useMemo(() => {
    return navItems.filter((item) => item.href).slice(0, 5);
  }, [navItems]);

  const displayName = getDisplayName(loginContext);
  const initials = getInitials(displayName);
  const roleLabel = getRoleLabel(loginContext?.role);
  const scopeLabel = getScopeLabel(loginContext);

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

        <div className="mt-4 shrink-0 border-t border-slate-200 pt-4">
          <div className="mb-3 rounded-2xl bg-slate-50 p-3">
            <p className="truncate text-sm font-black text-slate-950">
              {displayName}
            </p>
            <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
              {roleLabel}
            </p>
          </div>

          <LogoutButton />
        </div>
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

            <div className="mt-4 shrink-0 border-t border-slate-200 pt-4">
              <div className="mb-3 rounded-2xl bg-slate-50 p-3">
                <p className="truncate text-sm font-black text-slate-950">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  {roleLabel}
                </p>
              </div>

              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      <div className="min-h-screen min-w-0 lg:pl-72">
        <header className="fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5 lg:left-72">
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

              <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 sm:flex">
                <UserRound className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-sm font-black text-slate-950 sm:text-base">
                  {title}
                </h2>
                <p className="truncate text-xs text-slate-500">
                  {subtitle}
                </p>
              </div>
            </div>

            <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 xl:flex">
              {topNavItems.map((item) => {
                const active = isPathActive(pathname, item.href);

                return (
                  <Link
                    key={item.href ?? item.label}
                    href={item.href ?? "#"}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-bold transition",
                      active
                        ? "bg-emerald-50 text-emerald-700"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-950",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-label="Notifikasi"
                className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 sm:flex"
              >
                <Bell className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 py-2 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                  {initials}
                </div>

                <div className="hidden min-w-0 leading-tight md:block">
                  <p className="max-w-[150px] truncate text-xs font-black text-slate-950">
                    {displayName}
                  </p>
                  <p className="max-w-[150px] truncate text-[11px] font-semibold text-slate-500">
                    {roleLabel} · {scopeLabel}
                  </p>
                </div>
              </div>


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

