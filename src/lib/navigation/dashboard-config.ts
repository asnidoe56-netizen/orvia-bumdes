export type NavItem = {
  label: string;
  href?: string;
  children?: NavItem[];
};

export const platformNav: NavItem[] = [
  { label: "Ringkasan Platform", href: "/platform/dashboard" },
  { label: "Registrasi BUMDes", href: "/platform/dashboard/registrations" },
  { label: "Registrasi Pendamping", href: "/platform/dashboard/pendamping-registrations" },
  { label: "Registrasi Pengawas", href: "/platform/dashboard/pengawas-registrations" },
  { label: "Registrasi Bupati", href: "/platform/dashboard/bupati-registrations" },
  { label: "Data BUMDes", href: "/platform/dashboard/bumdes" },
  { label: "Users & Role", href: "/platform/dashboard/users" },
  { label: "Governance", href: "/platform/dashboard/governance" },
  { label: "Konten Publik", href: "/platform/dashboard/public-content" },
];

export const bumdesNav: NavItem[] = [
  { label: "Ringkasan BUMDes", href: "/bumdes/dashboard" },
  { label: "Master Plan", href: "/bumdes/dashboard/master-plan" },
  { label: "Unit Usaha", href: "/bumdes/dashboard/units" },
  { label: "Pengaturan", href: "/bumdes/dashboard/pengaturan" },
  { label: "Pengguna", href: "/bumdes/dashboard/users" },
  { label: "Laporan Konsolidasi", href: "/bumdes/dashboard/reports" },
  { label: "Monitoring", href: "/bumdes/dashboard/monitoring" },
  { label: "Cut-off Migrasi", href: "/bumdes/dashboard/cutoff-migrasi" },
  { label: "Bagi Hasil", href: "/bumdes/dashboard/bagi-hasil" },
  { label: "Manajemen Periode", href: "/bumdes/dashboard/periode-akuntansi" },
  { label: "Persetujuan Audit", href: "/bumdes/dashboard/akses-audit" },
  { label: "Koreksi Transaksi", href: "/bumdes/dashboard/koreksi-transaksi" },
];

export const unitNav: NavItem[] = [
  { label: "Ringkasan Unit", href: "/unit/dashboard" },
  { label: "Master Data", href: "/unit/dashboard/master-data" },
  { label: "Cut-off Migrasi", href: "/unit/dashboard/cutoff-migrasi" },
  { label: "Daftar Stok Tersedia", href: "/unit/dashboard/daftar-stok" },
  { label: "Catat Transaksi", href: "/unit/dashboard/catat-transaksi" },
  { label: "Cek Alur Transaksi", href: "/unit/dashboard/cek-alur-transaksi" },
  { label: "Riwayat Pembelian", href: "/unit/dashboard/purchasing" },
  { label: "Riwayat Penjualan", href: "/unit/dashboard/sales" },
  { label: "Kas & Bank", href: "/unit/dashboard/cash-bank" },
  { label: "Aset Tetap", href: "/unit/dashboard/aset-tetap" },
  { label: "Buku Jurnal", href: "/unit/dashboard/reports/buku-jurnal" },
  { label: "Laporan", href: "/unit/dashboard/reports" },
];

export const pengawasNav: NavItem[] = [
  { label: "Audit", href: "/pengawas/dashboard" },
  { label: "Koreksi Transaksi", href: "/pengawas/dashboard/koreksi-transaksi" },
  { label: "Cut-off Migrasi", href: "/pengawas/dashboard/cutoff-migrasi" },
  { label: "Audit Konsistensi", href: "/pengawas/dashboard/audit-konsistensi" },
  { label: "Transparansi Transaksi", href: "/pengawas/dashboard/transparansi-transaksi" },
  { label: "Laporan", href: "/pengawas/dashboard/reports" },
];

export const pendampingNav: NavItem[] = [
  { label: "Pendampingan", href: "/pendamping/dashboard" },
  { label: "Review Proposal", href: "/pendamping/dashboard/business-plans" },
  { label: "Progress BUMDes", href: "/pendamping/dashboard/bumdes-progress" },
];

export const dinasPmdNav: NavItem[] = [
  { label: "Monitoring", href: "/dinas-pmd/dashboard" },
  { label: "Laporan", href: "/dinas-pmd/dashboard/reports" },
];

export const inspektoratNav: NavItem[] = [
  { label: "Temuan Audit", href: "/inspektorat/dashboard" },
  { label: "Kepatuhan", href: "/inspektorat/dashboard/compliance" },
];

export const bupatiNav: NavItem[] = [
  { label: "Executive Summary", href: "/bupati/dashboard" },
  { label: "Kinerja Daerah", href: "/bupati/dashboard/regional-performance" },
];






