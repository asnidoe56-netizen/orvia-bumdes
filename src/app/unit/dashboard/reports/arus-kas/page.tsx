export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, WalletCards } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CashFlowRow = {
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;
  report_month: number | null;
  report_date: string | null;
  activity_type: string | null;
  activity_section_name: string | null;
  activity_section_order: number | null;
  activity_name: string | null;
  transaction_no: string | null;
  transaction_type: string | null;
  source_type: string | null;
  distribution_type: string | null;
  profit_sharing_allocation_code: string | null;
  profit_sharing_allocation_name: string | null;
  cash_bank_account_code: string | null;
  cash_bank_account_name: string | null;
  display_amount: number | string | null;
  cash_in_amount: number | string | null;
  cash_out_amount: number | string | null;
  internal_transfer_effect_amount: number | string | null;
  cash_effect_amount: number | string | null;
  running_cash_effect_amount: number | string | null;
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

function groupBySection(rows: CashFlowRow[]) {
  return rows.reduce<Record<string, CashFlowRow[]>>((acc, row) => {
    const key = row.activity_section_name ?? "Aktivitas Lainnya";
    acc[key] = acc[key] ?? [];
    acc[key].push(row);
    return acc;
  }, {});
}

export default async function ArusKasPage({
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
    .from("v_cash_flow_statement")
    .select(
      "kode_bumdes, nama_bumdes, nama_desa, nama_kecamatan, kode_unit, nama_unit, report_year, report_month, report_date, activity_type, activity_section_name, activity_section_order, activity_name, transaction_no, transaction_type, source_type, distribution_type, profit_sharing_allocation_code, profit_sharing_allocation_name, cash_bank_account_code, cash_bank_account_name, display_amount, cash_in_amount, cash_out_amount, internal_transfer_effect_amount, cash_effect_amount, running_cash_effect_amount, status"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("report_year", selectedYear)
    .order("activity_section_order", { ascending: true })
    .order("report_date", { ascending: true });

  const rows = (data ?? []) as CashFlowRow[];
  const groupedRows = groupBySection(rows);

  const totalCashIn = rows.reduce((sum, row) => sum + toNumber(row.cash_in_amount), 0);
  const totalCashOut = rows.reduce((sum, row) => sum + toNumber(row.cash_out_amount), 0);
  const netCashEffect = rows.reduce((sum, row) => sum + toNumber(row.cash_effect_amount), 0);
  const internalTransferNet = rows.reduce(
    (sum, row) => sum + toNumber(row.internal_transfer_effect_amount),
    0
  );

  const kasAlokasiBagiHasil = rows
    .filter((row) => row.cash_bank_account_code === "KAS-ALOKASI-BH")
    .reduce((sum, row) => sum + toNumber(row.internal_transfer_effect_amount), 0);

  const identity = rows[0];

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Arus Kas"
        title="Laporan Arus Kas"
        description="Menampilkan arus kas masuk, kas keluar, dan transfer internal berdasarkan reporting view database."
        action={
          <Link
            href="/unit/dashboard/reports/perubahan-ekuitas"
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            Lihat Perubahan Ekuitas
            <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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
          <p className="text-sm font-semibold text-slate-500">Kas Masuk</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatRupiah(totalCashIn)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Dari transaksi receipt.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Kas Keluar</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatRupiah(totalCashOut)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Dari transaksi payment.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Arus Kas Bersih</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatRupiah(netCashEffect)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Termasuk efek transfer internal bersih.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Kas Alokasi BH</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatRupiah(kasAlokasiBagiHasil)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Saldo masuk cadangan bagi hasil.
          </p>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Identitas Laporan"
          description="Scope laporan mengikuti tenant_id dan unit_id dari login context."
          action={
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <WalletCards className="h-5 w-5" />
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
          Gagal membaca laporan arus kas: {error.message}
        </div>
      ) : null}

      {!error && rows.length === 0 ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Belum ada data arus kas untuk tahun {selectedYear}.
        </div>
      ) : null}

      {Object.entries(groupedRows).map(([sectionName, sectionRows]) => {
        const sectionCashEffect = sectionRows.reduce(
          (sum, row) => sum + toNumber(row.cash_effect_amount),
          0
        );

        return (
          <Card key={sectionName}>
            <CardHeader
              title={sectionName}
              description={`Arus kas bersih: ${formatRupiah(sectionCashEffect)}`}
            />

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">No Transaksi</th>
                    <th className="px-4 py-3">Aktivitas</th>
                    <th className="px-4 py-3">Akun Kas/Bank</th>
                    <th className="px-4 py-3 text-right">Kas Masuk</th>
                    <th className="px-4 py-3 text-right">Kas Keluar</th>
                    <th className="px-4 py-3 text-right">Transfer Internal</th>
                    <th className="px-4 py-3 text-right">Efek Kas</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {sectionRows.map((row, index) => (
                    <tr key={`${row.transaction_no}-${index}`}>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(row.report_date)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {row.transaction_no ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {row.activity_name ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.profit_sharing_allocation_code
                            ? `${row.profit_sharing_allocation_code} · ${
                                row.profit_sharing_allocation_name ?? "-"
                              }`
                            : row.source_type ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-800">
                          {row.cash_bank_account_code ?? "-"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {row.cash_bank_account_name ?? "-"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700">
                        {formatRupiah(row.cash_in_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-700">
                        {formatRupiah(row.cash_out_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {formatRupiah(row.internal_transfer_effect_amount)}
                      </td>
                      <td
                        className={[
                          "px-4 py-3 text-right font-bold",
                          toNumber(row.cash_effect_amount) < 0
                            ? "text-red-700"
                            : "text-emerald-700",
                        ].join(" ")}
                      >
                        {formatRupiah(row.cash_effect_amount)}
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
          Laporan ini membaca view <span className="font-bold">v_cash_flow_statement</span>.
          PADes, dana sosial, dan insentif tampil sebagai kas keluar. Cadangan
          modal tampil sebagai transfer internal dari KAS-UTAMA ke KAS-ALOKASI-BH.
          Efek transfer internal bersih saat ini:{" "}
          <span className="font-bold">{formatRupiah(internalTransferNet)}</span>.
        </p>
      </Card>
    </div>
  );
}
