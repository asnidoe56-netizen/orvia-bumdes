export const dynamic = "force-dynamic";

import { FileSpreadsheet } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { ExportPdfButton } from "./_components/export-pdf-button";
import { setNeracaPresentationMode } from "./_actions/balance-sheet-presentation-actions";

type BalanceSheetPresentationMode = "contra_asset_detail" | "net_book_value";

type NeracaSummary = {
  tenant_id: string;
  unit_id: string;
  total_aset: string | number | null;
  total_kewajiban: string | number | null;
  total_ekuitas: string | number | null;
  total_kewajiban_ekuitas: string | number | null;
  selisih_neraca: string | number | null;
  status_neraca: string | null;
  presentation_mode: BalanceSheetPresentationMode | null;
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
  presentation_mode: BalanceSheetPresentationMode | null;
  presentation_neraca_amount: string | number | null;
  presentation_operator: "normal" | "subtract" | string | null;
  presentation_label: string | null;
  show_in_neraca_presentation: boolean | null;
};

type TenantInfo = {
  nama_bumdes: string | null;
  kode_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
};

type PageProps = {
  searchParams?: Promise<{ error?: string }> | { error?: string };
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

function getPresentationModeLabel(mode: BalanceSheetPresentationMode) {
  return mode === "net_book_value"
    ? "Mode Desa - Nilai Buku Bersih"
    : "Mode Profesional - Detail Kontra Aset";
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

function PresentationModeButton({
  mode,
  activeMode,
  children,
}: {
  mode: BalanceSheetPresentationMode;
  activeMode: BalanceSheetPresentationMode;
  children: React.ReactNode;
}) {
  const isActive = mode === activeMode;

  return (
    <form action={setNeracaPresentationMode}>
      <input type="hidden" name="presentation_mode" value={mode} />
      <button
        type="submit"
        className={`w-full rounded-xl border px-4 py-2 text-sm font-bold transition sm:w-auto ${
          isActive
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700"
        }`}
      >
        {children}
      </button>
    </form>
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
      {rows.map((row, index) => {
        const value = row.presentation_neraca_amount ?? row.neraca_amount;
        const label = row.presentation_label ?? row.account_name;

        return (
          <ReportLine
            key={`${row.neraca_group}-${row.account_code}-${index}`}
            label={`${row.account_code} - ${label}`}
            value={value}
            indent
            note={
              row.presentation_operator === "subtract"
                ? "Pengurang aset"
                : row.is_current_profit_loss
                  ? "Berjalan"
                  : undefined
            }
          />
        );
      })}
    </>
  );
}

export default async function NeracaReportPage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const pageError =
    typeof resolvedSearchParams.error === "string"
      ? resolvedSearchParams.error
      : null;

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
    .from("v_neraca_summary_presentation")
    .select(
      "tenant_id, unit_id, total_aset, total_kewajiban, total_ekuitas, total_kewajiban_ekuitas, selisih_neraca, status_neraca, presentation_mode"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  const summary = summaryData as NeracaSummary | null;

  const { data: detailData, error: detailError } = await supabase
    .from("v_neraca_detail_net_book_value")
    .select(
      "tenant_id, unit_id, account_code, account_name, neraca_group, neraca_amount, is_contra_account, is_current_profit_loss, presentation_mode, presentation_neraca_amount, presentation_operator, presentation_label, show_in_neraca_presentation"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_code", { ascending: true });

  const detailRows = ((detailData ?? []) as NeracaDetail[]).filter(
    (row) => row.show_in_neraca_presentation !== false
  );

  const asetRows = detailRows.filter((row) => row.neraca_group === "ASET");
  const kewajibanRows = detailRows.filter(
    (row) => row.neraca_group === "KEWAJIBAN"
  );
  const ekuitasRows = detailRows.filter((row) => row.neraca_group === "EKUITAS");

  const reportDateLabel = `Posisi ${formatDateLabel()}`;
  const statusLabel = summary?.status_neraca ?? "BELUM ADA DATA";
  const isBalanced = statusLabel === "SEIMBANG";
  const presentationMode =
    summary?.presentation_mode ??
    detailRows[0]?.presentation_mode ??
    "contra_asset_detail";
  const presentationModeLabel = getPresentationModeLabel(presentationMode);

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

      {pageError ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="font-bold text-amber-950">Informasi Neraca</h2>
          <p className="mt-2 text-sm text-amber-900">{pageError}</p>
        </section>
      ) : null}

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
                    {tenant?.nama_desa && tenant?.nama_kecamatan ? " · " : null}
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

                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-white p-4 print:hidden">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                          Mode Penyajian Neraca
                        </p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">
                          {presentationModeLabel}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Mode ini hanya mengubah penyajian laporan. Jurnal,
                          akun akumulasi penyusutan, dan saldo engine akuntansi
                          tidak berubah.
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row">
                        <PresentationModeButton
                          mode="contra_asset_detail"
                          activeMode={presentationMode}
                        >
                          Detail Kontra Aset
                        </PresentationModeButton>

                        <PresentationModeButton
                          mode="net_book_value"
                          activeMode={presentationMode}
                        >
                          Nilai Buku Bersih
                        </PresentationModeButton>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <ReportLine label="ASET" bold muted />
                  <AccountRows
                    rows={asetRows}
                    emptyText="Tidak ada akun aset yang memiliki saldo."
                  />
                  <ReportLine
                    label="Total Aset"
                    value={summary.total_aset}
                    bold
                  />

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
                          Selisih Neraca:{" "}
                          {formatRupiah(summary.selisih_neraca)}
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
                Laporan ini dihasilkan otomatis dari saldo akun yang sudah
                diposting pada engine akuntansi ERP BUMDes.
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
