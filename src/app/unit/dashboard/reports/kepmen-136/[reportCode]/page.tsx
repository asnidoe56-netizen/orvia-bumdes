export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, Database, FileSpreadsheet, ShieldCheck } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type PageProps = {
  params:
    | Promise<{
        reportCode: string;
      }>
    | {
        reportCode: string;
      };
};

type ReportMenuItem = {
  report_order: number;
  report_code: string;
  report_name: string;
  summary_view: string | null;
  detail_view: string | null;
  report_note: string | null;
  reporting_package_status: string | null;
  is_ready_for_export: boolean | null;
  is_enabled: boolean | null;
  menu_note: string | null;
};

type NeracaSummaryRow = {
  tenant_id: string;
  unit_id: string;
  kepmen_statement_type: string | null;
  kepmen_report_section: string | null;
  kepmen_report_line: string | null;
  display_order: number | null;
  total_amount: string | number | null;
};

type NeracaDetailRow = {
  tenant_id: string;
  unit_id: string;
  account_id: string;
  orvia_account_code: string | null;
  orvia_account_name: string | null;
  kepmen_account_code: string | null;
  kepmen_account_name: string | null;
  kepmen_report_section: string | null;
  kepmen_report_line: string | null;
  display_order: number | null;
  neraca_group: string | null;
  neraca_amount: string | number | null;
  presentation_display_amount: string | number | null;
  presentation_operator: string | null;
  presentation_label: string | null;
  is_contra_account: boolean | null;
  is_current_profit_loss: boolean | null;
};

type LabaRugiResultRow = {
  tenant_id: string;
  unit_id: string;
  period_id: string;
  period_year: number | null;
  period_month: number | null;
  period_start: string | null;
  period_end: string | null;
  total_pendapatan_usaha: string | number | null;
  total_hpp: string | number | null;
  total_beban_usaha: string | number | null;
  laba_kotor: string | number | null;
  laba_rugi_bersih: string | number | null;
};

type LabaRugiDetailRow = {
  tenant_id: string;
  unit_id: string;
  period_id: string;
  period_year: number | null;
  period_month: number | null;
  period_start: string | null;
  period_end: string | null;
  account_id: string;
  orvia_account_code: string | null;
  orvia_account_name: string | null;
  orvia_account_type: string | null;
  normal_balance: string | null;
  kepmen_account_code: string | null;
  kepmen_account_name: string | null;
  kepmen_statement_type: string | null;
  kepmen_report_section: string | null;
  kepmen_report_line: string | null;
  display_order: number | null;
  laba_rugi_group: string | null;
  debit_total: string | number | null;
  credit_total: string | number | null;
  amount: string | number | null;
};

type ArusKasResultRow = {
  tenant_id: string;
  unit_id: string;
  report_year: number | null;
  report_month: number | null;
  net_cash_operating: string | number | null;
  net_cash_investing: string | number | null;
  net_cash_financing: string | number | null;
  net_increase_decrease_cash: string | number | null;
  non_cash_internal_effect: string | number | null;
};

type ArusKasSummaryRow = {
  tenant_id: string;
  unit_id: string;
  report_year: number | null;
  report_month: number | null;
  kepmen_cash_flow_code: string | null;
  kepmen_cash_flow_section: string | null;
  kepmen_cash_flow_line: string | null;
  display_order: number | null;
  is_cash_effective: boolean | null;
  total_cash_in: string | number | null;
  total_cash_out: string | number | null;
  total_cash_effect: string | number | null;
};
function slugToReportCode(slug: string) {
  return slug.toUpperCase().replaceAll("-", "_");
}

function getReadableScope(reportCode: string) {
  if (reportCode === "NERACA") return "Laporan Posisi Keuangan";
  if (reportCode === "LABA_RUGI") return "Laporan Laba Rugi";
  if (reportCode === "ARUS_KAS") return "Laporan Arus Kas";
  if (reportCode === "PERUBAHAN_EKUITAS") return "Laporan Perubahan Ekuitas";
  if (reportCode === "CALK") return "Catatan atas Laporan Keuangan";
  if (reportCode === "VALIDASI") return "Validasi Paket Laporan";
  return "Laporan Kepmen 136";
}

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

