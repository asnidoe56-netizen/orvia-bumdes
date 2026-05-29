import { FileSpreadsheet } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { ExportPdfButton } from "./_components/export-pdf-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type LabaRugiSummary = {
  tenant_id: string;
  unit_id: string;
  period_id: string;
  period_year: number;
  period_month: number;
  period_start: string;
  period_end: string;
  total_pendapatan: string | number | null;
  total_hpp: string | number | null;
  laba_kotor: string | number | null;
  total_beban: string | number | null;
  laba_rugi_bersih: string | number | null;
};

type LabaRugiDetail = {
  period_year: number;
  period_month: number;
  account_code: string;
  account_name: string;
  laba_rugi_group: "PENDAPATAN" | "HPP" | "BEBAN" | string;
  debit_total: string | number | null;
  credit_total: string | number | null;
  amount: string | number | null;
};

type TenantInfo = {
  nama_bumdes: string | null;
  kode_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
};

type PageProps = {
  searchParams?:
    | Promise<{
        year?: string;
        month?: string;
      }>
    | {
        year?: string;
        month?: string;
      };
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

function toNumber(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: string | number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getPeriodLabel(summary: LabaRugiSummary | null) {
  if (!summary) return "Belum ada periode laporan";

  const monthName =
    monthNames[summary.period_month - 1] ?? `Bulan ${summary.period_month}`;

  return `${monthName} ${summary.period_year}`;
}

function amountClass(value: string | number | null | undefined) {
  const numberValue = toNumber(value);

  if (numberValue < 0) return "text-rose-700";
  if (numberValue > 0) return "text-slate-950";

  return "text-slate-500";
}

function ReportLine({
  label,
  value,
  bold = false,
  indent = false,
  muted = false,
}: {
  label: string;
  value?: string | number | null;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto] gap-4 border-b border-slate-100 py-3 ${
        bold ? "font-bold" : ""
      } ${muted ? "text-slate-500" : "text-slate-800"}`}
    >
      <div className={indent ? "pl-6" : ""}>{label}</div>
      <div className={`text-right tabular-nums ${amountClass(value)}`}>
        {value === undefined ? "" : formatRupiah(value)}
      </div>
    </div>
  );
}

function AccountRows({
  rows,
  emptyText,
}: {
  rows: LabaRugiDetail[];
  emptyText: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="border-b border-slate-100 py-3 pl-6 text-sm text-slate-400">
        {emptyText}
      </div>
    );
  }

  return (
    <>
      {rows.map((row) => (
        <ReportLine
          key={`${row.laba_rugi_group}-${row.account_code}`}
          label={`${row.account_code} - ${row.account_name}`}
          value={row.amount}
          indent
        />
      ))}
    </>
  );
}

export default async function LabaRugiReportPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedYear = Number(resolvedSearchParams?.year ?? 0);
  const selectedMonth = Number(resolvedSearchParams?.month ?? 0);

  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="space-y-5">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 14mm;
              }

              body {
                background: #ffffff !important;
              }

              aside,
              nav,
              header,
              button,
              .print-hidden,
              .print\:hidden {
                display: none !important;
              }

              main {
                margin: 0 !important;
                padding: 0 !important;
              }

              .erp-print-sheet {
                max-width: 100% !important;
                border: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
              }

              .erp-print-card {
                border: 0 !important;
                box-shadow: none !important;
                background: #ffffff !important;
              }

              .erp-print-soft-header {
                background: #ecfdf5 !important;
                color: #064e3b !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `,
        }}
      />

      <PageBackButton fallbackHref="/unit/dashboard/reports" />

        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-rose-950">Laba Rugi</h1>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Sesi unit tidak valid. Silakan login kembali sebagai pengguna unit.
          </p>
        </section>
      </div>
    );
  }

  const supabase = await createClient();

  const { data: tenantData } = await supabase
    .from("tenants")
    .select("nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan")
    .eq("id", context.tenant_id)
    .maybeSingle();

  const tenant = tenantData as TenantInfo | null;

  let summaryQuery = supabase
    .from("v_laba_rugi_summary")
    .select(
      "tenant_id, unit_id, period_id, period_year, period_month, period_start, period_end, total_pendapatan, total_hpp, laba_kotor, total_beban, laba_rugi_bersih"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id);

  if (selectedYear > 0 && selectedMonth > 0) {
    summaryQuery = summaryQuery
      .eq("period_year", selectedYear)
      .eq("period_month", selectedMonth);
  } else {
    summaryQuery = summaryQuery
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });
  }

  const { data: summaryRows, error: summaryError } = await summaryQuery.limit(1);
  const summary = (summaryRows?.[0] ?? null) as LabaRugiSummary | null;

  let detailRows: LabaRugiDetail[] = [];
  let detailErrorMessage = "";

  if (summary?.period_id) {
    const { data, error } = await supabase
      .from("v_laba_rugi_detail")
      .select(
        "period_year, period_month, account_code, account_name, laba_rugi_group, debit_total, credit_total, amount"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("period_id", summary.period_id)
      .order("account_code", { ascending: true });

    detailRows = (data ?? []) as LabaRugiDetail[];
    detailErrorMessage = error?.message ?? "";
  }

  const pendapatanRows = detailRows.filter(
    (row) => row.laba_rugi_group === "PENDAPATAN"
  );
  const hppRows = detailRows.filter((row) => row.laba_rugi_group === "HPP");
  const bebanRows = detailRows.filter((row) => row.laba_rugi_group === "BEBAN");

  const labaBersih = toNumber(summary?.laba_rugi_bersih);
  const statusLabel =
    labaBersih > 0 ? "LABA" : labaBersih < 0 ? "RUGI" : "IMPAS";

  return (
    <div className="space-y-5">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: A4;
                margin: 14mm;
              }

              body {
                background: #ffffff !important;
              }

              aside,
              nav,
              header,
              button,
              .print-hidden,
              .print\:hidden {
                display: none !important;
              }

              main {
                margin: 0 !important;
                padding: 0 !important;
              }

              .erp-print-sheet {
                max-width: 100% !important;
                border: 0 !important;
                box-shadow: none !important;
                padding: 0 !important;
              }

              .erp-print-card {
                border: 0 !important;
                box-shadow: none !important;
                background: #ffffff !important;
              }

              .erp-print-soft-header {
                background: #ecfdf5 !important;
                color: #064e3b !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          `,
        }}
      />

      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Laporan
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Laporan Laba & Rugi
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Laporan berbasis transaksi yang sudah diposting. Rincian hanya
              menampilkan akun yang memiliki transaksi pada periode laporan.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ExportPdfButton
              fileName={`laba-rugi-${summary?.period_year ?? "laporan"}-${summary?.period_month ?? "periode"}.pdf`}
              reportData={{
                tenant: {
                  nama_bumdes: tenant?.nama_bumdes ?? null,
                  nama_desa: tenant?.nama_desa ?? null,
                  nama_kecamatan: tenant?.nama_kecamatan ?? null,
                },
                summary,
                pendapatanRows,
                hppRows,
                bebanRows,
                statusLabel,
              }}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm print:hidden">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <label className="text-sm font-semibold text-slate-700">
              Tahun
            </label>
            <input
              name="year"
              type="number"
              min="2000"
              max="2100"
              defaultValue={summary?.period_year ?? new Date().getFullYear()}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">
              Bulan
            </label>
            <select
              name="month"
              defaultValue={summary?.period_month ?? new Date().getMonth() + 1}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            >
              {monthNames.map((month, index) => (
                <option key={month} value={index + 1}>
                  {month}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
          >
            Tampilkan
          </button>
        </form>
      </section>

      {summaryError ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Data gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{summaryError.message}</p>
        </section>
      ) : null}

      {!summary ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Belum ada transaksi Laba Rugi
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Belum ditemukan transaksi pendapatan, HPP, atau beban yang sudah
            diposting untuk periode ini.
          </p>
        </section>
      ) : (
        <section
          id="laba-rugi-pdf-area"
          className="erp-print-sheet mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10"
        >
          <div className="erp-print-card rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
                Laporan Keuangan Unit
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Laporan Laba & Rugi
              </h2>

              <p className="mt-3 text-xl font-bold text-slate-800">
                {tenant?.nama_bumdes ?? "BUMDes"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {tenant?.nama_desa ? `Desa ${tenant.nama_desa}` : null}
                {tenant?.nama_desa && tenant?.nama_kecamatan ? " · " : null}
                {tenant?.nama_kecamatan
                  ? `Kecamatan ${tenant.nama_kecamatan}`
                  : null}
              </p>

              <div className="mx-auto mt-5 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-5 py-2 text-sm font-bold text-emerald-800">
                Periode {getPeriodLabel(summary)}
              </div>

              <p className="mt-3 text-sm text-slate-500">
                {formatDate(summary.period_start)} sampai{" "}
                {formatDate(summary.period_end)}
              </p>
            </div>

            <div className="mt-8 grid gap-4 rounded-3xl border border-slate-100 bg-white p-5 md:grid-cols-3">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Total Pendapatan
                </p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {formatRupiah(summary.total_pendapatan)}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  HPP + Beban
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatRupiah(
                    toNumber(summary.total_hpp) + toNumber(summary.total_beban)
                  )}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p
                  className={`mt-2 text-xl font-black ${
                    labaBersih < 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  {statusLabel}
                </p>
              </div>
            </div>
          </div>

          {detailErrorMessage ? (
            <div className="mt-5 rounded-3xl border border-rose-100 bg-rose-50 p-5">
              <h2 className="font-bold text-rose-950">Rincian gagal dimuat</h2>
              <p className="mt-2 text-sm text-rose-800">
                {detailErrorMessage}
              </p>
            </div>
          ) : null}

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
            <div className="erp-print-soft-header border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-950">
              <h4 className="text-lg font-bold">Rincian Laporan</h4>
              <p className="mt-1 text-sm text-emerald-700">
                Akun kosong tidak ditampilkan.
              </p>
            </div>

            <div className="p-6">
              <ReportLine label="PENDAPATAN" bold muted />
              <AccountRows
                rows={pendapatanRows}
                emptyText="Tidak ada akun pendapatan yang memiliki transaksi."
              />
              <ReportLine
                label="Total Pendapatan"
                value={summary.total_pendapatan}
                bold
              />

              <div className="h-5" />

              <ReportLine label="HARGA POKOK PENJUALAN" bold muted />
              <AccountRows
                rows={hppRows}
                emptyText="Tidak ada akun HPP yang memiliki transaksi."
              />
              <ReportLine label="Total HPP" value={summary.total_hpp} bold />

              <ReportLine
                label="LABA KOTOR"
                value={summary.laba_kotor}
                bold
              />

              <div className="h-5" />

              <ReportLine label="BEBAN" bold muted />
              <AccountRows
                rows={bebanRows}
                emptyText="Tidak ada akun beban yang memiliki transaksi."
              />
              <ReportLine label="Total Beban" value={summary.total_beban} bold />

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid grid-cols-[1fr_auto] gap-4">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Laba/Rugi Bersih
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Pendapatan dikurangi HPP dan seluruh beban periode ini.
                    </p>
                  </div>

                  <div
                    className={`text-right text-2xl font-black tabular-nums ${
                      labaBersih < 0 ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {formatRupiah(summary.laba_rugi_bersih)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-slate-400">
            Laporan ini dihasilkan otomatis dari transaksi yang sudah diposting
            pada engine akuntansi ERP BUMDes.
          </p>
        </section>
      )}
    </div>
  );
}



