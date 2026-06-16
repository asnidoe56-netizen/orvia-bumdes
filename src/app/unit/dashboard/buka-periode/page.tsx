import { redirect } from "next/navigation";
import { RotateCcw, ShieldAlert, ShieldCheck } from "lucide-react";

import { Card } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import { requestAccountingPeriodReopen } from "./actions";

type AccountingPeriodRow = {
  id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  status: string;
  notes: string | null;
  closed_at: string | null;
  locked_at: string | null;
};

type ReopenRequestRow = {
  id: string;
  period_id: string;
  reason: string;
  status: string;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  reopen_until: string | null;
  closed_again_at: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    requested?: string;
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

const periodStatusStyles: Record<string, string> = {
  closed: "border-amber-200 bg-amber-50 text-amber-700",
  locked: "border-slate-300 bg-slate-100 text-slate-700",
};

const requestStatusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  closed_again: "border-slate-200 bg-slate-50 text-slate-700",
};

function formatPeriod(year: number, month: number) {
  return `${monthNames[month - 1] ?? `Bulan ${month}`} ${year}`;
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

function requestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Menunggu Direktur",
    approved: "Disetujui",
    rejected: "Ditolak",
    closed_again: "Ditutup Kembali",
  };

  return labels[status] ?? status;
}

function periodStatusLabel(status: string) {
  const labels: Record<string, string> = {
    closed: "Closed",
    locked: "Locked",
  };

  return labels[status] ?? status;
}

export default async function UnitBukaPeriodePage({ searchParams }: PageProps) {
  const context = await requireRole(["manager_unit", "operator_unit"]);

  if (!context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const supabase = await createClient();

  const [periodsResult, requestsResult] = await Promise.all([
    supabase
      .from("accounting_periods")
      .select("id, period_year, period_month, period_start, period_end, status, notes, closed_at, locked_at")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .in("status", ["closed", "locked"])
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(48),
    supabase
      .from("accounting_period_reopen_requests")
      .select("id, period_id, reason, status, notes, created_at, approved_at, reopen_until, closed_again_at")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  if (periodsResult.error) {
    throw new Error(periodsResult.error.message || "Gagal memuat periode akuntansi.");
  }

  if (requestsResult.error) {
    throw new Error(requestsResult.error.message || "Gagal memuat permintaan buka periode.");
  }

  const periods = (periodsResult.data ?? []) as AccountingPeriodRow[];
  const requests = (requestsResult.data ?? []) as ReopenRequestRow[];
  const activeRequestsByPeriod = new Map(
    requests
      .filter((request) => ["pending", "approved"].includes(request.status))
      .map((request) => [request.period_id, request])
  );

  return (
    <div className="space-y-6">
      <PageBackButton fallbackHref="/unit/dashboard" label="Kembali ke Dashboard Unit" />

      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Manajemen Periode Unit
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Permintaan Buka Periode
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Ajukan pembukaan periode yang sudah closed apabila masih ada koreksi transaksi. Permintaan
              dari Manager Unit atau Operator Unit akan masuk ke Direktur BUMDes untuk disetujui.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Approval: <span className="font-bold">Direktur BUMDes</span>
          </div>
        </div>
      </div>

      {params?.requested ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          Permintaan buka periode berhasil dikirim dan menunggu persetujuan Direktur.
        </div>
      ) : null}

      {params?.error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {params.error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <RotateCcw className="h-6 w-6 text-emerald-600" />
          <h2 className="mt-3 font-bold text-slate-950">Alur Buka Periode</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Unit mengajukan alasan koreksi, lalu Direktur menyetujui sebelum periode dapat dibuka kembali.
          </p>
        </Card>

        <Card className="p-5">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
          <h2 className="mt-3 font-bold text-slate-950">Closed Bisa Diajukan</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Hanya periode berstatus closed yang dapat diajukan lewat workflow normal.
          </p>
        </Card>

        <Card className="p-5">
          <ShieldCheck className="h-6 w-6 text-slate-700" />
          <h2 className="mt-3 font-bold text-slate-950">Locked Final</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Periode locked hanya menjadi informasi dan tidak dapat dibuka melalui alur normal.
          </p>
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Periode Closed / Locked</h2>
          <p className="mt-1 text-sm text-slate-600">
            Pilih periode closed, isi alasan, lalu ajukan ke Direktur BUMDes.
          </p>
        </div>

        {periods.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Belum ada periode closed atau locked untuk unit ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Periode</th>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Permintaan Aktif</th>
                  <th className="px-5 py-3">Ajukan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {periods.map((period) => {
                  const activeRequest = activeRequestsByPeriod.get(period.id);
                  const isLocked = period.status === "locked";
                  const canRequest = period.status === "closed" && !activeRequest;

                  return (
                    <tr key={period.id} className="align-top">
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-slate-900">
                        {formatPeriod(period.period_year, period.period_month)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                        {formatDate(period.period_start)} - {formatDate(period.period_end)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${periodStatusStyles[period.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                          {periodStatusLabel(period.status)}
                        </span>
                      </td>
                      <td className="min-w-[220px] px-5 py-4 text-slate-600">
                        {activeRequest ? (
                          <div className="space-y-1">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${requestStatusStyles[activeRequest.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                              {requestStatusLabel(activeRequest.status)}
                            </span>
                            <p className="text-xs text-slate-500">
                              Dibuat: {formatDateTime(activeRequest.created_at)}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Belum ada</span>
                        )}
                      </td>
                      <td className="min-w-[320px] px-5 py-4">
                        {canRequest ? (
                          <form action={requestAccountingPeriodReopen} className="space-y-3">
                            <input type="hidden" name="period_id" value={period.id} />
                            <textarea
                              name="reason"
                              required
                              minLength={10}
                              rows={3}
                              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                              placeholder="Contoh: Ada koreksi transaksi bulan ini yang perlu diposting kembali."
                            />
                            <button
                              type="submit"
                              className="inline-flex rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
                            >
                              Ajukan ke Direktur
                            </button>
                          </form>
                        ) : (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                            {isLocked
                              ? "Periode locked tidak dapat dibuka lewat alur normal."
                              : "Permintaan aktif sudah ada untuk periode ini."}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Riwayat Permintaan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Menampilkan permintaan buka periode terbaru untuk unit ini.
          </p>
        </div>

        {requests.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Belum ada riwayat permintaan buka periode.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Waktu</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Alasan</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-600">
                      {formatDateTime(request.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${requestStatusStyles[request.status] || "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {requestStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="min-w-[260px] px-5 py-4 text-slate-700">{request.reason}</td>
                    <td className="min-w-[220px] px-5 py-4 text-slate-600">{request.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
