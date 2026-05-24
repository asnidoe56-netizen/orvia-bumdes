import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              ERP BUMDes
            </p>
            <h1 className="mt-1 text-xl font-bold">Core Global Governance Engine</h1>
          </div>

          <nav className="flex items-center gap-3">
            <Link
              href="/register"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
            >
              Registrasi
            </Link>
            <Link
              href="/login"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Masuk
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.2fr_0.8fr]">
          <section>
            <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-300">
              Sistem ERP multi-tenant untuk tata kelola BUMDes
            </p>

            <h2 className="mt-6 max-w-4xl text-4xl font-bold tracking-tight md:text-6xl">
              Satu platform untuk tenant, unit usaha, akuntansi, transaksi, audit, dan laporan.
            </h2>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-300">
              Dibangun dengan prinsip database sebagai sumber kebenaran. Frontend hanya menjadi
              lapisan workflow dan UI, sementara posting, approval, permission, audit, dan governance
              berjalan melalui engine database.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-emerald-400"
              >
                Masuk ke Dashboard
              </Link>
              <Link
                href="/register"
                className="rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
              >
                Daftarkan BUMDes
              </Link>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl">
            <div className="grid gap-4">
              <div className="rounded-2xl bg-slate-900/80 p-5">
                <p className="text-sm font-semibold text-emerald-300">Multi-Tenant</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Satu sistem melayani banyak BUMDes dengan scope tenant dan unit yang terpisah.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900/80 p-5">
                <p className="text-sm font-semibold text-emerald-300">Role-Based Dashboard</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Platform, BUMDes, Unit, Pengawas, Pendamping, Dinas PMD, Inspektorat, dan Bupati.
                </p>
              </div>

              <div className="rounded-2xl bg-slate-900/80 p-5">
                <p className="text-sm font-semibold text-emerald-300">Governance Engine</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Transaksi, jurnal, koreksi, closing, dan audit dikendalikan melalui database RPC.
                </p>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
