export const dynamic = "force-dynamic";

import {
  ClipboardList,
  FileText,
  HandCoins,
  Landmark,
  ListChecks,
  PlayCircle,
  Printer,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type ProfitSharingSummary = {
  allocation_id: string;
  allocation_no: string;
  closing_year: number;
  allocation_status: string;
  summary_status: string;
  total_allocation_amount: number | string | null;
  total_distributed_amount: number | string | null;
  total_remaining_amount: number | string | null;
  total_external_payment_amount: number | string | null;
  total_internal_capital_allocation_amount: number | string | null;
  line_count: number | null;
  completed_line_count: number | null;
  incomplete_line_count: number | null;
  allocation_date: string | null;
  last_distribution_posted_at: string | null;
};

type AnnualClosingRow = {
  id: string;
  unit_id: string | null;
  closing_year: number;
  status: string;
  journal_entry_id: string | null;
  surplus_deficit: number | string | null;
  retained_earnings_amount: number | string | null;
};

type ProfitSharingAllocationRow = {
  id: string;
  annual_closing_id: string;
  allocation_no: string;
  status: string;
  journal_entry_id: string | null;
};

type KasAlokasiAccount = {
  id: string;
  account_code: string;
  account_name: string;
};

type WorkflowStatus = {
  annualClosingId: string;
  closingYear: number;
  annualClosingStatus: string;
  annualClosingJournalEntryId: string | null;
  surplusDeficit: number;
  allocationId: string | null;
  allocationNo: string | null;
  allocationStatus: string | null;
  allocationJournalEntryId: string | null;
  recommendation: string;
  actionLabel: string;
  actionHref: string;
  isComplete: boolean;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getSummaryVariant(status: string) {
  if (status === "selesai") return "success";
  if (status === "sebagian") return "warning";
  if (status === "belum_distribusi") return "info";

  return "neutral";
}

function getStatusLabel(status: string) {
  if (status === "selesai") return "Selesai";
  if (status === "sebagian") return "Sebagian";
  if (status === "belum_distribusi") return "Belum Distribusi";
  if (status === "posted") return "Posted";
  if (status === "approved") return "Disetujui";
  if (status === "calculated") return "Dihitung";

  return status;
}

function buildWorkflowStatus(
  closing: AnnualClosingRow,
  allocations: ProfitSharingAllocationRow[],
  summaries: ProfitSharingSummary[]
): WorkflowStatus {
  const allocation = allocations.find(
    (item) => item.annual_closing_id === closing.id
  );

  const summary = allocation
    ? summaries.find((item) => item.allocation_id === allocation.id)
    : null;

  const remainingAmount = toNumber(summary?.total_remaining_amount);
  const isComplete =
    allocation?.status === "posted" &&
    summary?.summary_status === "selesai" &&
    remainingAmount === 0;

  if (closing.status !== "posted" || !closing.journal_entry_id) {
    return {
      annualClosingId: closing.id,
      closingYear: closing.closing_year,
      annualClosingStatus: closing.status,
      annualClosingJournalEntryId: closing.journal_entry_id,
      surplusDeficit: toNumber(closing.surplus_deficit),
      allocationId: allocation?.id ?? null,
      allocationNo: allocation?.allocation_no ?? null,
      allocationStatus: allocation?.status ?? null,
      allocationJournalEntryId: allocation?.journal_entry_id ?? null,
      recommendation: "Posting annual closing sebelum menghitung Bagi Hasil.",
      actionLabel: "Posting Annual Closing",
      actionHref: `/bumdes/dashboard/bagi-hasil/proses?closingId=${closing.id}`,
      isComplete: false,
    };
  }

  if (!allocation) {
    return {
      annualClosingId: closing.id,
      closingYear: closing.closing_year,
      annualClosingStatus: closing.status,
      annualClosingJournalEntryId: closing.journal_entry_id,
      surplusDeficit: toNumber(closing.surplus_deficit),
      allocationId: null,
      allocationNo: null,
      allocationStatus: null,
      allocationJournalEntryId: null,
      recommendation: "Annual closing sudah posted. Tahun ini siap dihitung Bagi Hasil.",
      actionLabel: "Hitung Bagi Hasil",
      actionHref: `/bumdes/dashboard/bagi-hasil/proses?closingId=${closing.id}`,
      isComplete: false,
    };
  }

  if (allocation.status === "calculated") {
    return {
      annualClosingId: closing.id,
      closingYear: closing.closing_year,
      annualClosingStatus: closing.status,
      annualClosingJournalEntryId: closing.journal_entry_id,
      surplusDeficit: toNumber(closing.surplus_deficit),
      allocationId: allocation.id,
      allocationNo: allocation.allocation_no,
      allocationStatus: allocation.status,
      allocationJournalEntryId: allocation.journal_entry_id,
      recommendation: "Alokasi sudah dihitung dan menunggu persetujuan.",
      actionLabel: "Setujui Bagi Hasil",
      actionHref: `/bumdes/dashboard/bagi-hasil/proses?allocationId=${allocation.id}`,
      isComplete: false,
    };
  }

  if (allocation.status === "approved") {
    return {
      annualClosingId: closing.id,
      closingYear: closing.closing_year,
      annualClosingStatus: closing.status,
      annualClosingJournalEntryId: closing.journal_entry_id,
      surplusDeficit: toNumber(closing.surplus_deficit),
      allocationId: allocation.id,
      allocationNo: allocation.allocation_no,
      allocationStatus: allocation.status,
      allocationJournalEntryId: allocation.journal_entry_id,
      recommendation: "Alokasi sudah disetujui dan siap diposting.",
      actionLabel: "Posting Bagi Hasil",
      actionHref: `/bumdes/dashboard/bagi-hasil/proses?allocationId=${allocation.id}`,
      isComplete: false,
    };
  }

  if (allocation.status === "posted" && remainingAmount > 0) {
    return {
      annualClosingId: closing.id,
      closingYear: closing.closing_year,
      annualClosingStatus: closing.status,
      annualClosingJournalEntryId: closing.journal_entry_id,
      surplusDeficit: toNumber(closing.surplus_deficit),
      allocationId: allocation.id,
      allocationNo: allocation.allocation_no,
      allocationStatus: allocation.status,
      allocationJournalEntryId: allocation.journal_entry_id,
      recommendation: "Alokasi sudah posted. Masih ada sisa yang perlu didistribusikan.",
      actionLabel: "Distribusikan",
      actionHref: `/bumdes/dashboard/bagi-hasil/proses?allocationId=${allocation.id}`,
      isComplete: false,
    };
  }

  return {
    annualClosingId: closing.id,
    closingYear: closing.closing_year,
    annualClosingStatus: closing.status,
    annualClosingJournalEntryId: closing.journal_entry_id,
    surplusDeficit: toNumber(closing.surplus_deficit),
    allocationId: allocation.id,
    allocationNo: allocation.allocation_no,
    allocationStatus: allocation.status,
    allocationJournalEntryId: allocation.journal_entry_id,
    recommendation: "Workflow Bagi Hasil sudah selesai. Gunakan detail atau cetak laporan.",
    actionLabel: "Lihat Detail",
    actionHref: `/bumdes/dashboard/bagi-hasil/${allocation.id}`,
    isComplete,
  };
}

export default async function BumdesBagiHasilPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: summaryData, error: summaryError } = await supabase
    .from("v_profit_sharing_allocation_summary")
    .select(
      "allocation_id, allocation_no, closing_year, allocation_status, summary_status, total_allocation_amount, total_distributed_amount, total_remaining_amount, total_external_payment_amount, total_internal_capital_allocation_amount, line_count, completed_line_count, incomplete_line_count, allocation_date, last_distribution_posted_at"
    )
    .eq("tenant_id", context.tenant_id)
    .order("closing_year", { ascending: false })
    .order("allocation_date", { ascending: false });

  const summaryRows = (summaryData ?? []) as ProfitSharingSummary[];

  const { data: closingData, error: closingError } = await supabase
    .from("annual_closings")
    .select(
      "id, unit_id, closing_year, status, journal_entry_id, surplus_deficit, retained_earnings_amount"
    )
    .eq("tenant_id", context.tenant_id)
    .order("closing_year", { ascending: false });

  const closingRows = (closingData ?? []) as AnnualClosingRow[];

  const { data: allocationData, error: allocationError } = await supabase
    .from("profit_sharing_allocations")
    .select("id, annual_closing_id, allocation_no, status, journal_entry_id")
    .eq("tenant_id", context.tenant_id)
    .neq("status", "cancelled")
    .order("allocation_no", { ascending: false });

  const allocationRows = (allocationData ?? []) as ProfitSharingAllocationRow[];

  const workflowRows = closingRows.map((closing) =>
    buildWorkflowStatus(closing, allocationRows, summaryRows)
  );

  const nextWorkflow = workflowRows.find((item) => !item.isComplete) ?? null;

  const { data: kasAlokasiData, error: kasAlokasiError } = await supabase
    .from("cash_bank_accounts")
    .select("id, account_code, account_name")
    .eq("tenant_id", context.tenant_id)
    .eq("account_code", "KAS-ALOKASI-BH")
    .eq("is_active", true);

  const kasAlokasiAccounts = (kasAlokasiData ?? []) as KasAlokasiAccount[];

  let kasAlokasiBalance = 0;

  for (const account of kasAlokasiAccounts) {
    const { data: balanceData } = await supabase.rpc("get_cash_bank_balance", {
      p_cash_bank_account_id: account.id,
    });

    kasAlokasiBalance += toNumber(balanceData);
  }

  const totalAllocation = summaryRows.reduce(
    (total, row) => total + toNumber(row.total_allocation_amount),
    0
  );

  const totalDistributed = summaryRows.reduce(
    (total, row) => total + toNumber(row.total_distributed_amount),
    0
  );

  const totalRemaining = summaryRows.reduce(
    (total, row) => total + toNumber(row.total_remaining_amount),
    0
  );

  const completedCount = summaryRows.filter(
    (row) => row.summary_status === "selesai"
  ).length;

  const pageError =
    summaryError?.message ||
    closingError?.message ||
    allocationError?.message ||
    kasAlokasiError?.message;

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Bagi Hasil"
        title="Bagi Hasil"
        description="Kelola alokasi dan distribusi Bagi Hasil tahunan BUMDes. Perhitungan, posting jurnal, distribusi, dan audit tetap bersumber dari engine database."
        action={
          nextWorkflow ? (
            <Link
              href={nextWorkflow.actionHref}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              <PlayCircle className="h-4 w-4" />
              {nextWorkflow.actionLabel}
            </Link>
          ) : workflowRows.length > 0 ? (
            <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <ListChecks className="h-4 w-4" />
              Semua Proses Selesai
            </span>
          ) : (
            <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
              <ClipboardList className="h-4 w-4" />
              Belum Ada Proses
            </span>
          )
        }
      />

      {pageError ? (
        <div className="mb-5 rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          Gagal membaca data Bagi Hasil: {pageError}
        </div>
      ) : null}

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Alokasi"
          value={formatRupiah(totalAllocation)}
          description="Dibaca dari v_profit_sharing_allocation_summary."
          icon={<HandCoins className="h-5 w-5" />}
        />
        <StatCard
          title="Sudah Didistribusi"
          value={formatRupiah(totalDistributed)}
          description={`Sisa distribusi: ${formatRupiah(totalRemaining)}.`}
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatCard
          title="Kas Alokasi Bagi Hasil"
          value={formatRupiah(kasAlokasiBalance)}
          description="Kas khusus untuk cadangan/pengembangan modal."
          icon={<WalletCards className="h-5 w-5" />}
        />
        <StatCard
          title="Status"
          value={summaryRows.length > 0 ? `${completedCount}/${summaryRows.length}` : "Belum Ada"}
          description={
            summaryRows.length > 0
              ? "Alokasi selesai dibanding total alokasi."
              : "Belum ada annual closing dan alokasi Bagi Hasil."
          }
          icon={<Landmark className="h-5 w-5" />}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Workflow Bagi Hasil"
          description="Tombol proses akan muncul sesuai status annual closing dan alokasi Bagi Hasil."
          action={
            nextWorkflow ? (
              <Badge variant="warning">Perlu Aksi</Badge>
            ) : workflowRows.length > 0 ? (
              <Badge variant="success">Selesai</Badge>
            ) : (
              <Badge variant="neutral">Belum Ada Proses</Badge>
            )
          }
        />

        <div className="px-5 pb-5">
          {workflowRows.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {workflowRows.map((workflow) => (
                <div
                  key={workflow.annualClosingId}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Tahun Tutup Buku
                      </p>
                      <h3 className="mt-1 text-xl font-black text-slate-950">
                        {workflow.closingYear}
                      </h3>
                    </div>
                    <Badge variant={workflow.isComplete ? "success" : "warning"}>
                      {workflow.isComplete ? "Selesai" : "Perlu Proses"}
                    </Badge>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
                    <div>
                      <p className="font-semibold text-slate-500">Annual Closing</p>
                      <p className="font-bold text-slate-900">
                        {getStatusLabel(workflow.annualClosingStatus)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Alokasi</p>
                      <p className="font-bold text-slate-900">
                        {workflow.allocationNo ?? "Belum ada"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Surplus</p>
                      <p className="font-bold text-slate-900">
                        {formatRupiah(workflow.surplusDeficit)}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-500">Status Bagi Hasil</p>
                      <p className="font-bold text-slate-900">
                        {workflow.allocationStatus
                          ? getStatusLabel(workflow.allocationStatus)
                          : "Belum dihitung"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-sm font-medium text-slate-600">
                    {workflow.recommendation}
                  </p>

                  {!workflow.isComplete ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={workflow.actionHref}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                      >
                        <PlayCircle className="h-4 w-4" />
                        {workflow.actionLabel}
                      </Link>

                      {workflow.allocationId ? (
                        <Link
                          href={`/bumdes/dashboard/bagi-hasil/${workflow.allocationId}`}
                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                        >
                          <FileText className="h-4 w-4" />
                          Detail
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-1 h-5 w-5 text-slate-500" />
                <div>
                  <p className="font-bold text-slate-950">
                    Belum ada annual closing yang siap diproses.
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-600">
                    Lakukan tutup tahun terlebih dahulu, lalu kembali ke halaman ini
                    untuk menghitung Bagi Hasil.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Ringkasan Bagi Hasil"
          description="Data ini membaca langsung dari v_profit_sharing_allocation_summary. Detail alur per baris tersedia di v_profit_sharing_allocation_flow."
          action={<Badge variant="success">Database Connected</Badge>}
        />

        <DataTable
          columns={[
            "Tahun",
            "Nomor Alokasi",
            "Total Alokasi",
            "Sudah Didistribusi",
            "Sisa",
            "Status",
            "Terakhir Distribusi",
            "Aksi",
          ]}
          emptyText="Belum ada data Bagi Hasil. Setelah annual closing dan alokasi diposting, data akan muncul di sini."
        >
          {summaryRows.length > 0
            ? summaryRows.map((row) => (
                <tr key={row.allocation_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-bold text-slate-950">
                    {row.closing_year}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {row.allocation_no}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {row.line_count ?? 0} baris · {row.completed_line_count ?? 0} selesai
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(row.total_allocation_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(row.total_distributed_amount)}
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(row.total_remaining_amount)}
                  </td>
                  <td className="px-4 py-4">
                    <Badge variant={getSummaryVariant(row.summary_status)}>
                      {getStatusLabel(row.summary_status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-600">
                    {formatDate(row.last_distribution_posted_at)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/bumdes/dashboard/bagi-hasil/${row.allocation_id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                      >
                        <FileText className="h-4 w-4" />
                        Lihat Detail
                      </Link>
                      <Link
                        href={`/bumdes/dashboard/bagi-hasil/${row.allocation_id}?print=1`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                      >
                        <Printer className="h-4 w-4" />
                        Cetak
                      </Link>

                      <Link
                        href={`/bumdes/dashboard/bagi-hasil/proses?allocationId=${row.allocation_id}`}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                      >
                        <PlayCircle className="h-4 w-4" />
                        Proses
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>
    </div>
  );
}




