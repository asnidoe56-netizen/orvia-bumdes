"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package,
  ShieldCheck,
  ShoppingCart,
  Store,
  TrendingUp,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

type SidebarItemProps = {
  href: string;
  label: string;
};

const iconMap: Record<string, LucideIcon> = {
  "Ringkasan Platform": LayoutDashboard,
  "Registrasi BUMDes": ClipboardList,
  "Data BUMDes": Building2,
  "Users & Role": UsersRound,
  Governance: ShieldCheck,

  "Ringkasan BUMDes": LayoutDashboard,
  "Master Plan": ClipboardList,
  "Unit Usaha": Store,
  "Laporan BUMDes": BarChart3,
  Monitoring: Activity,

  "Ringkasan Unit": LayoutDashboard,
  Penjualan: ShoppingCart,
  Pembelian: ClipboardCheck,
  Inventory: Package,
  "Cash Bank": WalletCards,
  Laporan: FileText,

  Audit: ShieldCheck,
  "Review Proposal": ClipboardCheck,
  "Progress BUMDes": TrendingUp,
  Compliance: ClipboardCheck,
  "Regional Performance": BarChart3,
};

function isRootDashboardPath(href: string) {
  return href.endsWith("/dashboard");
}

export function SidebarItem({ href, label }: SidebarItemProps) {
  const pathname = usePathname();

  const isActive = isRootDashboardPath(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  const Icon = iconMap[label] ?? LayoutDashboard;

  return (
    <Link
      href={href}
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

      <span className="truncate">{label}</span>
    </Link>
  );
}

