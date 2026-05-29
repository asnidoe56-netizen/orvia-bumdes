import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { PublicLandingSection } from "@/lib/public/landing-content";

type PublicCtaSectionProps = {
  section?: PublicLandingSection;
};

const trustPoints = [
  "Transparansi proses",
  "Laporan lebih jernih",
  "Peran dan tanggung jawab jelas",
];

export function PublicCtaSection({ section }: PublicCtaSectionProps) {
  return (
    <section
      id="tentang"
      className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            {section?.eyebrow ?? "Tentang ORVIA-BUMDES"}
          </p>

          <h2 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">
            {section?.title ??
              "Platform tata kelola yang menjaga kepercayaan publik desa."}
          </h2>

          <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-300 sm:text-base">
            {section?.subtitle ??
              "ORVIA-BUMDES membantu BUMDes mengelola usaha, transaksi, laporan, pendampingan, dan pengawasan dalam satu ekosistem digital yang tertib dan transparan."}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {trustPoints.map((point) => (
              <div
                key={point}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                {point}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-emerald-950/30">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            Filosofi
          </p>

          <h3 className="mt-4 text-2xl font-black leading-tight">
            Usaha desa yang kuat lahir dari tata kelola yang jernih.
          </h3>

          <p className="mt-4 text-sm leading-7 text-slate-300">
            Ketika data tertib, laporan lebih mudah dipercaya. Ketika proses
            transparan, keputusan menjadi lebih bertanggung jawab. Ketika semua
            pihak terhubung, BUMDes dapat tumbuh sebagai kekuatan ekonomi desa
            yang sehat dan bermakna bagi masyarakat.
          </p>

          <Link
            href={section?.cta_href ?? "/tentang"}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
          >
            {section?.cta_label ?? "Baca Tentang ORVIA-BUMDES"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
