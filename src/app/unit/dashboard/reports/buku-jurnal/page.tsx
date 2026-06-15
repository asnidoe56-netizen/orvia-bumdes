export const dynamic = "force-dynamic";

import { BookOpenText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ExportPdfButton } from "./_components/export-pdf-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type JournalBookRow = {
  row_no: number | null;
  journal_entry_id: string;
  journal_line_id: string;
  journal_no: string | null;
  journal_date: string | null;
  source_type: string | null;
  journal_description: string | null;
  line_no: number | null;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  account_type: string | null;
  normal_balance: string | null;
  line_description: string | null;
  description_clean: string | null;
  reference_no: string | null;
  debit: number | string | null;
  credit: number | string | null;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function getYearParam(params: Record<string, string | string[] | undefined>) {
  const rawYear = getParam(params, "year");
  const year = Number(rawYear);

  return Number.isFinite(year) && year > 2000
    ? year
    : new Date().getFullYear();
}

export default async function BukuJurnalPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="space-y-5">
        <PageBackButton fallbackHref="/unit/dashboard/reports" />

        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-rose-950">Buku Jurnal</h1>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Sesi unit tidak valid. Silakan login kembali sebagai pengguna unit.
          </p>
        </section>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const selectedYear = getYearParam(params);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_journal_book")
    .select(
      "row_no, journal_entry_id, journal_line_id, journal_no, journal_date, source_type, journal_description, line_no, account_id, account_code, account_name, account_type, normal_balance, line_description, description_clean, reference_no, debit, credit"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("report_year", selectedYear)
    .order("row_no", { ascending: true })
    .limit(1000);

  const rows = (data ?? []) as JournalBookRow[];

  const totalDebit = rows.reduce((sum, row) => sum + toNumber(row.debit), 0);
  const totalCredit = rows.reduce((sum, row) => sum + toNumber(row.credit), 0);
  const journalCount = new Set(rows.map((row) => row.journal_entry_id)).size;

  const reportData = {
    year: selectedYear,
    rows,
    totals: {
      journalCount,
      totalDebit,
      totalCredit,
    },
  };

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Buku Jurnal"
        title="Buku Jurnal"
        description="Menampilkan catatan transaksi berdasarkan urutan kejadian jurnal. Nomor urut, tanggal, debit, dan kredit dibaca dari view database v_journal_book."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ExportPdfButton
              fileName={`buku-jurnal-${selectedYear}.pdf`}
              reportData={reportData}
            />
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <BookOpenText className="h-6 w-6" />
            </div>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="Filter Laporan"
          description="Scope data mengikuti tenant_id dan unit_id dari login context. Nomor urut dibuat oleh database per unit dan tahun."
        />

        <form className="grid gap-4 md:grid-cols-[180px_auto]">
          <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">Tahun</span>
            <input
              type="number"
              name="year"
              defaultValue={selectedYear}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 md:w-auto"
            >
              Terapkan
            </button>
          </div>
        </form>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm font-semibold text-slate-500">Tahun</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {selectedYear}
          </p>
          <p className="mt-2 text-sm text-slate-600">Periode buku jurnal aktif.</p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Jumlah Jurnal</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {journalCount}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Berdasarkan entry jurnal.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Total Debit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatRupiah(totalDebit)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Akumulasi baris debit.</p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Total Kredit</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatRupiah(totalCredit)}
          </p>
          <p className="mt-2 text-sm text-slate-600">Akumulasi baris kredit.</p>
        </Card>
      </section>

      {error ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Buku Jurnal gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{error.message}</p>
        </section>
      ) : null}

      {!error && rows.length === 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Belum ada data Buku Jurnal untuk tahun yang dipilih.
        </section>
      ) : null}

      <Card>
        <CardHeader
          title="Rincian Buku Jurnal"
          description="Tabel ini menampilkan nomor urut dari database, tanggal transaksi, nomor jurnal, akun, debit, kredit, dan sumber transaksi."
        />

        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">No</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">Tanggal</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">No. Jurnal</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">Uraian</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">Ref. Transaksi</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">Akun</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">Debit</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">Kredit</th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">Sumber</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.journal_line_id} className="align-top transition hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-4 py-3 text-right font-bold text-slate-700">
                    {row.row_no ?? "-"}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                    {formatDate(row.journal_date)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <p className="font-bold text-slate-900">{row.journal_no ?? "-"}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Baris jurnal: {row.line_no ?? "-"}
                    </p>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {row.description_clean || row.line_description || row.journal_description || "Jurnal transaksi diposting oleh engine database."}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {row.reference_no ?? "-"}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <p className="font-bold text-slate-900">
                      {row.account_code ?? "-"} - {row.account_name ?? "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.account_type ?? "-"}  -  Normal {row.normal_balance ?? "-"}
                    </p>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right font-semibold text-emerald-700">
                    {formatRupiah(row.debit)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right font-semibold text-red-700">
                    {formatRupiah(row.credit)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {row.source_type ?? "-"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}