function amountClass(value: string | number | null | undefined) {
  const numberValue = toNumber(value);

  if (numberValue < 0) return "text-rose-700";
  if (numberValue > 0) return "text-slate-950";

  return "text-slate-500";
}

function sumSection(rows: NeracaSummaryRow[], section: string) {
  return rows
    .filter((row) => row.kepmen_report_section === section)
    .reduce((total, row) => total + toNumber(row.total_amount), 0);
}

function sumLabaRugiGroup(rows: LabaRugiDetailRow[], group: string) {
  return rows
    .filter((row) => row.laba_rugi_group === group)
    .reduce((total, row) => total + toNumber(row.amount), 0);
}

function formatPeriodLabel(row: LabaRugiResultRow | LabaRugiDetailRow | null) {
  if (!row?.period_year || !row.period_month) return "Periode berjalan";

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(row.period_year, row.period_month - 1, 1));
}

function ReportLine({
  label,
  value,
  bold = false,
  muted = false,
  indent = false,
  note,
}: {
  label: string;
  value?: string | number | null;
  bold?: boolean;
  muted?: boolean;
  indent?: boolean;
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

function NeracaAccountRows({
  rows,
  emptyText,
}: {
  rows: NeracaDetailRow[];
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
      {rows.map((row) => {
        const label = [
          row.kepmen_account_code,
          row.kepmen_account_name ?? row.presentation_label,
        ]
          .filter(Boolean)
          .join(" - ");

        const orviaLabel = [
          row.orvia_account_code,
          row.orvia_account_name,
        ]
          .filter(Boolean)
          .join(" - ");

        return (
          <ReportLine
            key={`${row.account_id}-${row.display_order}`}
            label={label || "Akun Kepmen 136"}
            value={row.presentation_display_amount}
            indent
            note={
              row.presentation_operator === "subtract"
                ? "Pengurang"
                : row.is_current_profit_loss
                  ? "Berjalan"
                  : orviaLabel
            }
          />
        );
      })}
    </>
  );
}

function NeracaSection({
  title,
  rows,
  total,
  emptyText,
}: {
  title: string;
  rows: NeracaDetailRow[];
  total: number;
  emptyText: string;
}) {
  return (
    <>
      <ReportLine label={title} bold muted />
      <NeracaAccountRows rows={rows} emptyText={emptyText} />
      <ReportLine label={`Total ${title}`} value={total} bold />
    </>
  );
}

function NeracaKepmen136Content({
  summaryRows,
  detailRows,
  summaryErrorMessage,
  detailErrorMessage,
}: {
  summaryRows: NeracaSummaryRow[];
  detailRows: NeracaDetailRow[];
  summaryErrorMessage: string;
  detailErrorMessage: string;
}) {
  const asetTotal = sumSection(summaryRows, "ASET");
  const kewajibanTotal = sumSection(summaryRows, "KEWAJIBAN");
  const ekuitasTotal = sumSection(summaryRows, "EKUITAS");
  const kewajibanEkuitasTotal = kewajibanTotal + ekuitasTotal;
  const selisihNeraca = asetTotal - kewajibanEkuitasTotal;
  const isBalanced = Math.abs(selisihNeraca) < 0.01;

  const asetRows = detailRows.filter(
    (row) => row.kepmen_report_section === "ASET"
  );
  const kewajibanRows = detailRows.filter(
    (row) => row.kepmen_report_section === "KEWAJIBAN"
  );
  const ekuitasRows = detailRows.filter(
    (row) => row.kepmen_report_section === "EKUITAS"
  );

  if (summaryErrorMessage || detailErrorMessage) {
    return (
      <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-950">Neraca gagal dimuat</h2>
        {summaryErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Summary: {summaryErrorMessage}
          </p>
        ) : null}
        {detailErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Detail: {detailErrorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  if (summaryRows.length === 0 && detailRows.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          Belum ada data Neraca Kepmen 136
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View Neraca Kepmen 136 belum mengembalikan data untuk unit ini.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Aset"
          value={formatRupiah(asetTotal)}
          description="Total aset berdasarkan mapping Kepmen 136."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Total Kewajiban"
          value={formatRupiah(kewajibanTotal)}
          description="Total kewajiban berdasarkan mapping Kepmen 136."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Total Ekuitas"
          value={formatRupiah(ekuitasTotal)}
          description="Total ekuitas berdasarkan rekonsiliasi laporan."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Status Neraca"
          value={isBalanced ? "SEIMBANG" : "SELISIH"}
          description={`Selisih: ${formatRupiah(selisihNeraca)}`}
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </section>

      <div className="min-w-0 overflow-hidden rounded-[2rem]">
        <div className="w-full overflow-x-auto pb-2">
          <section className="mx-auto min-w-[760px] rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
            <div className="rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
                  Kepmen 136 Tahun 2022
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Neraca / Laporan Posisi Keuangan
                </h2>

                <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Laporan ini dibaca dari view presentasi Kepmen 136 tanpa
                  mengubah engine transaksi, jurnal otomatis, COA, RPC, atau
                  data historis.
                </p>

                <div
                  className={`mx-auto mt-5 inline-flex rounded-full border px-5 py-2 text-sm font-bold ${
                    isBalanced
                      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                      : "border-rose-100 bg-rose-50 text-rose-800"
                  }`}
                >
                  {isBalanced ? "Neraca Seimbang" : "Neraca Belum Seimbang"}
                </div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
              <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-950">
                <h4 className="text-lg font-bold">Rincian Neraca Kepmen 136</h4>
                <p className="mt-1 text-sm text-emerald-700">
                  Akun ditampilkan berdasarkan mapping akun ORVIA ke struktur
                  laporan Kepmen 136.
                </p>
              </div>

              <div className="p-6">
                <NeracaSection
                  title="ASET"
                  rows={asetRows}
                  total={asetTotal}
                  emptyText="Tidak ada akun aset yang memiliki saldo."
                />

                <div className="h-5" />

                <NeracaSection
                  title="KEWAJIBAN"
                  rows={kewajibanRows}
                  total={kewajibanTotal}
                  emptyText="Tidak ada akun kewajiban yang memiliki saldo."
                />

                <div className="h-5" />

                <NeracaSection
                  title="EKUITAS"
                  rows={ekuitasRows}
                  total={ekuitasTotal}
                  emptyText="Tidak ada akun ekuitas yang memiliki saldo."
                />

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(190px,auto)] gap-6">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        Kewajiban + Ekuitas
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Selisih Neraca: {formatRupiah(selisihNeraca)}
                      </p>
                    </div>

                    <div
                      className={`whitespace-nowrap text-right text-2xl font-black tabular-nums ${
                        isBalanced ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatRupiah(kewajibanEkuitasTotal)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Disusun dari view v_kepmen136_neraca_summary dan
              v_kepmen136_neraca_detail.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function LabaRugiAccountRows({
  rows,
  emptyText,
}: {
  rows: LabaRugiDetailRow[];
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
      {rows.map((row) => {
        const label = [
          row.kepmen_account_code,
          row.kepmen_account_name,
        ]
          .filter(Boolean)
          .join(" - ");

        const orviaLabel = [
          row.orvia_account_code,
          row.orvia_account_name,
        ]
          .filter(Boolean)
          .join(" - ");

        return (
          <ReportLine
            key={`${row.account_id}-${row.display_order}`}
            label={label || "Akun Kepmen 136"}
            value={row.amount}
            indent
            note={orviaLabel}
          />
        );
      })}
    </>
  );
}

function LabaRugiSection({
  title,
  rows,
  total,
  emptyText,
}: {
  title: string;
  rows: LabaRugiDetailRow[];
  total: number;
  emptyText: string;
}) {
  return (
    <>
      <ReportLine label={title} bold muted />
      <LabaRugiAccountRows rows={rows} emptyText={emptyText} />
      <ReportLine label={`Total ${title}`} value={total} bold />
    </>
  );
}

function LabaRugiKepmen136Content({
  result,
  detailRows,
  resultErrorMessage,
  detailErrorMessage,
}: {
  result: LabaRugiResultRow | null;
  detailRows: LabaRugiDetailRow[];
  resultErrorMessage: string;
  detailErrorMessage: string;
}) {
  const pendapatanRows = detailRows.filter(
    (row) => row.laba_rugi_group === "PENDAPATAN"
  );
  const hppRows = detailRows.filter((row) => row.laba_rugi_group === "HPP");
  const bebanRows = detailRows.filter((row) => row.laba_rugi_group === "BEBAN");

  const totalPendapatan =
    result?.total_pendapatan_usaha ?? sumLabaRugiGroup(detailRows, "PENDAPATAN");
  const totalHpp = result?.total_hpp ?? sumLabaRugiGroup(detailRows, "HPP");
  const labaKotor = result?.laba_kotor ?? toNumber(totalPendapatan) - toNumber(totalHpp);
  const totalBeban =
    result?.total_beban_usaha ?? sumLabaRugiGroup(detailRows, "BEBAN");
  const labaBersih =
    result?.laba_rugi_bersih ?? toNumber(labaKotor) - toNumber(totalBeban);
  const isProfit = toNumber(labaBersih) >= 0;
  const periodLabel = formatPeriodLabel(result ?? detailRows[0] ?? null);

  if (resultErrorMessage || detailErrorMessage) {
    return (
      <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-950">Laba rugi gagal dimuat</h2>
        {resultErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Result: {resultErrorMessage}
          </p>
        ) : null}
        {detailErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Detail: {detailErrorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  if (!result && detailRows.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          Belum ada data Laba Rugi Kepmen 136
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View Laba Rugi Kepmen 136 belum mengembalikan data untuk unit ini.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Pendapatan Usaha"
          value={formatRupiah(totalPendapatan)}
          description={`Periode ${periodLabel}.`}
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Harga Pokok"
          value={formatRupiah(totalHpp)}
          description="Total HPP berdasarkan mapping Kepmen 136."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Beban Usaha"
          value={formatRupiah(totalBeban)}
          description="Total beban usaha dari detail akun."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Laba Bersih"
          value={formatRupiah(labaBersih)}
          description={isProfit ? "Unit membukukan laba." : "Unit membukukan rugi."}
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </section>

      <div className="min-w-0 overflow-hidden rounded-[2rem]">
        <div className="w-full overflow-x-auto pb-2">
          <section className="mx-auto min-w-[760px] rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
            <div className="rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
                  Kepmen 136 Tahun 2022
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Laporan Laba Rugi
                </h2>

                <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Detail akun dibaca langsung dari view
                  v_kepmen136_laba_rugi_detail dan diringkas dengan view result
                  Kepmen 136.
                </p>

                <div
                  className={`mx-auto mt-5 inline-flex rounded-full border px-5 py-2 text-sm font-bold ${
                    isProfit
                      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
                      : "border-rose-100 bg-rose-50 text-rose-800"
                  }`}
                >
                  {periodLabel} - {isProfit ? "Laba" : "Rugi"}{" "}
                  {formatRupiah(labaBersih)}
                </div>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
              <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-950">
                <h4 className="text-lg font-bold">
                  Rincian Laba Rugi Kepmen 136
                </h4>
                <p className="mt-1 text-sm text-emerald-700">
                  Akun ditampilkan berdasarkan mapping akun ORVIA ke struktur
                  laporan laba rugi Kepmen 136.
                </p>
              </div>

              <div className="p-6">
                <LabaRugiSection
                  title="PENDAPATAN USAHA"
                  rows={pendapatanRows}
                  total={toNumber(totalPendapatan)}
                  emptyText="Tidak ada akun pendapatan yang memiliki saldo."
                />

                <div className="h-5" />

                <LabaRugiSection
                  title="HARGA POKOK PENJUALAN"
                  rows={hppRows}
                  total={toNumber(totalHpp)}
                  emptyText="Tidak ada akun HPP yang memiliki saldo."
                />

                <ReportLine label="Laba Kotor" value={labaKotor} bold />

                <div className="h-5" />

                <LabaRugiSection
                  title="BEBAN USAHA"
                  rows={bebanRows}
                  total={toNumber(totalBeban)}
                  emptyText="Tidak ada akun beban yang memiliki saldo."
                />

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(190px,auto)] gap-6">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        Laba/Rugi Bersih
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Pendapatan - HPP - Beban Usaha
                      </p>
                    </div>

                    <div
                      className={`whitespace-nowrap text-right text-2xl font-black tabular-nums ${
                        isProfit ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatRupiah(labaBersih)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Disusun dari view v_kepmen136_laba_rugi_result dan
              v_kepmen136_laba_rugi_detail.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

function ArusKasAccountRows({
  rows,
  emptyText,
}: {
  rows: ArusKasSummaryRow[];
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
      {rows.map((row) => {
        const label = [
          row.kepmen_cash_flow_code,
          row.kepmen_cash_flow_line,
        ]
          .filter(Boolean)
          .join(" - ");

        const note = [
          toNumber(row.total_cash_in) > 0
            ? `Masuk ${formatRupiah(row.total_cash_in)}`
            : null,
          toNumber(row.total_cash_out) > 0
            ? `Keluar ${formatRupiah(row.total_cash_out)}`
            : null,
          row.is_cash_effective === false ? "Non-kas/Internal" : null,
        ]
          .filter(Boolean)
          .join(" Ãƒâ€šÃ‚Â· ");

        return (
          <ReportLine
            key={`${row.kepmen_cash_flow_section}-${row.kepmen_cash_flow_code}-${row.display_order}`}
            label={label || "Pos Arus Kas Kepmen 136"}
            value={row.total_cash_effect}
            indent
            note={note}
          />
        );
      })}
    </>
  );
}

function ArusKasSection({
  title,
  rows,
  total,
  emptyText,
}: {
  title: string;
  rows: ArusKasSummaryRow[];
  total: number;
  emptyText: string;
}) {
  return (
    <>
      <ReportLine label={title} bold muted />
      <ArusKasAccountRows rows={rows} emptyText={emptyText} />
      <ReportLine label={`Arus Kas Bersih ${title}`} value={total} bold />
    </>
  );
}

function ArusKasKepmen136Content({
  result,
  summaryRows,
  resultErrorMessage,
  summaryErrorMessage,
}: {
  result: ArusKasResultRow | null;
  summaryRows: ArusKasSummaryRow[];
  resultErrorMessage: string;
  summaryErrorMessage: string;
}) {
  const hasSection = (row: ArusKasSummaryRow, keyword: string) =>
    (row.kepmen_cash_flow_section ?? "").toUpperCase().includes(keyword);

  const sumRows = (rows: ArusKasSummaryRow[]) =>
    rows.reduce((total, row) => total + toNumber(row.total_cash_effect), 0);

  const operasiRows = summaryRows.filter((row) => hasSection(row, "OPERASI"));
  const investasiRows = summaryRows.filter((row) =>
    hasSection(row, "INVESTASI")
  );
  const pendanaanRows = summaryRows.filter((row) =>
    hasSection(row, "PENDANAAN")
  );
  const internalRows = summaryRows.filter(
    (row) =>
      !hasSection(row, "OPERASI") &&
      !hasSection(row, "INVESTASI") &&
      !hasSection(row, "PENDANAAN")
  );

  const operatingTotal =
    result?.net_cash_operating === undefined ||
    result?.net_cash_operating === null
      ? sumRows(operasiRows)
      : toNumber(result.net_cash_operating);
  const investingTotal =
    result?.net_cash_investing === undefined ||
    result?.net_cash_investing === null
      ? sumRows(investasiRows)
      : toNumber(result.net_cash_investing);
  const financingTotal =
    result?.net_cash_financing === undefined ||
    result?.net_cash_financing === null
      ? sumRows(pendanaanRows)
      : toNumber(result.net_cash_financing);
  const netCashChange =
    result?.net_increase_decrease_cash === undefined ||
    result?.net_increase_decrease_cash === null
      ? operatingTotal + investingTotal + financingTotal
      : toNumber(result.net_increase_decrease_cash);
  const internalEffect = toNumber(result?.non_cash_internal_effect);

  const periodLabel =
    result?.report_year && result?.report_month
      ? `${String(result.report_month).padStart(2, "0")}/${result.report_year}`
      : "-";

  if (resultErrorMessage || summaryErrorMessage) {
    return (
      <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
        <h2 className="font-bold text-rose-950">Arus Kas gagal dimuat</h2>
        {resultErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Result: {resultErrorMessage}
          </p>
        ) : null}
        {summaryErrorMessage ? (
          <p className="mt-2 text-sm text-rose-800">
            Summary: {summaryErrorMessage}
          </p>
        ) : null}
      </section>
    );
  }

  if (!result && summaryRows.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          Belum ada data Arus Kas Kepmen 136
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          View Arus Kas Kepmen 136 belum mengembalikan data untuk unit ini.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Periode"
          value={periodLabel}
          description="Periode laporan Arus Kas terbaru."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Arus Kas Operasi"
          value={formatRupiah(operatingTotal)}
          description="Kas bersih dari aktivitas operasi."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Arus Kas Investasi"
          value={formatRupiah(investingTotal)}
          description="Kas bersih dari aktivitas investasi."
          icon={<FileSpreadsheet className="h-6 w-6" />}
        />

        <StatCard
          title="Kenaikan/Penurunan Kas"
          value={formatRupiah(netCashChange)}
          description="Perubahan kas bersih periode berjalan."
          icon={<ShieldCheck className="h-6 w-6" />}
        />
      </section>

      <div className="min-w-0 overflow-hidden rounded-[2rem]">
        <div className="w-full overflow-x-auto pb-2">
          <section className="mx-auto min-w-[760px] rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
            <div className="rounded-[2rem] border border-slate-100 bg-gradient-to-br from-slate-50 to-white p-6 md:p-8">
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
                  Kepmen 136 Tahun 2022
                </p>

                <h2 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                  Laporan Arus Kas
                </h2>

                <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  Pos arus kas ditampilkan memakai COA Kepmen dari kolom
                  kepmen_cash_flow_code, sedangkan kode internal mapping tetap
                  disimpan di database.
                </p>
              </div>
            </div>

            <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
              <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-4 text-emerald-950">
                <h4 className="text-lg font-bold">
                  Rincian Arus Kas Kepmen 136
                </h4>
                <p className="mt-1 text-sm text-emerald-700">
                  Kode yang tampil adalah nomor COA Kepmen, bukan kode internal
                  K136-AK.
                </p>
              </div>

              <div className="p-6">
                <ArusKasSection
                  title="AKTIVITAS OPERASI"
                  rows={operasiRows}
                  total={operatingTotal}
                  emptyText="Tidak ada arus kas operasi pada periode ini."
                />

                <div className="h-5" />

                <ArusKasSection
                  title="AKTIVITAS INVESTASI"
                  rows={investasiRows}
                  total={investingTotal}
                  emptyText="Tidak ada arus kas investasi pada periode ini."
                />

                <div className="h-5" />

                <ArusKasSection
                  title="AKTIVITAS PENDANAAN"
                  rows={pendanaanRows}
                  total={financingTotal}
                  emptyText="Tidak ada arus kas pendanaan pada periode ini."
                />

                {internalRows.length > 0 ? (
                  <>
                    <div className="h-5" />
                    <ArusKasSection
                      title="NON-KAS / INTERNAL"
                      rows={internalRows}
                      total={sumRows(internalRows)}
                      emptyText="Tidak ada pos non-kas/internal."
                    />
                  </>
                ) : null}

                <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(190px,auto)] gap-6">
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        Kenaikan / Penurunan Bersih Kas
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Dampak non-kas/internal: {formatRupiah(internalEffect)}
                      </p>
                    </div>

                    <div
                      className={`whitespace-nowrap text-right text-2xl font-black tabular-nums ${amountClass(
                        netCashChange
                      )}`}
                    >
                      {formatRupiah(netCashChange)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              Disusun dari view v_kepmen136_cash_flow_result dan
              v_kepmen136_cash_flow_summary.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

export default async function Kepmen136ReportDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const reportCode = slugToReportCode(resolvedParams.reportCode);

  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="space-y-5">
        <PageBackButton fallbackHref="/unit/dashboard/reports/kepmen-136" />

        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-rose-950">
            Laporan Kepmen 136
          </h1>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Sesi unit tidak valid. Silakan login kembali sebagai pengguna unit.
          </p>
        </section>
      </div>
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_kepmen136_report_menu")
    .select(
      "report_order, report_code, report_name, summary_view, detail_view, report_note, reporting_package_status, is_ready_for_export, is_enabled, menu_note"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("report_code", reportCode)
    .maybeSingle();

  const report = data as ReportMenuItem | null;

  let neracaSummaryRows: NeracaSummaryRow[] = [];
  let neracaDetailRows: NeracaDetailRow[] = [];
  let neracaSummaryErrorMessage = "";
  let neracaDetailErrorMessage = "";
  let labaRugiResult: LabaRugiResultRow | null = null;
  let labaRugiDetailRows: LabaRugiDetailRow[] = [];
  let labaRugiResultErrorMessage = "";
  let labaRugiDetailErrorMessage = "";
  let arusKasResult: ArusKasResultRow | null = null;
  let arusKasSummaryRows: ArusKasSummaryRow[] = [];
  const arusKasResultErrorMessage = "";
  let arusKasSummaryErrorMessage = "";

  if (reportCode === "NERACA") {
    const { data: summaryData, error: summaryError } = await supabase
      .from("v_kepmen136_neraca_summary")
      .select(
        "tenant_id, unit_id, kepmen_statement_type, kepmen_report_section, kepmen_report_line, display_order, total_amount"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("display_order", { ascending: true });

    neracaSummaryRows = (summaryData ?? []) as NeracaSummaryRow[];
    neracaSummaryErrorMessage = summaryError?.message ?? "";

    const { data: detailData, error: detailError } = await supabase
      .from("v_kepmen136_neraca_detail")
      .select(
        "tenant_id, unit_id, account_id, orvia_account_code, orvia_account_name, kepmen_account_code, kepmen_account_name, kepmen_report_section, kepmen_report_line, display_order, neraca_group, neraca_amount, presentation_display_amount, presentation_operator, presentation_label, is_contra_account, is_current_profit_loss"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("display_order", { ascending: true })
      .order("orvia_account_code", { ascending: true });

    neracaDetailRows = (detailData ?? []) as NeracaDetailRow[];
    neracaDetailErrorMessage = detailError?.message ?? "";
  }

  if (reportCode === "LABA_RUGI") {
    const { data: resultData, error: resultError } = await supabase
      .from("v_kepmen136_laba_rugi_result")
      .select(
        "tenant_id, unit_id, period_id, period_year, period_month, period_start, period_end, total_pendapatan_usaha, total_hpp, total_beban_usaha, laba_kotor, laba_rugi_bersih"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .limit(1)
      .maybeSingle();

    labaRugiResult = resultData as LabaRugiResultRow | null;
    labaRugiResultErrorMessage = resultError?.message ?? "";

    let detailQuery = supabase
      .from("v_kepmen136_laba_rugi_detail")
      .select(
        "tenant_id, unit_id, period_id, period_year, period_month, period_start, period_end, account_id, orvia_account_code, orvia_account_name, orvia_account_type, normal_balance, kepmen_account_code, kepmen_account_name, kepmen_statement_type, kepmen_report_section, kepmen_report_line, display_order, laba_rugi_group, debit_total, credit_total, amount"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id);

    if (labaRugiResult?.period_year && labaRugiResult.period_month) {
      detailQuery = detailQuery
        .eq("period_year", labaRugiResult.period_year)
        .eq("period_month", labaRugiResult.period_month);
    }

    const { data: detailData, error: detailError } = await detailQuery
      .order("display_order", { ascending: true })
      .order("orvia_account_code", { ascending: true });

    labaRugiDetailRows = (detailData ?? []) as LabaRugiDetailRow[];
    labaRugiDetailErrorMessage = detailError?.message ?? "";
  }

  if (reportCode === "ARUS_KAS") {
    const { data: summaryData, error: summaryError } = await supabase
      .from("v_kepmen136_cash_flow_summary")
      .select(
        "tenant_id, unit_id, report_year, report_month, kepmen_cash_flow_code, kepmen_cash_flow_section, kepmen_cash_flow_line, display_order, is_cash_effective, total_cash_in, total_cash_out, total_cash_effect"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("report_year", { ascending: false })
      .order("report_month", { ascending: false })
      .order("display_order", { ascending: true });

    arusKasSummaryRows = (summaryData ?? []) as ArusKasSummaryRow[];
    arusKasSummaryErrorMessage = summaryError?.message ?? "";

    const latestRow = arusKasSummaryRows[0];

    arusKasResult = latestRow
      ? {
          tenant_id: latestRow.tenant_id,
          unit_id: latestRow.unit_id,
          report_year: latestRow.report_year,
          report_month: latestRow.report_month,
          net_cash_operating: null,
          net_cash_investing: null,
          net_cash_financing: null,
          net_increase_decrease_cash: null,
          non_cash_internal_effect: null,
        }
      : null;
  }

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports/kepmen-136" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Kepmen 136"
        title={report?.report_name ?? getReadableScope(reportCode)}
        description={
          report?.report_note ??
          "Halaman detail laporan Kepmen 136. Tahap ini memastikan route detail tersedia sebelum tabel laporan lengkap ditampilkan."
        }
        action={
          <Link
            href="/unit/dashboard/reports/kepmen-136"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke paket
          </Link>
        }
      />

      {error ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Data laporan gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{error.message}</p>
        </section>
      ) : null}

      {!report ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Laporan tidak ditemukan
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Metadata laporan dengan kode {reportCode} belum ditemukan untuk unit
            ini.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Kode Laporan"
              value={report.report_code}
              description="Kode metadata laporan dari database Kepmen 136."
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />

            <StatCard
              title="Status Paket"
              value={report.reporting_package_status ?? "-"}
              description="Status validasi paket laporan Kepmen 136."
              icon={<ShieldCheck className="h-6 w-6" />}
            />

            <StatCard
              title="Kesiapan Export"
              value={report.is_ready_for_export ? "Siap" : "Belum Siap"}
              description={report.menu_note ?? "Status kesiapan tampilan/export."}
              icon={<Database className="h-6 w-6" />}
            />
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Sumber View Database
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Halaman detail ini sudah terhubung ke metadata Kepmen 136. Tabel
              laporan lengkap akan kita buka satu per satu dari view summary dan
              detail berikut.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">
                  Summary View
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-950">
                  {report.summary_view ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-bold text-slate-500">
                  Detail View
                </p>
                <p className="mt-2 break-words text-sm font-semibold text-slate-950">
                  {report.detail_view ?? "-"}
                </p>
              </div>
            </div>
          </section>

          {reportCode === "NERACA" ? (
            <NeracaKepmen136Content
              summaryRows={neracaSummaryRows}
              detailRows={neracaDetailRows}
              summaryErrorMessage={neracaSummaryErrorMessage}
              detailErrorMessage={neracaDetailErrorMessage}
            />
          ) : reportCode === "LABA_RUGI" ? (
            <LabaRugiKepmen136Content
              result={labaRugiResult}
              detailRows={labaRugiDetailRows}
              resultErrorMessage={labaRugiResultErrorMessage}
              detailErrorMessage={labaRugiDetailErrorMessage}
            />
          ) : reportCode === "ARUS_KAS" ? (
            <ArusKasKepmen136Content
              result={arusKasResult}
              summaryRows={arusKasSummaryRows}
              resultErrorMessage={arusKasResultErrorMessage}
              summaryErrorMessage={arusKasSummaryErrorMessage}
            />
          ) : (
            <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-emerald-950">
                Route detail sudah aktif
              </h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Ini adalah pondasi aman sebelum kita membuat tampilan rinci Neraca,
                Laba Rugi, Arus Kas, Perubahan Ekuitas, CALK, dan Validasi.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

