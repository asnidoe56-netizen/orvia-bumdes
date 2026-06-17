"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Database,
  Landmark,
  FileText,
  HandCoins,
  LayoutDashboard,
  Package,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Store,
  Settings,
  TrendingUp,
  Truck,
  UserRoundCheck,
  UsersRound,
  WalletCards,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { NavItem } from "@/lib/navigation/dashboard-config";

type SidebarMenuItemProps = {
  item: NavItem;
  collapsed?: boolean;
  onCollapsedTooltipChange?: (tooltip: { label: string; top: number } | null) => void;
};

const iconMap: Record<string, LucideIcon> = {
  "Ringkasan Platform": LayoutDashboard,
  "Registrasi BUMDes": ClipboardList,
  "Registrasi Pendamping": UsersRound,
  "Registrasi Bupati": UserRoundCheck,
  "Data BUMDes": Building2,
  "Users & Role": UsersRound,
  Governance: ShieldCheck,
  "Konten Publik": FileText,

  "Ringkasan BUMDes": LayoutDashboard,
  "Master Plan": ClipboardList,
  "Unit Usaha": Store,
  "Pengaturan": Settings,
  Pengguna: UsersRound,
  "Laporan Konsolidasi": BarChart3,
  Monitoring: Activity,
  "Bagi Hasil": HandCoins,
  "Koreksi Transaksi": RotateCcw,

  "Ringkasan Unit": LayoutDashboard,
  "Data Anggota": UsersRound,
  "Kelompok Anggota": UsersRound,
  "Pengajuan Pinjaman": ClipboardList,
  "Simpanan Anggota": WalletCards,
  "Pencairan Pinjaman": HandCoins,
  "Angsuran Pinjaman": HandCoins,
  "Master Data": Database,
  Landmark,
  "Catat Transaksi": ReceiptText,
  "Cek Alur Transaksi": Workflow,
  "Persediaan Barang": Package,
  "Daftar Stok Tersedia": Package,
  ReceiptText,
  RotateCcw,
  Supplier: Truck,
  UserRoundCheck,
  Customer: UsersRound,
  Pembelian: ClipboardCheck,
  "Riwayat Pembelian": ClipboardCheck,
  Penjualan: ShoppingCart,
  "Riwayat Penjualan": ShoppingCart,
  "Kas & Bank": WalletCards,
  Workflow,
  "Aset Tetap": Landmark,
  "Buku Jurnal": FileText,
  Laporan: FileText,

  Audit: ShieldCheck,
  Pendampingan: UsersRound,
  "Review Proposal": ClipboardCheck,
  "Progress BUMDes": TrendingUp,
  "Temuan Audit": ShieldCheck,
  Kepatuhan: ClipboardCheck,
  "Executive Summary": BarChart3,
  "Kinerja Daerah": TrendingUp,
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

export function SidebarMenuItem({ item, collapsed = false, onCollapsedTooltipChange }: SidebarMenuItemProps) {
  const pathname = usePathname();

  const hasChildren = Boolean(item.children?.length);

  const isChildActive = useMemo(() => {
    return item.children?.some((child) => isPathActive(pathname, child.href)) ?? false;
  }, [item.children, pathname]);

  const [open, setOpen] = useState(isChildActive);

  const Icon = iconMap[item.label] ?? LayoutDashboard;

  function handleCollapsedTooltipEnter(label: string, element: HTMLElement) {
    if (!collapsed || !onCollapsedTooltipChange) return;

    const rect = element.getBoundingClientRect();
    onCollapsedTooltipChange({
      label,
      top: rect.top + rect.height / 2,
    });
  }

  function handleCollapsedTooltipLeave() {
    onCollapsedTooltipChange?.(null);
  }

  if (hasChildren) {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={[
            "group flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition",
            isChildActive
              ? "bg-emerald-50 text-emerald-800 shadow-sm"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
          ].join(" ")}
        >
          <span className="flex min-w-0 items-center gap-3">
            <span
              className={[
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                isChildActive
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" />
            </span>

            {collapsed ? null : <span className="truncate">{item.label}</span>}
          </span>

          <ChevronDown
            className={[
              "h-4 w-4 shrink-0 transition",
              open ? "rotate-180" : "",
            ].join(" ")}
          />
        </button>

        {open ? (
          <div className="ml-4 space-y-1 border-l border-slate-200 pl-3">
            {item.children?.map((child) => {
              const childActive = isPathActive(pathname, child.href);
              const ChildIcon = iconMap[child.label] ?? LayoutDashboard;

              return (
                <Link
                  key={child.href ?? child.label}
                  href={child.href ?? "#"}
                  className={[
                    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition",
                    childActive
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                  ].join(" ")}
                >
                  <ChildIcon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  const isActive = isPathActive(pathname, item.href);

  return (
    <Link
      href={item.href ?? "#"}
      className={[
        "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition",
        isActive
          ? "bg-emerald-50 text-emerald-800 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
          isActive
            ? "bg-emerald-600 text-white shadow-sm"
            : "bg-slate-100 text-slate-500 group-hover:bg-emerald-50 group-hover:text-emerald-700",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </span>

      {collapsed ? null : <span className="truncate">{item.label}</span>}
    </Link>
  );
}















