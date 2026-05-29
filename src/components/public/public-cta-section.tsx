import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function PublicCtaSection() {
  return (
    <section id="tentang" className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
            Tentang ORVIA-BUMDES
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight">
            Platform tata kelola yang menjaga kepercayaan publik desa.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
            Konten tentang platform, filosofi, tata kelola, dan visi produk akan
            dikelola dari database platform agar mudah diperbarui.
          </p>
        </div>

        <Link
          href="/register"
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
        >
          Mulai Registrasi
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
