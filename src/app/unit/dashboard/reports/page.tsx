import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpenText,
  FileSpreadsheet,
  Gauge,
  Landmark,
  LineChart,
  WalletCards,
  ShieldCheck,
} from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";

const reportCards = [
  {
    title: "Buku Besar",
    description:
      "Melihat seluruh mutasi jurnal per akun, debit, kredit, sumber transaksi, dan saldo berjalan.",
    href: "/unit/dashboard/reports/buku-besar",
    icon: BookOpenText,
    status: "Database",
  },
  {
    title: "Paket Laporan Kepmen 136",
    description:
      "Membuka paket laporan Kepmen 136: Neraca, Laba Rugi, Arus Kas, Perubahan Ekuitas, CALK, dan Validasi.",
    href: "/unit/dashboard/reports/kepmen-136",
    icon: ShieldCheck,
    status: "Kepmen 136",
  },
  {
    title: "Laba Rugi",
    description:
      "Melihat pendapatan, HPP, beban operasional, dan hasil usaha unit dalam satu periode.",
    href: "/unit/dashboard/reports/laba-rugi",
    icon: BarChart3,
    status: "Pondasi",
  },
  {
    title: "Neraca",
    description:
      "Melihat posisi aset, kewajiban, dan ekuitas unit berdasarkan data jurnal dan saldo akun.",
    href: "/unit/dashboard/reports/neraca",
    icon: Landmark,
    status: "Pondasi",
  },
  {
    title: "Perubahan Ekuitas",
    description:
      "Melihat perubahan modal, laba berjalan, koreksi, dan distribusi ekuitas unit.",
    href: "/unit/dashboard/reports/perubahan-ekuitas",
    icon: LineChart,
    status: "Pondasi",
  },
  {
    title: "Arus Kas",
    description:
      "Melihat arus kas masuk dan keluar dari aktivitas operasional, investasi, dan pendanaan.",
    href: "/unit/dashboard/reports/arus-kas",
    icon: WalletCards,
    status: "Pondasi",
  },
  {
    title: "Skoring",
    description:
      "Melihat skor kesehatan unit berdasarkan indikator keuangan, operasional, dan kepatuhan.",
    href: "/unit/dashboard/reports/skoring",
    icon: Gauge,
    status: "Pondasi",
  },
];

export default function UnitReportsPage() {
  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Laporan
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Laporan Unit
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pusat laporan keuangan dan kesehatan usaha unit. Pondasi frontend
              ini akan dihubungkan bertahap ke reporting views database agar
              hasil laporan konsisten dengan jurnal, kas-bank, aset, penyusutan,
              pembelian, penjualan, dan closing.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Laporan Tersedia
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {reportCards.length}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Pondasi laporan utama unit.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Sumber Data
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            Database
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Nanti dibaca dari reporting views.
          </p>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">
            Status Pondasi
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            Siap
          </p>
          <p className="mt-2 text-sm text-emerald-800">
            Siap dihubungkan ke engine laporan.
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-lg font-bold text-slate-950">
            Daftar Laporan
          </h2>
          <p className="text-sm leading-6 text-slate-600">
            Pilih jenis laporan yang ingin dibuka. Untuk tahap ini, halaman
            detail disiapkan sebagai pondasi sebelum query reporting view dibuat.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportCards.map((report) => {
            const Icon = report.icon;

            return (
              <Link
                key={report.href}
                href={report.href}
                className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {report.status}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-950">
                  {report.title}
                </h3>

                <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
                  {report.description}
                </p>

                <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-700">
                  Buka laporan
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
