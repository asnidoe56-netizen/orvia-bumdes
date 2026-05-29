export const dynamic = "force-dynamic";

import { FileSpreadsheet } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { ExportPdfButton } from "./_components/export-pdf-button";

type NeracaSummary = {
  tenant_id: string;
  unit_id: string;
  total_aset: string | number | null;
  total_kewajiban: string | number | null;
  total_ekuitas: string | number | null;
  total_kewajiban_ekuitas: string | number | null;
  selisih_neraca: string | number | null;
  status_neraca: string | null;
};

type NeracaDetail = {
  tenant_id: string;
  unit_id: string;
  account_code: string;
  account_name: string;
  neraca_group: "ASET" | "KEWAJIBAN" | "EKUITAS" | string;
  neraca_amount: string | number | null;
  is_contra_account: boolean | null;
  is_current_profit_loss: boolean | null;
};

type TenantInfo = {
  nama_bumdes: string | null;
  kode_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
};

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

function formatDateLabel() {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
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
  note,
}: {
  label: string;
  value?: string | number | null;
  bold?: boolean;
  indent?: boolean;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(170px,auto)] gap-6 border-b border-slate-100 py-3 ${
        bold ? "font-bold" : ""
      } ${muted ? "text-slate-500" : "text-slate-800"}`}
    >
      <div className={["min-w-0 break-words", indent ? "pl-6" : ""].join(" ")}>
        {label}
        {note ? (
          <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
            {note}
          </span>
        ) : null}
      </div>

      <div
        className={`whitespace-nowrap text-right tabular-nums ${amountClass(
          value
        )}`}
      >
        {value === undefined ? "" : formatRupiah(value)}
      </div>
    </div>
  );
}

function AccountRows({
  rows,
  emptyText,
}: {
  rows: NeracaDetail[];
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
          key={`${row.neraca_group}-${row.account_code}`}
          label={`${row.account_code} - ${row.account_name}`}
          value={row.neraca_amount}
          indent
          note={
            row.is_contra_account
              ? "Kontra aset"
              : row.is_current_profit_loss
                ? "Berjalan"
                : undefined
          }
        />
      ))}
    </>
  );
}

export default async function NeracaReportPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="space-y-5">
        <PageBackButton fallbackHref="/unit/dashboard/reports" />

        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-rose-950">Neraca</h1>
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

  const { data: summaryData, error: summaryError } = await supabase
    .from("v_neraca_summary")
    .select(
      "tenant_id, unit_id, total_aset, total_kewajiban, total_ekuitas, total_kewajiban_ekuitas, selisih_neraca, status_neraca"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  const summary = summaryData as NeracaSummary | null;

  const { data: detailData, error: detailError } = await supabase
    .from("v_neraca_detail")
    .select(
      "tenant_id, unit_id, account_code, account_name, neraca_group, neraca_amount, is_contra_account, is_current_profit_loss"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_code", { ascending: true });

  const detailRows = (detailData ?? []) as NeracaDetail[];

  const asetRows = detailRows.filter((row) => row.neraca_group === "ASET");
  const kewajibanRows = detailRows.filter(
    (row) => row.neraca_group === "KEWAJIBAN"
  );
  const ekuitasRows = detailRows.filter((row) => row.neraca_group === "EKUITAS");

  const reportDateLabel = `Posisi ${formatDateLabel()}`;
  const statusLabel = summary?.status_neraca ?? "BELUM ADA DATA";
  const isBalanced = statusLabel === "SEIMBANG";

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Laporan
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">Neraca</h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Laporan posisi aset, kewajiban, dan ekuitas unit berdasarkan saldo
              transaksi yang sudah diposting.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ExportPdfButton
              fileName={`neraca-${new Date().toISOString().slice(0, 10)}.pdf`}
              reportData={{
                tenant: {
                  nama_bumdes: tenant?.nama_bumdes ?? null,
                  nama_desa: tenant?.nama_desa ?? null,
                  nama_kecamatan: tenant?.nama_kecamatan ?? null,
                },
                summary,
                asetRows,
                kewajibanRows,
                ekuitasRows,
                reportDateLabel,
              }}
            />

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
          </div>
        </div>
      </section>

      {summaryError ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Data gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{summaryError.message}</p>
        </section>
      ) : null}

      {detailError ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Rincian gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{detailError.message}</p>
        </section>
      ) : null}

      {!summary ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Belum ada data Neraca
          </h2>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Belum ditemukan saldo akun aset, kewajiban, atau ekuitas untuk unit
            ini.
          </p>
        </section>
      ) : (
        <div className="min-w-0 overflow-hidden rounded-[2rem] print:overflow-visible">
          <div className="w-full overflow-x-auto pb-2 print:overflow-visible print:pb-0">
            <section className="mx-auto min-w-[760px] max-w-5xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
          <div className="rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
                Laporan Keuangan Unit
              </p>

              <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Neraca
              </h2>

              <p className="mt-3 text-xl font-bold text-slate-800">
                {tenant?.nama_bumdes ?? "BUMDes"}
              </p>

              <p className="mt-1 text-sm text-slate-500">
                {tenant?.nama_desa ? `Desa ${tenant.nama_desa}` : null}
                {tenant?.nama_desa && tenant?.nama_kecamatan ? " Â· " : null}
                {tenant?.nama_kecamatan
                  ? `Kecamatan ${tenant.nama_kecamatan}`
                  : null}
              </p>

              <div className="mx-auto mt-5 inline-flex rounded-full border border-emerald-100 bg-emerald-50 px-5 py-2 text-sm font-bold text-emerald-800">
                {reportDateLabel}
              </div>
            </div>

            <div className="mt-8 grid gap-4 rounded-3xl border border-slate-100 bg-white p-5 md:grid-cols-3">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Total Aset
                </p>
                <p className="mt-2 text-xl font-black text-emerald-700">
                  {formatRupiah(summary.total_aset)}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Kewajiban + Ekuitas
                </p>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {formatRupiah(summary.total_kewajiban_ekuitas)}
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Status
                </p>
                <p
                  className={`mt-2 text-xl font-black ${
                    isBalanced ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {statusLabel}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
            <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-950">
              <h4 className="text-lg font-bold">Rincian Neraca</h4>
              <p className="mt-1 text-sm text-emerald-700">
                Akun kosong tidak ditampilkan.
              </p>
            </div>

            <div className="p-6">
              <ReportLine label="ASET" bold muted />
              <AccountRows
                rows={asetRows}
                emptyText="Tidak ada akun aset yang memiliki saldo."
              />
              <ReportLine label="Total Aset" value={summary.total_aset} bold />

              <div className="h-5" />

              <ReportLine label="KEWAJIBAN" bold muted />
              <AccountRows
                rows={kewajibanRows}
                emptyText="Tidak ada akun kewajiban yang memiliki saldo."
              />
              <ReportLine
                label="Total Kewajiban"
                value={summary.total_kewajiban}
                bold
              />

              <div className="h-5" />

              <ReportLine label="EKUITAS" bold muted />
              <AccountRows
                rows={ekuitasRows}
                emptyText="Tidak ada akun ekuitas yang memiliki saldo."
              />
              <ReportLine
                label="Total Ekuitas"
                value={summary.total_ekuitas}
                bold
              />

              <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(190px,auto)] gap-6">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Kewajiban + Ekuitas
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Selisih Neraca: {formatRupiah(summary.selisih_neraca)}
                    </p>
                  </div>

                  <div
                    className={`whitespace-nowrap text-right text-2xl font-black tabular-nums ${
                      isBalanced ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatRupiah(summary.total_kewajiban_ekuitas)}
                  </div>
                </div>
              </div>
            </div>
          </div>

              <p className="mt-5 text-center text-xs text-slate-400">
                Laporan ini dihasilkan otomatis dari saldo akun yang sudah diposting
                pada engine akuntansi ERP BUMDes.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

