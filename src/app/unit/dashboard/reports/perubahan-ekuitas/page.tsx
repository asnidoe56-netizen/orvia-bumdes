export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LineChart } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ExportPdfButton } from "./_components/export-pdf-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type EquityRow = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;
  report_date: string | null;
  section_name: string | null;
  section_order: number | null;
  line_order: number | null;
  line_code: string | null;
  line_name: string | null;
  line_category: string | null;
  display_amount: number | string | null;
  equity_effect_amount: number | string | null;
  running_equity_amount: number | string | null;
  source_type: string | null;
  status: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getYearParam(params: Record<string, string | string[] | undefined>) {
  const rawYear = Array.isArray(params.year) ? params.year[0] : params.year;
  const year = Number(rawYear);
  return Number.isFinite(year) && year > 2000 ? year : new Date().getFullYear();
}

function groupBySection(rows: EquityRow[]) {
  return rows.reduce<Record<string, EquityRow[]>>((acc, row) => {
    const key = row.section_name ?? "Lainnya";
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
}

export default async function PerubahanEkuitasPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const context = await getLoginContext();

  if (!context || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const selectedYear = getYearParam(params);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_statement_of_changes_in_equity")
    .select(
      "kode_bumdes, nama_bumdes, nama_desa, nama_kecamatan, kode_unit, nama_unit, report_year, report_date, section_name, section_order, line_order, line_code, line_name, line_category, display_amount, equity_effect_amount, running_equity_amount, source_type, status"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("report_year", selectedYear)
    .order("section_order", { ascending: true })
    .order("line_order", { ascending: true })
    .order("report_date", { ascending: true });

  const rows = (data ?? []) as EquityRow[];
  const groupedRows = groupBySection(rows);
const externalDistribution = rows
    .filter((row) => row.line_category === "profit_distribution_external")
    .reduce((sum, row) => sum + Math.abs(toNumber(row.equity_effect_amount)), 0);

  const internalReserve = rows
    .filter((row) => row.line_category === "profit_distribution_internal_reserve")
    .reduce((sum, row) => sum + toNumber(row.display_amount), 0);

  const latestRunningEquity = rows.length
    ? toNumber(rows[rows.length - 1]?.running_equity_amount)
    : 0;

  const identity = rows[0];

  const reportData = {
    tenant: {
      nama_bumdes: identity?.nama_bumdes ?? null,
      nama_desa: identity?.nama_desa ?? null,
      nama_kecamatan: identity?.nama_kecamatan ?? null,
      nama_unit: identity?.nama_unit ?? null,
      kode_unit: identity?.kode_unit ?? null,
    },
    year: selectedYear,
    rows,
    totals: {
      latestRunningEquity,
      externalDistribution,
      internalReserve,
    },
  };

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Perubahan Ekuitas"
        title="Laporan Perubahan Ekuitas"
        description="Menampilkan perubahan modal, surplus tahun berjalan, distribusi bagi hasil, dan cadangan modal berdasarkan reporting view database."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ExportPdfButton
              fileName={`perubahan-ekuitas-${selectedYear}.pdf`}
              reportData={reportData}
            />
            <Link
              href="/unit/dashboard/reports/arus-kas"
              className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
            >
              Lihat Arus Kas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm font-semibold text-slate-500">Tahun Laporan</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {selectedYear}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Filter dari query parameter <span className="font-semibold">year</span>.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Ekuitas Akhir</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatRupiah(latestRunningEquity)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Berdasarkan running balance view.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Distribusi Keluar</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatRupiah(externalDistribution)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            PADes, sosial, dan insentif.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Cadangan Modal</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatRupiah(internalReserve)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Ditampilkan tanpa mengurangi ekuitas bersih.
          </p>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Identitas Laporan"
          description="Scope laporan mengikuti tenant_id dan unit_id dari login context."
          action={
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <LineChart className="h-5 w-5" />
            </div>
          }
        />

        <div className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-500">BUMDes</p>
            <p className="mt-1 font-bold text-slate-950">
              {identity?.nama_bumdes ?? "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-500">Unit</p>
            <p className="mt-1 font-bold text-slate-950">
              {identity?.kode_unit ?? "-"} · {identity?.nama_unit ?? "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-500">Desa</p>
            <p className="mt-1 font-bold text-slate-950">
              {identity?.nama_desa ?? "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold text-slate-500">Kecamatan</p>
            <p className="mt-1 font-bold text-slate-950">
              {identity?.nama_kecamatan ?? "-"}
            </p>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
          Gagal membaca laporan perubahan ekuitas: {error.message}
        </div>
      ) : null}

      {!error && rows.length === 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Belum ada data perubahan ekuitas untuk tahun {selectedYear}.
        </div>
      ) : null}

      {Object.entries(groupedRows).map(([sectionName, sectionRows]) => {
        const sectionTotal = sectionRows.reduce(
          (sum, row) => sum + toNumber(row.equity_effect_amount),
          0
        );

        return (
          <Card key={sectionName}>
            <CardHeader
              title={sectionName}
              description={`Total efek ekuitas: ${formatRupiah(sectionTotal)}`}
            />

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Uraian</th>
                    <th className="px-4 py-3 text-right">Nilai</th>
                    <th className="px-4 py-3 text-right">Efek Ekuitas</th>
                    <th className="px-4 py-3 text-right">Saldo Berjalan</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {sectionRows.map((row, index) => (
                    <tr key={`${row.source_type}-${row.line_code}-${index}`}>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(row.report_date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {row.line_code ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.line_name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {formatRupiah(row.display_amount)}
                      </td>
                      <td
                        className={[
                          "px-4 py-3 text-right font-bold",
                          toNumber(row.equity_effect_amount) < 0
                            ? "text-red-700"
                            : "text-emerald-700",
                        ].join(" ")}
                      >
                        {formatRupiah(row.equity_effect_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-950">
                        {formatRupiah(row.running_equity_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {row.status ?? "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}

      <Card className="border-emerald-100 bg-emerald-50">
        <p className="text-sm font-bold text-emerald-900">
          Status validasi backend
        </p>
        <p className="mt-2 text-sm leading-6 text-emerald-800">
          Laporan ini membaca view <span className="font-bold">v_statement_of_changes_in_equity</span>.
          PADes, dana sosial, dan insentif mengurangi ekuitas. Cadangan modal
          ditampilkan sebagai alokasi internal dengan efek ekuitas bersih nol.
        </p>
      </Card>
    </div>
  );
}

