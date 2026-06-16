import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, LockKeyhole, RotateCcw, XCircle } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { reviewPeriodReopenRequest } from "../actions";

type BusinessUnitRecord = {
  id: string;
  kode_unit: string | null;
  nama_unit: string | null;
  jenis_unit: string | null;
  status: string | null;
};

type AccountingPeriodRecord = {
  id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  status: string;
};

type ReopenRequestRecord = {
  id: string;
  period_id: string;
  reason: string;
  status: string;
  notes: string | null;
  created_at: string;
};

type PageProps = {
  params: Promise<{ unitId: string }>;
  searchParams?: Promise<{
    year?: string;
    approved?: string;
    rejected?: string;
    closed?: string;
    error?: string;
  }>;
};

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
];

const statusStyles: Record<string, string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-700",
  closed: "border-amber-200 bg-amber-50 text-amber-700",
  reopened: "border-sky-200 bg-sky-50 text-sky-700",
  locked: "border-slate-300 bg-slate-100 text-slate-700",
  missing: "border-slate-200 bg-slate-50 text-slate-500",
};

const requestStatusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  closed_again: "border-slate-200 bg-slate-50 text-slate-700",
};

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Open",
    closed: "Closed",
    reopened: "Reopened",
    locked: "Locked",
    missing: "Belum Ada",
  };

  return labels[status] ?? status;
}

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Menunggu Direktur",
    approved: "Disetujui",
    rejected: "Ditolak",
    closed_again: "Ditutup Kembali",
  };

  return labels[status] ?? status;
}

function displayStatus(periodStatus: string | null, requestStatus?: string | null) {
  if (normalize(requestStatus) === "approved" && normalize(periodStatus) === "open") {
    return "reopened";
  }

  return normalize(periodStatus) || "missing";
}

