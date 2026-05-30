import Link from "next/link";
import { PageBackButton } from "@/components/ui/page-back-button";

const modules = [
  {
    title: "Data Anggota",
    description: "Kelola anggota/nasabah unit simpan pinjam berdasarkan scope tenant dan unit login.",
    href: "/unit/dashboard/simpan-pinjam/anggota",
    status: "Backend PASS",
  },
  {
    title: "Kelompok Anggota",
    description: "Kelola kelompok, ketua, dan relasi anggota kelompok simpan pinjam.",
    href: "/unit/dashboard/simpan-pinjam/kelompok",
    status: "Backend PASS",
  },
  {
    title: "Pengajuan Pinjaman",
    description: "Catat pengajuan pinjaman perorangan dan kelompok dengan dokumen PDF wajib.",
    href: "/unit/dashboard/simpan-pinjam/pengajuan",
    status: "Backend PASS",
  },
  {
    title: "Simpanan Anggota",
    description: "Placeholder untuk engine simpanan anggota pada tahap berikutnya.",
    href: "/unit/dashboard/simpan-pinjam/simpanan",
    status: "Tahap berikutnya",
  },
  {
    title: "Pencairan Pinjaman",
    description: "Placeholder untuk engine pencairan setelah analisis dan persetujuan pinjaman.",
    href: "/unit/dashboard/simpan-pinjam/pencairan",
    status: "Tahap berikutnya",
  },
  {
    title: "Angsuran Pinjaman",
    description: "Placeholder untuk engine angsuran, tunggakan, dan kolektibilitas.",
    href: "/unit/dashboard/simpan-pinjam/angsuran",
    status: "Tahap berikutnya",
  },
];

export default function SimpanPinjamOverviewPage() {
  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Front Office Simpan Pinjam
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Modul ini dipisahkan dari alur perdagangan agar data anggota, kelompok,
          dan pengajuan pinjaman tidak bercampur dengan supplier, customer,
          persediaan barang, pembelian, dan penjualan.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">
                {module.title}
              </h2>
              <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {module.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {module.description}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
