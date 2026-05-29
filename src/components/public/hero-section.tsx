import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { featureCards, trustItems } from "@/components/public/landing-data";

export function HeroSection() {
  return (
    <section id="beranda" className="relative overflow-hidden pt-20">
      <div className="absolute right-0 top-20 h-72 w-72 rounded-full bg-emerald-100/70 blur-3xl" />
      <div className="absolute bottom-0 left-1/2 h-80 w-80 rounded-full bg-orange-100/80 blur-3xl" />
      <div className="absolute right-16 top-48 hidden h-44 w-44 rounded-full border border-emerald-100 lg:block" />

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-20">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            Sistem ERP multi-tenant untuk tata kelola BUMDes
          </div>

          <h1 className="mt-7 max-w-4xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            Satu platform untuk <span className="text-emerald-700">tenant</span>,
            unit usaha, <span className="text-emerald-700">akuntansi</span>,
            transaksi, <span className="text-emerald-700">audit</span>, dan{" "}
            <span className="text-emerald-700">laporan</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Dibangun dengan prinsip database-first sebagai sumber kebenaran.
            Frontend menjadi lapisan workflow dan UI, sementara posting,
            approval, permission, audit, dan governance berjalan melalui engine
            database.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-xl shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Masuk ke Dashboard
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-white px-6 py-4 text-sm font-black text-orange-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-50"
            >
              <Building2 className="h-4 w-4" />
              Daftarkan BUMDes
            </Link>
          </div>

          <div className="mt-8 grid gap-3 rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-4">
            {trustItems.map((item) => (
              <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-2xl font-black text-slate-950">
                  {item.value}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative">
          <div className="absolute -right-4 top-10 h-48 w-48 rounded-full bg-orange-100 blur-3xl" />
          <div className="absolute -left-6 bottom-10 h-56 w-56 rounded-full bg-emerald-100 blur-3xl" />

          <div className="relative rounded-[2rem] border border-slate-200 bg-white/90 p-4 shadow-2xl shadow-slate-200/80 backdrop-blur">
            <div className="space-y-4">
              {featureCards.map((feature, index) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className={[
                      "rounded-3xl border border-slate-200 bg-white p-5 shadow-sm",
                      index === 2
                        ? "border-r-4 border-r-orange-300"
                        : "border-r-4 border-r-emerald-600",
                    ].join(" ")}
                  >
                    <div className="flex gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Icon className="h-7 w-7" />
                      </div>

                      <div>
                        <h2 className="text-lg font-black text-emerald-800">
                          {feature.title}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {feature.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
