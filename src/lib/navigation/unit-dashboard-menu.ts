import type { NavItem } from "@/lib/navigation/dashboard-config";
import { unitNav } from "@/lib/navigation/dashboard-config";

export const savingsLoanUnitNav: NavItem[] = [
  { label: "Ringkasan Unit", href: "/unit/dashboard" },
  { label: "Master Data", href: "/unit/dashboard/master-data" },
  { label: "Catat Transaksi", href: "/unit/dashboard/catat-transaksi" },
  { label: "Data Anggota", href: "/unit/dashboard/simpan-pinjam/anggota" },
  { label: "Kelompok Anggota", href: "/unit/dashboard/simpan-pinjam/kelompok" },
  { label: "Pengajuan Pinjaman", href: "/unit/dashboard/simpan-pinjam/pengajuan" },
  { label: "Simpanan Anggota", href: "/unit/dashboard/simpan-pinjam/simpanan" },
  { label: "Pencairan Pinjaman", href: "/unit/dashboard/simpan-pinjam/pencairan" },
  { label: "Angsuran Pinjaman", href: "/unit/dashboard/simpan-pinjam/angsuran" },
  { label: "Kas & Bank", href: "/unit/dashboard/cash-bank" },
  { label: "Aset Tetap", href: "/unit/dashboard/aset-tetap" },
  { label: "Laporan", href: "/unit/dashboard/reports" },
];

type UnitMenuContext = {
  templateCode?: string | null;
  jenisUnit?: string | null;
};

function normalize(value?: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
}

export function isSavingsLoanUnit(context: UnitMenuContext) {
  const templateCode = normalize(context.templateCode);
  const jenisUnit = normalize(context.jenisUnit);

  return templateCode === "SIMPAN_PINJAM" || jenisUnit.includes("SIMPAN_PINJAM");
}

export function getUnitDashboardNav(context: UnitMenuContext): NavItem[] {
  return isSavingsLoanUnit(context) ? savingsLoanUnitNav : unitNav;
}



