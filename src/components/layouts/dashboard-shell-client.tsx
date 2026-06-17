"use client";

import { MouseEvent, ReactNode, useEffect, useState } from "react";
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { GlobalActionNotice } from "@/components/ui/global-action-notice";
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingFromPathname, setPendingFromPathname] = useState<string | null>(null);

  useEffect(() => {
    if (!pendingHref) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setPendingHref(null);
      setPendingFromPathname(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [pendingHref]);

  function handleMobileNavClick(event: MouseEvent<HTMLElement>) {
    const target = event.target as HTMLElement;
    const link = target.closest("a[href]") as HTMLAnchorElement | null;

    if (!link) return;

    const nextHref = link.getAttribute("href");
    const nextPathname = nextHref?.split(/[?#]/)[0];

    setIsMobileMenuOpen(false);

    if (
      nextPathname &&
      nextPathname.startsWith("/") &&
      nextPathname !== pathname
    ) {
      setPendingHref(nextPathname);
      setPendingFromPathname(pathname);
    }
  }

  const isRoutePending = Boolean(
    pendingHref &&
      pendingFromPathname === pathname &&
      pendingHref !== pathname
  );

  const displayName = getDisplayName(loginContext);
  const initials = getInitials(displayName);
  const roleLabel = getRoleLabel(loginContext?.role);
  const scopeLabel = getScopeLabel(loginContext);

  return (
    <div className="min-h-screen overflow-x-hidden bg-slate-100">
      <GlobalActionNotice />

      {isRoutePending ? (
        <div className="fixed inset-x-0 top-0 z-[60]">
          <div className="h-1 w-full overflow-hidden bg-emerald-100">
            <div className="h-full w-full rounded-r-full bg-emerald-600 shadow-sm shadow-emerald-300" />
          </div>

          <div className="mx-auto mt-2 w-fit rounded-full border border-emerald-100 bg-white/95 px-3 py-1 text-xs font-bold text-emerald-700 shadow-sm backdrop-blur">
            Memuat halaman...
          </div>
        </div>
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-30 hidden h-dvh border-r border-slate-200 bg-white transition-all duration-300 lg:flex lg:flex-col",
          isSidebarCollapsed ? "w-24 p-4" : "w-72 p-5",
        ].join(" ")}
      >
        <div
          className={[
            "shrink-0 rounded-2xl bg-emerald-700 text-white transition-all duration-300",
            isSidebarCollapsed
              ? "flex h-16 items-center justify-center p-0"
              : "p-4",
          ].join(" ")}
          title={title}
        >
          {isSidebarCollapsed ? (
            <span className="text-sm font-black tracking-tight">ERP</span>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                ERP BUMDes
              </p>
              <h1 className="mt-1 truncate text-lg font-bold">{title}</h1>
            </>
          )}
        </div>

        <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href ?? item.label} item={item} collapsed={isSidebarCollapsed} />
          ))}
        </nav>

        <div className="mt-4 shrink-0 border-t border-slate-200 pt-4">
          {isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-600 text-xs font-black text-white shadow-sm"
                title={`${displayName} - ${roleLabel}`}
              >
                {initials}
              </div>

              <div className="max-w-16 overflow-hidden">
                <LogoutButton />
              </div>
            </div>
          ) : (
            <>
              <div className="mb-3 rounded-2xl bg-slate-50 p-3">
                <p className="truncate text-sm font-black text-slate-950">
                  {displayName}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                  {roleLabel}
                </p>
              </div>

              <LogoutButton />
            </>
          )}
        </div>
      </aside>

      {isMobileMenuOpen ? (
        <div className="fixed inset-0 z-40 overflow-hidden overscroll-none lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-950/50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          <aside className="relative h-dvh max-h-dvh w-80 max-w-[85vw] overflow-hidden bg-white shadow-2xl">
            <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain p-5 pb-8">
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
                className="mt-6 shrink-0 space-y-1 pr-1"
                onClick={handleMobileNavClick}
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
            </div>
          </aside>
        </div>
      ) : null}

      <div
        className={[
          "min-h-screen min-w-0 transition-all duration-300",
          isSidebarCollapsed ? "lg:pl-24" : "lg:pl-72",
        ].join(" ")}
      >
        <header
          className={[
            "fixed inset-x-0 top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur transition-all duration-300 sm:px-5",
            isSidebarCollapsed ? "lg:left-24" : "lg:left-72",
          ].join(" ")}
        >
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

              <button
                type="button"
                aria-label={isSidebarCollapsed ? "Perlebar menu" : "Ringkas menu"}
                title={isSidebarCollapsed ? "Perlebar menu" : "Ringkas menu"}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 lg:inline-flex"
                onClick={() => setIsSidebarCollapsed((current) => !current)}
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="h-5 w-5" />
                ) : (
                  <PanelLeftClose className="h-5 w-5" />
                )}
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








