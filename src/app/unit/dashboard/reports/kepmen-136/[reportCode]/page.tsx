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

          <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
            <h2 className="text-lg font-bold text-emerald-950">
              Route detail sudah aktif
            </h2>
            <p className="mt-2 text-sm leading-6 text-emerald-800">
              Ini adalah pondasi aman sebelum kita membuat tampilan rinci Neraca,
              Laba Rugi, Arus Kas, Perubahan Ekuitas, CALK, dan Validasi.
            </p>
          </section>
        </>
      )}
    </div>
  );
}