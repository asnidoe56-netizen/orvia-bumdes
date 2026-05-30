import { PageBackButton } from "@/components/ui/page-back-button";

export default function Page() {
  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Pencairan Pinjaman
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Placeholder. Engine pencairan pinjaman akan dibuat setelah tahap analisis dan persetujuan pinjaman.
        </p>
      </section>
    </div>
  );
}
