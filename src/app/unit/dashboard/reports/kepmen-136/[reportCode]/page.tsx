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