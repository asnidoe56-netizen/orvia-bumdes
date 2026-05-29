"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  Menu,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";

const publicNavItems = [
  { label: "Beranda", href: "/" },
  { label: "Aplikasi", href: "#aplikasi" },
  { label: "Manajemen", href: "#manajemen" },
  { label: "Berita", href: "#berita" },
  { label: "Tentang", href: "#tentang" },
];

const featureCards = [
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

const trustItems = [
  { value: "200+", label: "BUMDes Terdaftar" },
  { value: "1.2K+", label: "Unit Usaha Terkelola" },
  { value: "95%", label: "Proses Teregistrasi" },
  { value: "100%", label: "Audit Trail Terjaga" },
];

const philosophyItems = [
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

export default function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-200">
              <Building2 className="h-6 w-6" />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-[0.28em] text-emerald-700">
                ORVIA-BUMDES
              </p>
              <p className="truncate text-sm font-bold text-slate-900">
                Core Global Governance Engine
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href="/login"
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Signup
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            aria-label="Buka menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsMenuOpen(false)}
          />

          <aside className="absolute right-4 top-4 flex h-fit max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
                  ORVIA-BUMDES
                </p>
                <p className="mt-1 text-sm font-bold text-slate-900">
                  Menu Publik
                </p>
              </div>

              <button
                type="button"
                aria-label="Tutup menu"
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-8 space-y-2">
              {publicNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex rounded-2xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5">
              <Link
                href="/login"
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-800 shadow-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-emerald-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Signup
              </Link>
            </div>
          </aside>
        </div>
      ) : null}

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
              Satu platform untuk{" "}
              <span className="text-emerald-700">tenant</span>, unit usaha,{" "}
              <span className="text-emerald-700">akuntansi</span>, transaksi,{" "}
              <span className="text-emerald-700">audit</span>, dan{" "}
              <span className="text-emerald-700">laporan</span>.
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Dibangun dengan prinsip database-first sebagai sumber kebenaran.
              Frontend menjadi lapisan workflow dan UI, sementara posting,
              approval, permission, audit, dan governance berjalan melalui
              engine database.
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
                        index === 2 ? "border-r-4 border-r-orange-300" : "border-r-4 border-r-emerald-600",
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

      <section className="border-y border-slate-200 bg-slate-50/70 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          {philosophyItems.map((item) => {
            const Icon = item.icon;

            return (
              <div key={item.title} className="flex gap-4 rounded-3xl p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section id="aplikasi" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Aplikasi
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Satu ekosistem kerja untuk banyak peran.
            </h2>
          </div>
          <p className="text-sm leading-7 text-slate-600">
            Bagian ini nanti dapat diatur dari database Super Admin Platform:
            headline, deskripsi, daftar fitur, icon, urutan tampil, dan status
            publikasi.
          </p>
        </div>
      </section>

      <section id="manajemen" className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
            Manajemen
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Konten manajemen akan dikelola dari dashboard platform.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Ini disiapkan sebagai placeholder awal sebelum modul CMS publik
            dibuat di Super Admin Platform.
          </p>
        </div>
      </section>

      <section id="berita" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-[2rem] border border-orange-100 bg-orange-50 p-6 md:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-700">
            Berita
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            Ruang publikasi perkembangan BUMDes.
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
            Artikel, pengumuman, dan informasi publik nanti dapat dimasukkan
            melalui database dan halaman Super Admin Platform.
          </p>
        </div>
      </section>

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
              Konten tentang platform, filosofi, tata kelola, dan visi produk
              akan dikelola dari database platform agar mudah diperbarui.
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
    </main>
  );
}


