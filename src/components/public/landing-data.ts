import {
  Building2,
  CheckCircle2,
  LayoutDashboard,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

export const publicNavItems = [
  { label: "Beranda", href: "/" },
  { label: "Aplikasi", href: "#aplikasi" },
  { label: "Manajemen", href: "#manajemen" },
  { label: "Berita", href: "#berita" },
  { label: "Tentang", href: "#tentang" },
];

export const featureCards = [
  {
    title: "Multi-Tenant",
    description:
      "Satu sistem melayani banyak BUMDes dengan scope tenant dan unit yang terpisah.",
    icon: UsersRound,
  },
  {
    title: "Role-Based Dashboard",
    description:
      "Dashboard berbeda untuk Platform, BUMDes, Unit, Pengawas, Pendamping, Dinas PMD, Inspektorat, dan Bupati.",
    icon: LayoutDashboard,
  },
  {
    title: "Governance Engine",
    description:
      "Transaksi, jurnal, koreksi, closing, dan audit dikendalikan melalui database RPC yang aman.",
    icon: ShieldCheck,
  },
];

export const trustItems = [
  { value: "200+", label: "BUMDes Terdaftar" },
  { value: "1.2K+", label: "Unit Usaha Terkelola" },
  { value: "95%", label: "Proses Teregistrasi" },
  { value: "100%", label: "Audit Trail Terjaga" },
];

export const philosophyItems = [
  {
    title: "Aman & Terpercaya",
    description: "Keamanan berlapis dan audit trail penuh.",
    icon: ShieldCheck,
  },
  {
    title: "Selalu Tersinkron",
    description: "Data real-time, andal, dan konsisten.",
    icon: CheckCircle2,
  },
  {
    title: "Kolaboratif & Transparan",
    description: "Workflow jelas, akuntabel, dan terbuka.",
    icon: UsersRound,
  },
  {
    title: "Mendorong Kemandirian Desa",
    description: "Tata kelola baik untuk dampak nyata.",
    icon: Building2,
  },
];

export const publicContentPreviewSections = [
  {
    id: "aplikasi",
    eyebrow: "Aplikasi",
    title: "Satu ekosistem kerja untuk banyak peran.",
    description:
      "Bagian ini nanti dapat diatur dari database Super Admin Platform: headline, deskripsi, daftar fitur, icon, urutan tampil, dan status publikasi.",
    tone: "white",
  },
  {
    id: "manajemen",
    eyebrow: "Manajemen",
    title: "Konten manajemen akan dikelola dari dashboard platform.",
    description:
      "Ini disiapkan sebagai placeholder awal sebelum modul CMS publik dibuat di Super Admin Platform.",
    tone: "slate",
  },
  {
    id: "berita",
    eyebrow: "Berita",
    title: "Ruang publikasi perkembangan BUMDes.",
    description:
      "Artikel, pengumuman, dan informasi publik nanti dapat dimasukkan melalui database dan halaman Super Admin Platform.",
    tone: "orange",
  },
];
