import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowLeft, CalendarClock, CheckCircle2, Clock, LockKeyhole, RotateCcw, ShieldCheck } from "lucide-react"

import { requireRole } from "@/lib/auth/require-role"
import { createClient } from "@/lib/supabase/server"

type AccountingPeriodRecord = {
  id: string
  unit_id: string | null
  period_year: number | null
  period_month: number | null
  period_start: string | null
  period_end: string | null
  status: string | null
  notes: string | null
}

type BusinessUnitRecord = {
  id: string
  nama_unit: string | null
}

type PeriodRow = {
  id: string
  unit: string
  period: string
  status: string
  description: string
  sortUnit: string
  sortYear: number
  sortMonth: number
}

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

const statusStyles: Record<string, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-amber-200 bg-amber-50 text-amber-700",
  reopened: "border-sky-200 bg-sky-50 text-sky-700",
  locked: "border-slate-300 bg-slate-100 text-slate-700",
}

function normalizeStatus(status: string | null) {
  return (status || "open").toLowerCase()
}

function formatPeriod(year: number | null, month: number | null, periodStart: string | null, periodEnd: string | null) {
  if (year && month && month >= 1 && month <= 12) {
    return `${monthNames[month - 1]} ${year}`
  }

  const fallbackDate = periodStart || periodEnd

  if (fallbackDate) {
    const date = new Date(`${fallbackDate}T00:00:00`)

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      })
    }
  }

  return "Periode tidak diketahui"
}

function getStatusDescription(status: string, notes: string | null) {
  if (notes) return notes

  switch (status) {
    case "open":
      return "Periode berjalan dan masih dapat menerima transaksi."
    case "closed":
      return "Periode sudah ditutup dan perlu pengajuan buka ulang untuk transaksi tambahan."
    case "reopened":
      return "Periode sedang dibuka ulang berdasarkan persetujuan."
    case "locked":
      return "Laporan sudah final dan tidak dapat dibuka lewat alur normal."
    default:
      return "Status periode belum dikenali oleh tampilan."
  }
}

function buildPeriodRows(periods: AccountingPeriodRecord[], units: BusinessUnitRecord[]) {
  const unitsById = new Map(units.map((unit) => [unit.id, unit.nama_unit || "Unit tanpa nama"]))

  return periods
    .map((period): PeriodRow => {
      const status = normalizeStatus(period.status)
      const unitName = period.unit_id ? unitsById.get(period.unit_id) || "Unit tidak ditemukan" : "Tanpa unit"

      return {
        id: period.id,
        unit: unitName,
        period: formatPeriod(period.period_year, period.period_month, period.period_start, period.period_end),
        status,
        description: getStatusDescription(status, period.notes),
        sortUnit: unitName,
        sortYear: period.period_year || 0,
        sortMonth: period.period_month || 0,
      }
    })
    .sort((a, b) => {
      const unitCompare = a.sortUnit.localeCompare(b.sortUnit, "id-ID")

      if (unitCompare !== 0) return unitCompare
      if (a.sortYear !== b.sortYear) return b.sortYear - a.sortYear

      return b.sortMonth - a.sortMonth
    })
}

export default async function PeriodeAkuntansiPage() {
  const context = await requireRole(["direktur_bumdes", "admin_bumdes"])

  if (!context.tenant_id) {
    redirect("/login")
  }

  const supabase = await createClient()

  const [periodsResult, unitsResult] = await Promise.all([
    supabase
      .from("accounting_periods")
      .select("id, unit_id, period_year, period_month, period_start, period_end, status, notes")
      .eq("tenant_id", context.tenant_id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(300),
    supabase
      .from("business_units")
      .select("id, nama_unit")
      .eq("tenant_id", context.tenant_id)
      .order("nama_unit", { ascending: true }),
  ])

  const periods = (periodsResult.data || []) as AccountingPeriodRecord[]
  const units = (unitsResult.data || []) as BusinessUnitRecord[]
  const periodRows = buildPeriodRows(periods, units)

  const openCount = periodRows.filter((row) => row.status === "open").length
  const closedCount = periodRows.filter((row) => row.status === "closed").length
  const reopenedCount = periodRows.filter((row) => row.status === "reopened").length
  const lockedCount = periodRows.filter((row) => row.status === "locked").length
  const loadError = periodsResult.error || unitsResult.error

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
                dan penguncian periode final. Data ditarik langsung dari database sesuai tenant BUMDes
                yang sedang login.
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
            <p className="mt-1 text-2xl font-bold text-slate-900">{openCount} Open</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-sm text-slate-500">Closed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{closedCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <RotateCcw className="h-6 w-6 text-sky-600" />
            <p className="mt-3 text-sm text-slate-500">Reopened</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{reopenedCount}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <LockKeyhole className="h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">Final</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{lockedCount} Locked</p>
          </div>
        </section>

        {loadError ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm sm:p-6">
            Data periode belum dapat dimuat: {loadError.message}
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Daftar Periode per Unit</h2>
            <p className="mt-1 text-sm text-slate-500">
              Data di bawah mengikuti tenant BUMDes yang sedang login dan unit usaha dalam scope tenant tersebut.
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
                {periodRows.length > 0 ? (
                  periodRows.map((row) => (
                    <tr key={row.id} className="bg-white">
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">{row.unit}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.period}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[row.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
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
                  ))
                ) : (
                  <tr className="bg-white">
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      Belum ada periode akuntansi untuk tenant BUMDes ini.
                    </td>
                  </tr>
                )}
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
