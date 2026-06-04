import Link from "next/link"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react"

const periodRows = [
  {
    unit: "Rajawali Dagang",
    period: "Januari 2026",
    status: "closed",
    description: "Ditutup otomatis setelah masa toleransi.",
  },
  {
    unit: "Rajawali Dagang",
    period: "Februari 2026",
    status: "open",
    description: "Periode berjalan dan masih dapat menerima transaksi.",
  },
  {
    unit: "Rajawali Dagang",
    period: "Desember 2025",
    status: "locked",
    description: "Laporan sudah final dan tidak dapat dibuka lewat alur normal.",
  },
]

const statusStyles: Record<string, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-amber-200 bg-amber-50 text-amber-700",
  locked: "border-slate-300 bg-slate-100 text-slate-700",
}

export default function PeriodeAkuntansiPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Link
            href="/bumdes/dashboard"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard BUMDes
          </Link>

          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
                Manajemen Periode & Transparansi Transaksi
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Manajemen Periode Akuntansi
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Kelola status periode bulanan, penutupan otomatis, pembukaan ulang periode tertutup,
                dan penguncian periode final. Halaman ini masih berupa kerangka awal frontend sebelum
                engine database diintegrasikan.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Grace period awal: <span className="font-bold">5 hari</span>
            </div>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarClock className="h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm text-slate-500">Periode berjalan</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">Open</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-sm text-slate-500">Auto close</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">Aktif</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <RotateCcw className="h-6 w-6 text-sky-600" />
            <p className="mt-3 text-sm text-slate-500">Buka ulang</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">By Approval</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <LockKeyhole className="h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">Final</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">Locked</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Daftar Periode per Unit</h2>
            <p className="mt-1 text-sm text-slate-500">
              Data di bawah masih contoh statis untuk membentuk route dan desain awal.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">Periode</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Keterangan</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodRows.map((row) => (
                  <tr key={`${row.unit}-${row.period}`} className="bg-white">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{row.unit}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.period}</td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[row.status]}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="min-w-[260px] px-5 py-4 text-slate-600">{row.description}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-right">
                      <button className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <h3 className="mt-3 font-bold text-slate-900">Open</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Transaksi normal boleh masuk selama periode masih terbuka.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <RotateCcw className="h-6 w-6 text-sky-600" />
            <h3 className="mt-3 font-bold text-slate-900">Closed / Reopen</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Periode tertutup tidak bisa diinput langsung dan perlu pengajuan buka ulang.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="h-6 w-6 text-slate-700" />
            <h3 className="mt-3 font-bold text-slate-900">Locked</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Periode final tidak boleh dibuka lewat workflow normal.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