export default async function UnitPeriodeAkuntansiDetailPage({ params, searchParams }: PageProps) {
  const context = await requireRole(["direktur_bumdes", "admin_bumdes"]);

  if (!context.tenant_id) {
    redirect("/login");
  }

  const { unitId } = await params;
  const search = searchParams ? await searchParams : {};
  const currentYear = new Date().getFullYear();
  const requestedYear = Number(search.year);

  const supabase = await createClient();

  const [unitResult, periodsResult, requestsResult] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, kode_unit, nama_unit, jenis_unit, status")
      .eq("tenant_id", context.tenant_id)
      .eq("id", unitId)
      .maybeSingle(),
    supabase
      .from("accounting_periods")
      .select("id, period_year, period_month, period_start, period_end, status")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", unitId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: true })
      .limit(240),
    supabase
      .from("accounting_period_reopen_requests")
      .select("id, period_id, reason, status, notes, created_at")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", unitId)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  if (unitResult.error || periodsResult.error || requestsResult.error) {
    throw new Error(
      unitResult.error?.message ||
        periodsResult.error?.message ||
        requestsResult.error?.message ||
        "Gagal memuat detail periode unit."
    );
  }

  if (!unitResult.data) {
    notFound();
  }

  const unit = unitResult.data as BusinessUnitRecord;
  const periods = (periodsResult.data || []) as AccountingPeriodRecord[];
  const requests = (requestsResult.data || []) as ReopenRequestRecord[];

  const availableYears = Array.from(new Set(periods.map((period) => period.period_year))).sort((a, b) => b - a);
  const selectedYear = availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears.includes(currentYear)
      ? currentYear
      : availableYears[0] || currentYear;

  const periodsForYear = periods.filter((period) => period.period_year === selectedYear);
  const periodsByMonth = new Map(periodsForYear.map((period) => [period.period_month, period]));

  const latestRequestByPeriod = new Map<string, ReopenRequestRecord>();
  const activeRequestByPeriod = new Map<string, ReopenRequestRecord>();

  requests.forEach((request) => {
    if (!latestRequestByPeriod.has(request.period_id)) {
      latestRequestByPeriod.set(request.period_id, request);
    }

    if (["pending", "approved"].includes(request.status) && !activeRequestByPeriod.has(request.period_id)) {
      activeRequestByPeriod.set(request.period_id, request);
    }
  });

  const yearLinks = availableYears.length > 0 ? availableYears : [selectedYear];

  const openCount = periodsForYear.filter((period) => {
    const request = activeRequestByPeriod.get(period.id);
    return displayStatus(period.status, request?.status) === "open";
  }).length;

  const closedCount = periodsForYear.filter((period) => period.status === "closed").length;

  const reopenedCount = periodsForYear.filter((period) => {
    const request = activeRequestByPeriod.get(period.id);
    return displayStatus(period.status, request?.status) === "reopened";
  }).length;

  const lockedCount = periodsForYear.filter((period) => period.status === "locked").length;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Link
            href="/bumdes/dashboard/periode-akuntansi"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Manajemen Periode
          </Link>

          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Detail Periode Unit
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {unit.nama_unit || "Unit tanpa nama"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
              {unit.kode_unit || "-"} · {unit.jenis_unit || "-"} · Tahun {selectedYear}
            </p>
          </div>
        </div>

        {search.approved ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
            Permintaan buka periode berhasil disetujui.
          </div>
        ) : null}

        {search.rejected ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            Permintaan buka periode berhasil ditolak.
          </div>
        ) : null}

        {search.closed ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-700">
            Periode berhasil ditutup kembali.
          </div>
        ) : null}

        {search.error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {search.error}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm text-slate-500">Open</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{openCount}</p>
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
            <p className="mt-3 text-sm text-slate-500">Locked</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{lockedCount}</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Pilih Tahun</h2>
              <p className="mt-1 text-sm text-slate-500">
                Detail hanya menampilkan Januari sampai Desember untuk satu tahun.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {yearLinks.map((year) => (
                <Link
                  key={year}
                  href={`/bumdes/dashboard/periode-akuntansi/${unit.id}?year=${year}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    year === selectedYear
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {year}
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Januari - Desember {selectedYear}</h2>
            <p className="mt-1 text-sm text-slate-500">
              Direktur dapat menyetujui, menolak, atau menutup kembali periode yang dibuka ulang.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Bulan</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Permintaan</th>
                  <th className="px-5 py-3">Aksi Direktur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {monthNames.map((monthName, index) => {
                  const month = index + 1;
                  const period = periodsByMonth.get(month);
                  const activeRequest = period ? activeRequestByPeriod.get(period.id) : null;
                  const latestRequest = period ? latestRequestByPeriod.get(period.id) : null;
                  const currentStatus = displayStatus(period?.status || null, activeRequest?.status || null);

                  return (
                    <tr key={month} className="align-top">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">{monthName}</td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {period ? `${formatDate(period.period_start)} - ${formatDate(period.period_end)}` : "-"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusStyles[currentStatus] || statusStyles.missing}`}>
                          {statusLabel(currentStatus)}
                        </span>
                      </td>
                      <td className="min-w-[260px] px-5 py-4 text-slate-600">
                        {latestRequest ? (
                          <div className="space-y-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${requestStatusStyles[latestRequest.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {requestStatusLabel(latestRequest.status)}
                            </span>
                            <p className="text-xs leading-5 text-slate-500">{latestRequest.reason}</p>
                            <p className="text-xs text-slate-400">Diajukan: {formatDateTime(latestRequest.created_at)}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada permintaan</span>
                        )}
                      </td>
                      <td className="min-w-[320px] px-5 py-4">
                        {activeRequest?.status === "pending" ? (
                          <form action={reviewPeriodReopenRequest} className="space-y-3">
                            <input type="hidden" name="unit_id" value={unit.id} />
                            <input type="hidden" name="request_id" value={activeRequest.id} />
                            <textarea
                              name="notes"
                              rows={2}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              placeholder="Catatan Direktur, opsional."
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="submit"
                                name="action_type"
                                value="approve"
                                className="inline-flex items-center gap-1 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-800"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                                Setujui
                              </button>
                              <button
                                type="submit"
                                name="action_type"
                                value="reject"
                                className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                              >
                                <XCircle className="h-4 w-4" />
                                Tolak
                              </button>
                            </div>
                          </form>
                        ) : activeRequest?.status === "approved" ? (
                          <form action={reviewPeriodReopenRequest} className="space-y-3">
                            <input type="hidden" name="unit_id" value={unit.id} />
                            <input type="hidden" name="request_id" value={activeRequest.id} />
                            <textarea
                              name="notes"
                              rows={2}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                              placeholder="Catatan penutupan kembali, opsional."
                            />
                            <button
                              type="submit"
                              name="action_type"
                              value="close_again"
                              className="inline-flex rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-900"
                            >
                              Tutup Kembali
                            </button>
                          </form>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                            Tidak ada aksi Direktur untuk bulan ini.
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

