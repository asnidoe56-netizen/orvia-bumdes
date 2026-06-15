export const dynamic = "force-dynamic";

import { BookOpenText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { Card, CardHeader } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { PageHeader } from "@/components/ui/page-header";
import { ExportPdfButton } from "./_components/export-pdf-button";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type GeneralLedgerRow = {
  tenant_id: string;
  unit_id: string;
  journal_entry_id: string;
  journal_line_id: string;
  journal_no: string | null;
  journal_date: string | null;
  source_type: string | null;
  source_id: string | null;
  journal_description: string | null;
  line_no: number | null;
  account_id: string;
  account_code: string | null;
  account_name: string | null;
  account_tipe: string | null;
  account_type: string | null;
  normal_balance: string | null;
  line_description: string | null;
  debit: number | string | null;
  credit: number | string | null;
  signed_amount: number | string | null;
  running_balance: number | string | null;
  posted_at: string | null;
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

function buildAccountOptions(rows: GeneralLedgerRow[]) {
  const map = new Map<string, { id: string; label: string }>();

  rows.forEach((row) => {
    if (!row.account_id) return;

    map.set(row.account_id, {
      id: row.account_id,
      label: `${row.account_code ?? "-"} - ${row.account_name ?? "-"}`,
    });
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function getLatestBalance(rows: GeneralLedgerRow[]) {
  if (rows.length === 0) return 0;
  return toNumber(rows[rows.length - 1]?.running_balance);
}

export default async function BukuBesarPage({
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
          <h1 className="text-2xl font-bold text-rose-950">Buku Besar</h1>
          <p className="mt-2 text-sm leading-6 text-rose-800">
            Sesi unit tidak valid. Silakan login kembali sebagai pengguna unit.
          </p>
        </section>
      </div>
    );
  }

  const params = searchParams ? await searchParams : {};
  const selectedYear = getYearParam(params);
  const selectedAccountId = getParam(params, "account_id") ?? "";

  const startDate = `${selectedYear}-01-01`;
  const endDate = `${selectedYear}-12-31`;

  const supabase = await createClient();

  const baseSelect =
    "tenant_id, unit_id, journal_entry_id, journal_line_id, journal_no, journal_date, source_type, source_id, journal_description, line_no, account_id, account_code, account_name, account_tipe, account_type, normal_balance, line_description, debit, credit, signed_amount, running_balance, posted_at";

  const { data: allAccountRows } = await supabase
    .from("v_general_ledger")
    .select("account_id, account_code, account_name")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .gte("journal_date", startDate)
    .lte("journal_date", endDate)
    .order("account_code", { ascending: true })
    .limit(1000);

  let ledgerQuery = supabase
    .from("v_general_ledger")
    .select(baseSelect)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .gte("journal_date", startDate)
    .lte("journal_date", endDate)
    .order("account_code", { ascending: true })
    .order("journal_date", { ascending: true })
    .order("journal_no", { ascending: true })
    .order("line_no", { ascending: true })
    .limit(1000);

  if (selectedAccountId) {
    ledgerQuery = ledgerQuery.eq("account_id", selectedAccountId);
  }

  const { data, error } = await ledgerQuery;

  const rows = (data ?? []) as GeneralLedgerRow[];
  const accountOptions = buildAccountOptions(
    (allAccountRows ?? []) as GeneralLedgerRow[]
  );

  const totalDebit = rows.reduce((sum, row) => sum + toNumber(row.debit), 0);
  const totalCredit = rows.reduce((sum, row) => sum + toNumber(row.credit), 0);
  const latestBalance = getLatestBalance(rows);
  const selectedAccountLabel = selectedAccountId
    ? accountOptions.find((account) => account.id === selectedAccountId)?.label ??
      "Akun terpilih"
    : "Semua akun";

  const reportData = {
    year: selectedYear,
    period: {
      startDate,
      endDate,
    },
    accountLabel: selectedAccountLabel,
    rows,
    totals: {
      totalDebit,
      totalCredit,
      latestBalance,
    },
  };

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/reports" />

      <PageHeader
        breadcrumb="Admin Unit / Laporan / Buku Besar"
        title="Buku Besar"
        description="Menampilkan mutasi debit, kredit, sumber jurnal, dan saldo berjalan per akun berdasarkan view database v_general_ledger."
        action={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ExportPdfButton
              fileName={`buku-besar-${selectedYear}.pdf`}
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
          description="Scope data mengikuti tenant_id dan unit_id dari login context. Saldo berjalan dihitung oleh database."
        />

        <form className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)_auto]">
          <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">Tahun</span>
            <input
              type="number"
              name="year"
              defaultValue={selectedYear}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">Akun</span>
            <select
              name="account_id"
              defaultValue={selectedAccountId}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Semua akun</option>
              {accountOptions.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </select>
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
          <p className="mt-2 text-sm text-slate-600">
            Periode {formatDate(startDate)} - {formatDate(endDate)}.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Total Debit</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">
            {formatRupiah(totalDebit)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Akumulasi baris jurnal terfilter.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Total Kredit</p>
          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatRupiah(totalCredit)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Akumulasi baris jurnal terfilter.
          </p>
        </Card>

        <Card>
          <p className="text-sm font-semibold text-slate-500">Saldo Terakhir</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">
            {formatRupiah(latestBalance)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Saldo berjalan terakhir dari akun/filter aktif.
          </p>
        </Card>
      </section>

      {error ? (
        <section className="rounded-3xl border border-rose-100 bg-rose-50 p-5 shadow-sm">
          <h2 className="font-bold text-rose-950">Buku Besar gagal dimuat</h2>
          <p className="mt-2 text-sm text-rose-800">{error.message}</p>
        </section>
      ) : null}

      {!error && rows.length === 0 ? (
        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Belum ada data Buku Besar untuk filter yang dipilih.
        </section>
      ) : null}

      <Card>
        <CardHeader
          title="Rincian Buku Besar"
          description="Tabel ini membaca langsung dari v_general_ledger. Gunakan scroll horizontal pada layar kecil."
        />

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  Tanggal
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  No. Jurnal
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  Akun
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  Uraian
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">
                  Debit
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">
                  Kredit
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right font-bold">
                  Saldo Berjalan
                </th>
                <th className="border-b border-slate-200 px-4 py-3 font-bold">
                  Sumber
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.journal_line_id}
                  className="align-top transition hover:bg-slate-50"
                >
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    {formatDate(row.journal_date)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 font-semibold text-slate-900">
                    {row.journal_no ?? "-"}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3">
                    <div className="font-bold text-slate-950">
                      {row.account_code ?? "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.account_name ?? "-"}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                    <div>{row.line_description ?? row.journal_description ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      Normal: {row.normal_balance ?? "-"}
                    </div>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right tabular-nums text-emerald-700">
                    {formatRupiah(row.debit)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right tabular-nums text-red-700">
                    {formatRupiah(row.credit)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-right font-bold tabular-nums text-slate-950">
                    {formatRupiah(row.running_balance)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
                    {row.source_type ?? "-"}
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