import {
  Activity,
  BarChart3,
  Download,
  Landmark,
  PiggyBank,
  Scale,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type LabaRugiRow = {
  tenant_id: string;
  unit_id: string | null;
  period_year: number | null;
  period_month: number | null;
  total_pendapatan: number | string | null;
  total_hpp: number | string | null;
  laba_kotor: number | string | null;
  total_beban: number | string | null;
  laba_rugi_bersih: number | string | null;
};

type NeracaRow = {
  tenant_id: string;
  unit_id: string | null;
  total_aset: number | string | null;
  total_kewajiban: number | string | null;
  total_ekuitas: number | string | null;
  total_kewajiban_ekuitas: number | string | null;
  selisih_neraca: number | string | null;
  status_neraca: string | null;
};

type CashFlowRow = {
  tenant_id: string;
  unit_id: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  report_year: number | null;
  report_month: number | null;
  activity_section_name: string | null;
  activity_name: string | null;
  transaction_no: string | null;
  cash_in_amount: number | string | null;
  cash_out_amount: number | string | null;
  internal_transfer_effect_amount: number | string | null;
  cash_effect_amount: number | string | null;
  running_cash_effect_amount: number | string | null;
  status: string | null;
  created_at: string | null;
};

type ProfitSharingRow = {
  tenant_id: string;
  unit_id: string | null;
  nama_bumdes: string | null;
  kode_bumdes: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  allocation_no: string | null;
  allocation_date: string | null;
  allocation_status: string | null;
  closing_year: number | null;
  revenue_total: number | string | null;
  expense_total: number | string | null;
  surplus_deficit: number | string | null;
  total_allocation_amount: number | string | null;
  total_distributed_amount: number | string | null;
  total_remaining_amount: number | string | null;
  total_external_payment_amount: number | string | null;
  total_internal_capital_allocation_amount: number | string | null;
  summary_status: string | null;
};

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumBy<T>(rows: T[], getter: (row: T) => number | string | null | undefined) {
  return rows.reduce((total, row) => total + toNumber(getter(row)), 0);
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(toNumber(value));
}

function formatPeriod(year?: number | null, month?: number | null) {
  if (!year) return "-";

  if (!month) return String(year);

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusBadge(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  if (
    normalized.includes("balanced") ||
    normalized.includes("seimbang") ||
    normalized.includes("completed") ||
    normalized.includes("selesai") ||
    normalized.includes("posted")
  ) {
    return "success" as const;
  }

  if (
    normalized.includes("error") ||
    normalized.includes("selisih") ||
    normalized.includes("failed") ||
    normalized.includes("gagal")
  ) {
    return "danger" as const;
  }

  return "warning" as const;
}

export default async function BumdesReportsPage() {
  const context = await getLoginContext();
  const tenantId = context?.tenant_id ?? null;
  const supabase = await createClient();

  const [
    labaRugiResult,
    neracaResult,
    cashFlowResult,
    profitSharingResult,
  ] = tenantId
    ? await Promise.all([
        supabase
          .from("v_laba_rugi_summary")
          .select(
            "tenant_id, unit_id, period_year, period_month, total_pendapatan, total_hpp, laba_kotor, total_beban, laba_rugi_bersih",
          )
          .eq("tenant_id", tenantId)
          .order("period_year", { ascending: false })
          .order("period_month", { ascending: false }),

        supabase
          .from("v_neraca_summary")
          .select(
            "tenant_id, unit_id, total_aset, total_kewajiban, total_ekuitas, total_kewajiban_ekuitas, selisih_neraca, status_neraca",
          )
          .eq("tenant_id", tenantId),

        supabase
          .from("v_cash_flow_statement")
          .select(
            "tenant_id, unit_id, kode_unit, nama_unit, report_year, report_month, activity_section_name, activity_name, transaction_no, cash_in_amount, cash_out_amount, internal_transfer_effect_amount, cash_effect_amount, running_cash_effect_amount, status, created_at",
          )
          .eq("tenant_id", tenantId)
          .order("report_year", { ascending: false })
          .order("report_month", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50),

        supabase
          .from("v_profit_sharing_allocation_summary")
          .select(
            "tenant_id, unit_id, nama_bumdes, kode_bumdes, kode_unit, nama_unit, allocation_no, allocation_date, allocation_status, closing_year, revenue_total, expense_total, surplus_deficit, total_allocation_amount, total_distributed_amount, total_remaining_amount, total_external_payment_amount, total_internal_capital_allocation_amount, summary_status",
          )
          .eq("tenant_id", tenantId)
          .order("closing_year", { ascending: false })
          .limit(10),
      ])
    : [
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
        { data: null, error: null },
      ];

  const labaRugiRows = (labaRugiResult.data ?? []) as LabaRugiRow[];
  const neracaRows = (neracaResult.data ?? []) as NeracaRow[];
  const cashFlowRows = (cashFlowResult.data ?? []) as CashFlowRow[];
  const profitSharingRows = (profitSharingResult.data ?? []) as ProfitSharingRow[];

  const errors = [
    labaRugiResult.error?.message,
    neracaResult.error?.message,
    cashFlowResult.error?.message,
    profitSharingResult.error?.message,
  ].filter(Boolean);

  const latestLabaRugi = labaRugiRows[0];

  const totalPendapatan = sumBy(labaRugiRows, (row) => row.total_pendapatan);
  const totalHpp = sumBy(labaRugiRows, (row) => row.total_hpp);
  const totalBeban = sumBy(labaRugiRows, (row) => row.total_beban);
  const labaBersih = sumBy(labaRugiRows, (row) => row.laba_rugi_bersih);

  const totalAset = sumBy(neracaRows, (row) => row.total_aset);
  const totalKewajiban = sumBy(neracaRows, (row) => row.total_kewajiban);
  const totalEkuitas = sumBy(neracaRows, (row) => row.total_ekuitas);
  const selisihNeraca = sumBy(neracaRows, (row) => row.selisih_neraca);

  const totalCashIn = sumBy(cashFlowRows, (row) => row.cash_in_amount);
  const totalCashOut = sumBy(cashFlowRows, (row) => row.cash_out_amount);
  const totalCashEffect = sumBy(cashFlowRows, (row) => row.cash_effect_amount);
  const totalInternalTransfer = sumBy(cashFlowRows, (row) => row.internal_transfer_effect_amount);

  const latestProfitSharing = profitSharingRows[0];

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Laporan Konsolidasi"
        title="Laporan Konsolidasi BUMDes"
        description="Pantau ringkasan laba rugi, neraca, arus kas, ekuitas, dan bagi hasil dari reporting views database."
        action={
          <Button type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Ekspor
          </Button>
        }
      />

      {!tenantId ? (
        <Card>
          <CardHeader
            title="Tenant BUMDes Tidak Ditemukan"
            description="Akun ini belum memiliki tenant aktif sehingga laporan konsolidasi belum dapat ditampilkan."
            action={<Badge variant="danger">Tidak Ada Tenant</Badge>}
          />
          <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
            Pastikan akun Direktur BUMDes sudah terhubung ke tenant melalui
            data role dan profil pengguna.
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Pendapatan Konsolidasi"
              value={formatCurrency(totalPendapatan)}
              description={`Periode terbaru: ${formatPeriod(latestLabaRugi?.period_year, latestLabaRugi?.period_month)}`}
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              title="Laba Bersih"
              value={formatCurrency(labaBersih)}
              description={`HPP ${formatCurrency(totalHpp)} • Beban ${formatCurrency(totalBeban)}`}
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <StatCard
              title="Total Aset"
              value={formatCurrency(totalAset)}
              description={`Kewajiban ${formatCurrency(totalKewajiban)}`}
              icon={<Landmark className="h-5 w-5" />}
            />
            <StatCard
              title="Total Ekuitas"
              value={formatCurrency(totalEkuitas)}
              description={`Selisih neraca ${formatCurrency(selisihNeraca)}`}
              icon={<Scale className="h-5 w-5" />}
            />
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Ringkasan Laba Rugi"
                description="Pendapatan, HPP, beban, dan laba bersih berdasarkan v_laba_rugi_summary."
                action={
                  errors.length ? (
                    <Badge variant="danger">Ada Error</Badge>
                  ) : (
                    <Badge variant="success">Aktif</Badge>
                  )
                }
              />

              {errors.length ? (
                <div className="px-5 pb-5 text-sm leading-7 text-red-600">
                  {errors.map((message) => (
                    <p key={message}>{message}</p>
                  ))}
                </div>
              ) : labaRugiRows.length === 0 ? (
                <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
                  Belum ada data laba rugi untuk tenant BUMDes ini.
                </div>
              ) : (
                <div className="overflow-x-auto px-5 pb-5">
                  <table className="min-w-[760px] w-full border-separate border-spacing-y-3 text-left text-sm">
                    <thead>
                      <tr className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                        <th className="px-4">Periode</th>
                        <th className="px-4">Pendapatan</th>
                        <th className="px-4">HPP</th>
                        <th className="px-4">Beban</th>
                        <th className="px-4">Laba Bersih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {labaRugiRows.map((row) => (
                        <tr
                          key={`${row.unit_id ?? "tenant"}-${row.period_year}-${row.period_month}`}
                          className="bg-white shadow-sm ring-1 ring-slate-100"
                        >
                          <td className="rounded-l-2xl px-4 py-4 font-bold text-slate-900">
                            {formatPeriod(row.period_year, row.period_month)}
                          </td>
                          <td className="px-4 py-4">{formatCurrency(row.total_pendapatan)}</td>
                          <td className="px-4 py-4">{formatCurrency(row.total_hpp)}</td>
                          <td className="px-4 py-4">{formatCurrency(row.total_beban)}</td>
                          <td className="rounded-r-2xl px-4 py-4 font-black text-emerald-700">
                            {formatCurrency(row.laba_rugi_bersih)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Arus Kas"
                description="Ringkasan kas masuk, kas keluar, dan efek kas."
                action={<Badge variant="success">View Arus Kas</Badge>}
              />

              <div className="space-y-4 px-5 pb-5">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="flex items-center gap-3">
                    <WalletCards className="h-5 w-5 text-emerald-700" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                        Kas Masuk
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {formatCurrency(totalCashIn)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                  <div className="flex items-center gap-3">
                    <Activity className="h-5 w-5 text-orange-700" />
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-700">
                        Kas Keluar
                      </p>
                      <p className="mt-1 text-xl font-black text-slate-950">
                        {formatCurrency(totalCashOut)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Efek Kas Bersih
                  </p>
                  <p className="mt-1 text-xl font-black text-slate-950">
                    {formatCurrency(totalCashEffect)}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Transfer internal: {formatCurrency(totalInternalTransfer)}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="mb-5 grid gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader
                title="Neraca Konsolidasi"
                description="Aset, kewajiban, ekuitas, dan status keseimbangan neraca."
                action={
                  <Badge variant={getStatusBadge(neracaRows[0]?.status_neraca)}>
                    {neracaRows[0]?.status_neraca ?? "Belum Ada Data"}
                  </Badge>
                }
              />

              <div className="space-y-3 px-5 pb-5">
                {neracaRows.length === 0 ? (
                  <p className="text-sm leading-7 text-slate-600">
                    Belum ada data neraca untuk tenant BUMDes ini.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-600">Total Aset</span>
                      <span className="font-black text-slate-950">{formatCurrency(totalAset)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-600">Total Kewajiban</span>
                      <span className="font-black text-slate-950">{formatCurrency(totalKewajiban)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                      <span className="text-sm font-semibold text-slate-600">Total Ekuitas</span>
                      <span className="font-black text-slate-950">{formatCurrency(totalEkuitas)}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                      <span className="text-sm font-semibold text-emerald-800">Selisih Neraca</span>
                      <span className="font-black text-emerald-900">{formatCurrency(selisihNeraca)}</span>
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader
                title="Ringkasan Bagi Hasil"
                description="Alokasi, distribusi, dan sisa bagi hasil berdasarkan view bagi hasil."
                action={
                  <Badge variant={getStatusBadge(latestProfitSharing?.summary_status)}>
                    {latestProfitSharing?.summary_status ?? "Belum Ada Data"}
                  </Badge>
                }
              />

              {profitSharingRows.length === 0 ? (
                <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
                  Belum ada data bagi hasil untuk tenant BUMDes ini.
                </div>
              ) : (
                <div className="space-y-3 px-5 pb-5">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <div className="flex items-center gap-3">
                      <PiggyBank className="h-5 w-5 text-emerald-700" />
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                          Surplus / Defisit Tahun {latestProfitSharing?.closing_year ?? "-"}
                        </p>
                        <p className="mt-1 text-xl font-black text-slate-950">
                          {formatCurrency(latestProfitSharing?.surplus_deficit)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500">Total Alokasi</p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatCurrency(latestProfitSharing?.total_allocation_amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500">Sudah Didistribusi</p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatCurrency(latestProfitSharing?.total_distributed_amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500">Pembayaran Eksternal</p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatCurrency(latestProfitSharing?.total_external_payment_amount)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold text-slate-500">Cadangan Internal</p>
                      <p className="mt-1 font-black text-slate-950">
                        {formatCurrency(latestProfitSharing?.total_internal_capital_allocation_amount)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Aktivitas Arus Kas Terbaru"
              description="Transaksi kas terbaru dari view arus kas untuk membantu direktur membaca aliran dana operasional."
              action={<Badge variant="success">{formatNumber(cashFlowRows.length)} Baris</Badge>}
            />

            {cashFlowRows.length === 0 ? (
              <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
                Belum ada aktivitas arus kas untuk tenant BUMDes ini.
              </div>
            ) : (
              <div className="overflow-x-auto px-5 pb-5">
                <table className="min-w-[980px] w-full border-separate border-spacing-y-3 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-4">Tanggal</th>
                      <th className="px-4">Unit</th>
                      <th className="px-4">Aktivitas</th>
                      <th className="px-4">Kas Masuk</th>
                      <th className="px-4">Kas Keluar</th>
                      <th className="px-4">Efek Kas</th>
                      <th className="px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cashFlowRows.map((row, index) => (
                      <tr
                        key={`${row.transaction_no ?? "cash"}-${index}`}
                        className="bg-white shadow-sm ring-1 ring-slate-100"
                      >
                        <td className="rounded-l-2xl px-4 py-4 font-bold text-slate-900">
                          {formatDate(row.created_at)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-900">{row.nama_unit ?? "-"}</p>
                          <p className="mt-1 text-xs text-slate-500">{row.kode_unit ?? "-"}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800">
                            {row.activity_name ?? row.activity_section_name ?? "-"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {row.transaction_no ?? "-"}
                          </p>
                        </td>
                        <td className="px-4 py-4 text-emerald-700">
                          {formatCurrency(row.cash_in_amount)}
                        </td>
                        <td className="px-4 py-4 text-orange-700">
                          {formatCurrency(row.cash_out_amount)}
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900">
                          {formatCurrency(row.cash_effect_amount)}
                        </td>
                        <td className="rounded-r-2xl px-4 py-4">
                          <Badge variant={getStatusBadge(row.status)}>
                            {row.status ?? "-"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

