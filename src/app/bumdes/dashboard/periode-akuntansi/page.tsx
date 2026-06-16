import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CalendarClock, Clock, LockKeyhole, RotateCcw } from "lucide-react";

import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";

type BusinessUnitRecord = {
  id: string;
  kode_unit: string | null;
  nama_unit: string | null;
  jenis_unit: string | null;
  status: string | null;
};

type AccountingPeriodRecord = {
  id: string;
  unit_id: string | null;
  status: string | null;
};

type ReopenRequestRecord = {
  id: string;
  period_id: string | null;
  unit_id: string | null;
  status: string | null;
};

type UnitSummary = {
  unit: BusinessUnitRecord;
  open: number;
  closed: number;
  reopened: number;
  locked: number;
  pending: number;
};

type PageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function normalize(value: string | null) {
  return (value || "").trim().toLowerCase();
}

function isActiveUnit(unit: BusinessUnitRecord) {
  const status = normalize(unit.status);

  return status === "aktif" || status === "active";
}

function createSummary(unit: BusinessUnitRecord): UnitSummary {
  return {
    unit,
    open: 0,
    closed: 0,
    reopened: 0,
    locked: 0,
    pending: 0,
  };
}

export default async function PeriodeAkuntansiPage({ searchParams }: PageProps) {
  const context = await requireRole(["direktur_bumdes", "admin_bumdes"]);

  if (!context.tenant_id) {
    redirect("/login");
  }

  const search = searchParams ? await searchParams : {};
  const supabase = await createClient();

  const [unitsResult, periodsResult, requestsResult] = await Promise.all([
    supabase
      .from("business_units")
      .select("id, kode_unit, nama_unit, jenis_unit, status")
      .eq("tenant_id", context.tenant_id)
      .order("nama_unit", { ascending: true }),
    supabase
      .from("accounting_periods")
      .select("id, unit_id, status")
      .eq("tenant_id", context.tenant_id)
      .limit(1200),
    supabase
      .from("accounting_period_reopen_requests")
      .select("id, period_id, unit_id, status")
      .eq("tenant_id", context.tenant_id)
      .in("status", ["pending", "approved"])
      .limit(1200),
  ]);

  const loadError = unitsResult.error || periodsResult.error || requestsResult.error;

  const activeUnits = ((unitsResult.data || []) as BusinessUnitRecord[]).filter(isActiveUnit);
  const periods = (periodsResult.data || []) as AccountingPeriodRecord[];
  const requests = (requestsResult.data || []) as ReopenRequestRecord[];

  const summaries = new Map<string, UnitSummary>();
  const approvedRequestPeriodIds = new Set(
    requests
      .filter((request) => normalize(request.status) === "approved" && request.period_id)
      .map((request) => request.period_id as string)
  );

  activeUnits.forEach((unit) => {
    summaries.set(unit.id, createSummary(unit));
  });

  periods.forEach((period) => {
    if (!period.unit_id) return;

    const summary = summaries.get(period.unit_id);
    if (!summary) return;

    const status = normalize(period.status) || "open";

    if (status === "closed") summary.closed += 1;
    else if (status === "locked") summary.locked += 1;
    else if (status === "reopened") summary.reopened += 1;
    else if (approvedRequestPeriodIds.has(period.id)) summary.reopened += 1;
    else summary.open += 1;
  });

  requests.forEach((request) => {
    if (!request.unit_id) return;

    const summary = summaries.get(request.unit_id);
    if (!summary) return;

    if (normalize(request.status) === "pending") {
      summary.pending += 1;
    }
  });

  const rows = Array.from(summaries.values());

  const totalOpen = rows.reduce((total, row) => total + row.open, 0);
  const totalClosed = rows.reduce((total, row) => total + row.closed, 0);
  const totalReopened = rows.reduce((total, row) => total + row.reopened, 0);
  const totalLocked = rows.reduce((total, row) => total + row.locked, 0);
  const totalPending = rows.reduce((total, row) => total + row.pending, 0);

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
                Pantau periode akuntansi per unit. Halaman awal hanya menampilkan unit aktif dan
                ringkasan status agar ringan. Detail Januari sampai Desember dibuka dari tombol Detail.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Pending approval: <span className="font-bold">{totalPending}</span>
            </div>
          </div>
        </div>

        {search.error ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm sm:p-6">
            {search.error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CalendarClock className="h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm text-slate-500">Periode berjalan</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalOpen} Open</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Clock className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-sm text-slate-500">Closed</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalClosed}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <RotateCcw className="h-6 w-6 text-sky-600" />
            <p className="mt-3 text-sm text-slate-500">Reopened</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalReopened}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <LockKeyhole className="h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">Final</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{totalLocked} Locked</p>
          </div>
        </section>

        {loadError ? (
          <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm sm:p-6">
            Data periode belum dapat dimuat: {loadError.message}
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">Unit Aktif</h2>
            <p className="mt-1 text-sm text-slate-500">
              Klik Detail untuk melihat Januari sampai Desember dan menyetujui permintaan buka periode.
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="p-5 text-sm text-slate-600">Belum ada unit aktif pada tenant BUMDes ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Unit</th>
                    <th className="px-5 py-3">Jenis</th>
                    <th className="px-5 py-3 text-center">Open</th>
                    <th className="px-5 py-3 text-center">Closed</th>
                    <th className="px-5 py-3 text-center">Reopened</th>
                    <th className="px-5 py-3 text-center">Locked</th>
                    <th className="px-5 py-3 text-center">Pending</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {rows.map((row) => (
                    <tr key={row.unit.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="font-semibold text-slate-900">{row.unit.nama_unit || "Unit tanpa nama"}</div>
                        <div className="text-xs text-slate-500">{row.unit.kode_unit || "-"}</div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-slate-700">{row.unit.jenis_unit || "-"}</td>
                      <td className="px-5 py-4 text-center font-semibold text-emerald-700">{row.open}</td>
                      <td className="px-5 py-4 text-center font-semibold text-amber-700">{row.closed}</td>
                      <td className="px-5 py-4 text-center font-semibold text-sky-700">{row.reopened}</td>
                      <td className="px-5 py-4 text-center font-semibold text-slate-700">{row.locked}</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.pending > 0 ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                          {row.pending}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-right">
                        <Link
                          href={`/bumdes/dashboard/periode-akuntansi/${row.unit.id}`}
                          className="inline-flex rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Detail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
