export const dynamic = "force-dynamic";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type DashboardSummary = {
  tenant_id: string;
  unit_id: string | null;
  cakupan_laporan: string | null;
  total_aset: string | number | null;
  total_kewajiban: string | number | null;
  total_ekuitas: string | number | null;
  financial_statement_validation_status: string | null;
  total_calk_sections: number | null;
  calk_validation_status: string | null;
  reporting_package_status: string | null;
  is_ready_for_export: boolean | null;
  dashboard_note: string | null;
};

type PackageValidation = {
  selisih_neraca: string | number | null;
  selisih_laba_rugi_neraca: string | number | null;
  selisih_arus_kas_neraca: string | number | null;
  selisih_perubahan_ekuitas_neraca: string | number | null;
  financial_statement_validation_status: string | null;
  calk_validation_status: string | null;
  reporting_package_status: string | null;
  reporting_package_note: string | null;
};

type ReviewIssue = {
  key: string;
  title: string;
  amount: number;
  explanation: string;
  steps: string[];
};

type ReportMenuItem = {
  report_order: number;
  report_code: string;
  report_name: string;
  summary_view: string | null;
  detail_view: string | null;
  report_note: string | null;
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

function getReportHref(reportCode: string) {
  return `/unit/dashboard/reports/kepmen-136/${reportCode.toLowerCase().replaceAll("_", "-")}`;
}

function getReportIcon(reportCode: string) {
  if (reportCode === "CALK") return BookOpenText;
  if (reportCode === "VALIDASI") return ShieldCheck;
  return FileSpreadsheet;
}

function buildKepmenReviewIssues(validation: PackageValidation | null) {
  const issues: ReviewIssue[] = [];

  const addIssue = (
    key: string,
    title: string,
    value: string | number | null | undefined,
    explanation: string,
    steps: string[]
  ) => {
    const amount = Math.abs(toNumber(value));

    if (amount > 0.5) {
      issues.push({
        key,
        title,
        amount,
        explanation,
        steps,
      });
    }
  };

  addIssue(
    "neraca",
    "Neraca belum seimbang",
    validation?.selisih_neraca,
    "Total aset belum sama dengan total kewajiban ditambah ekuitas.",
    [
      "Buka Cut-off Migrasi.",
      "Periksa kembali saldo aset, kewajiban, dan ekuitas awal.",
      "Pastikan setiap akun lama sudah masuk kelompok ORVIA yang benar.",
      "Validasi ulang cut-off, lalu buka kembali Laporan Kepmen 136.",
    ]
  );

  addIssue(
    "laba-rugi",
    "Laba Rugi belum sinkron dengan Neraca",
    validation?.selisih_laba_rugi_neraca,
    "Laba/rugi berjalan belum sama dengan dampaknya pada ekuitas.",
    [
      "Buka Laporan Laba Rugi.",
      "Periksa pendapatan, HPP, dan beban usaha.",
      "Pastikan transaksi penjualan, pembelian, dan beban sudah masuk periode yang benar.",
      "Validasi ulang laporan setelah koreksi transaksi selesai.",
    ]
  );

  addIssue(
    "arus-kas",
    "Arus Kas belum sinkron dengan Neraca",
    validation?.selisih_arus_kas_neraca,
    "Saldo kas menurut Neraca belum sama dengan rekonsiliasi arus kas.",
    [
      "Buka Cut-off Migrasi.",
      "Periksa bagian Kas & Bank.",
      "Pastikan Kas Tunai memakai KAS-UTAMA, bukan Kas Alokasi Bagi Hasil.",
      "Pastikan rekening bank memakai BANK-UTAMA atau akun bank yang benar.",
      "Validasi ulang cut-off dan buka kembali Laporan Kepmen 136.",
    ]
  );

  addIssue(
    "perubahan-ekuitas",
    "Perubahan Ekuitas belum sinkron dengan Neraca",
    validation?.selisih_perubahan_ekuitas_neraca,
    "Saldo ekuitas akhir belum sesuai dengan modal awal, tambahan modal, pembagian hasil, dan laba/rugi berjalan.",
    [
      "Buka Cut-off Migrasi bagian Ekuitas.",
      "Periksa modal awal, penyertaan modal, dan alokasi bagi hasil.",
      "Pastikan Kas Alokasi Bagi Hasil hanya dipakai untuk alokasi bagi hasil, bukan kas operasional.",
      "Validasi ulang paket laporan Kepmen 136.",
    ]
  );

  return issues;
}

export default async function Kepmen136ReportDashboardPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="space-y-5">
        <PageBackButton fallbackHref="/unit/dashboard/reports" />

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

  const [summaryResult, menuResult] = await Promise.all([
    supabase
      .from("v_kepmen136_dashboard_summary")
      .select(
        "tenant_id, unit_id, cakupan_laporan, total_aset, total_kewajiban, total_ekuitas, financial_statement_validation_status, total_calk_sections, calk_validation_status, reporting_package_status, is_ready_for_export, dashboard_note"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .limit(1)
      .maybeSingle(),

    supabase
      .from("v_kepmen136_report_catalog")
      .select(
        "report_order, report_code, report_name, summary_view, detail_view, report_note"
      )
      .order("report_order", { ascending: true }),
  ]);

  const { data: summaryData, error: summaryError } = summaryResult;
  const { data: menuData, error: menuError } = menuResult;

  const summary = summaryData as DashboardSummary | null;
  const reportMenu = (menuData ?? []) as ReportMenuItem[];
  const validation = null as PackageValidation | null;
  const validationError = null as { message: string } | null;
  const statusLabel = summary?.reporting_package_status ?? "BELUM ADA DATA";
  const isValid = statusLabel === "VALID";
  const reviewIssues = buildKepmenReviewIssues(validation);

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Kepmen 136"
        title="Paket Laporan Kepmen 136"
        description="Dashboard ringkas laporan Kepmen 136. Data dibaca dari view validasi database tanpa mengubah engine transaksi, jurnal otomatis, COA, RPC, atau data historis."
        action={
          <div className="inline-flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
            <BadgeCheck className="h-5 w-5" />
            {statusLabel}
          </div>
        }
      />

      {summaryError ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Data gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{summaryError.message}</p>
        </section>
      ) : null}

      {menuError ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Menu gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{menuError.message}</p>
        </section>
      ) : null}

      {validationError ? (
        <section className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <h2 className="font-bold text-amber-950">
            Petunjuk penyelesaian belum lengkap
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-800">
            Status laporan tetap ditampilkan, tetapi rincian validasi belum bisa
            dibaca: {validationError.message}
          </p>
        </section>
      ) : null}

      {!summary ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Belum ada paket laporan Kepmen 136
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            View Kepmen 136 belum mengembalikan data untuk unit ini.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Total Aset"
              value={formatRupiah(summary.total_aset)}
              description="Total aset berdasarkan Neraca Kepmen 136."
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />

            <StatCard
              title="Total Kewajiban"
              value={formatRupiah(summary.total_kewajiban)}
              description="Total kewajiban berdasarkan Neraca Kepmen 136."
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />

            <StatCard
              title="Total Ekuitas"
              value={formatRupiah(summary.total_ekuitas)}
              description="Total ekuitas yang sudah direkonsiliasi."
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />
          </section>

          <section className="grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Validasi Laporan Utama
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {summary.financial_statement_validation_status ?? "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Neraca, Laba Rugi, Arus Kas, dan Perubahan Ekuitas.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                CALK
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {summary.total_calk_sections ?? 0} Bagian
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Status: {summary.calk_validation_status ?? "-"}
              </p>
            </div>

            <div
              className={`rounded-3xl border p-5 shadow-sm ${
                isValid
                  ? "border-emerald-100 bg-emerald-50"
                  : "border-amber-100 bg-amber-50"
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isValid ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                Kesiapan Export
              </p>
              <p
                className={`mt-2 text-2xl font-bold ${
                  isValid ? "text-emerald-950" : "text-amber-950"
                }`}
              >
                {summary.is_ready_for_export ? "Siap" : "Belum Siap"}
              </p>
              <p
                className={`mt-2 text-sm leading-6 ${
                  isValid ? "text-emerald-800" : "text-amber-800"
                }`}
              >
                {summary.dashboard_note ?? "-"}
              </p>
            </div>
          </section>

          {!isValid ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertTriangle className="h-5 w-5" />
                    <h2 className="text-lg font-bold">
                      Petunjuk Penyelesaian
                    </h2>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-amber-900">
                    Paket laporan belum siap diekspor. Periksa poin di bawah ini
                    sebelum membuka ulang laporan.
                  </p>
                </div>

                <div className="rounded-2xl border border-amber-300 bg-white px-4 py-3 text-sm font-bold text-amber-900">
                  Status: {statusLabel}
                </div>
              </div>

              {validation?.reporting_package_note ? (
                <p className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                  {validation.reporting_package_note}
                </p>
              ) : null}

              {reviewIssues.length > 0 ? (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {reviewIssues.map((issue) => (
                    <div
                      key={issue.key}
                      className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm"
                    >
                      <p className="text-sm font-bold text-slate-950">
                        {issue.title}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-rose-700">
                        Selisih: {formatRupiah(issue.amount)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {issue.explanation}
                      </p>

                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                          Langkah perbaikan
                        </p>
                        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-700">
                          {issue.steps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-sm leading-6 text-slate-700">
                  Status masih perlu review, tetapi sistem belum menemukan angka
                  selisih spesifik. Periksa Cut-off Migrasi, validasi ulang
                  paket laporan, lalu buka kembali halaman ini.
                </div>
              )}
            </section>
          ) : null}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-1">
              <h2 className="text-lg font-bold text-slate-950">
                Menu Laporan Kepmen 136
              </h2>
              <p className="text-sm leading-6 text-slate-600">
                Daftar laporan ini dibaca dari metadata database Kepmen 136.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reportMenu.map((report) => {
                const Icon = getReportIcon(report.report_code);
                const isEnabled = isValid;

                return (
                  <Link
                    key={`${report.report_code}-${report.report_order}`}
                    href={isEnabled ? getReportHref(report.report_code) : "#"}
                    className={`group rounded-3xl border p-5 shadow-sm transition ${
                      isEnabled
                        ? "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                        : "pointer-events-none border-slate-100 bg-slate-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                        <Icon className="h-6 w-6" />
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {statusLabel}
                      </span>
                    </div>

                    <h3 className="mt-5 text-lg font-bold text-slate-950">
                      {report.report_name}
                    </h3>

                    <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">
                      {report.report_note ?? "-"}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-700">
                      Buka laporan
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
