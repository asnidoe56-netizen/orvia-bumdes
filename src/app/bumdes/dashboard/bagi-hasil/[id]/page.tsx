export const dynamic = "force-dynamic";

import { ArrowLeft, Banknote, FileText, HandCoins, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type ProfitSharingFlowRow = {
  allocation_id: string;
  allocation_no: string;
  allocation_date: string | null;
  allocation_status: string;
  closing_year: number;
  scheme_name: string | null;
  surplus_amount: number | string | null;
  allocation_journal_no: string | null;
  allocation_journal_status: string | null;

  allocation_code: string;
  allocation_name: string;
  allocation_percentage: number | string | null;
  allocation_amount: number | string | null;

  target_account_code: string | null;
  target_account_name: string | null;
  target_account_type: string | null;

  distribution_no: string | null;
  distribution_date: string | null;
  distribution_type: string | null;
  distribution_status: string | null;
  distributed_amount: number | string | null;
  remaining_amount: number | string | null;
  distribution_journal_no: string | null;
  distribution_journal_status: string | null;

  source_cash_bank_code: string | null;
  source_cash_bank_name: string | null;
  destination_cash_bank_code: string | null;
  destination_cash_bank_name: string | null;

  source_cash_bank_transaction_type: string | null;
  source_cash_bank_transaction_status: string | null;
  destination_cash_bank_transaction_type: string | null;
  destination_cash_bank_transaction_status: string | null;

  flow_category: string;
  flow_status: string;
  line_no: number;
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

function formatPercent(value: number | string | null | undefined) {
  return `${toNumber(value).toLocaleString("id-ID", {
    maximumFractionDigits: 2,
  })}%`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getFlowVariant(status: string) {
  if (status === "selesai") return "success";
  if (status === "sebagian") return "warning";
  if (status === "belum_distribusi") return "info";
  if (status === "dibatalkan") return "danger";

  return "neutral";
}

function getFlowLabel(status: string) {
  if (status === "selesai") return "Selesai";
  if (status === "sebagian") return "Sebagian";
  if (status === "belum_distribusi") return "Belum Distribusi";
  if (status === "dibatalkan") return "Dibatalkan";

  return status;
}

function getDistributionLabel(type: string | null) {
  if (type === "external_payment") return "Pembayaran Keluar";
  if (type === "internal_transfer") return "Transfer Internal";

  return "-";
}

export default async function BumdesBagiHasilDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_profit_sharing_allocation_flow")
    .select(
      "allocation_id, allocation_no, allocation_date, allocation_status, closing_year, scheme_name, surplus_amount, allocation_journal_no, allocation_journal_status, allocation_code, allocation_name, allocation_percentage, allocation_amount, target_account_code, target_account_name, target_account_type, distribution_no, distribution_date, distribution_type, distribution_status, distributed_amount, remaining_amount, distribution_journal_no, distribution_journal_status, source_cash_bank_code, source_cash_bank_name, destination_cash_bank_code, destination_cash_bank_name, source_cash_bank_transaction_type, source_cash_bank_transaction_status, destination_cash_bank_transaction_type, destination_cash_bank_transaction_status, flow_category, flow_status, line_no"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("allocation_id", id)
    .order("line_no", { ascending: true });

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Gagal membaca detail Bagi Hasil: {error.message}
      </div>
    );
  }

  const rows = (data ?? []) as ProfitSharingFlowRow[];

  if (rows.length === 0) {
    notFound();
  }

  const header = rows[0];

  const totalAllocation = rows.reduce(
    (total, row) => total + toNumber(row.allocation_amount),
    0
  );

  const totalDistributed = rows.reduce(
    (total, row) => total + toNumber(row.distributed_amount),
    0
  );

  const totalRemaining = rows.reduce(
    (total, row) => total + toNumber(row.remaining_amount),
    0
  );

  const internalCapital = rows
    .filter((row) => row.flow_category === "alokasi_internal_modal")
    .reduce((total, row) => total + toNumber(row.distributed_amount), 0);

  const allCompleted = rows.every((row) => row.flow_status === "selesai");

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Bagi Hasil / Detail"
        title={`Detail Bagi Hasil ${header.allocation_no}`}
        description={`Tahun ${header.closing_year}. Data detail ini dibaca dari v_profit_sharing_allocation_flow.`}
        action={
          <Link
            href="/bumdes/dashboard/bagi-hasil"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Alokasi"
          value={formatRupiah(totalAllocation)}
          description={`Jurnal: ${header.allocation_journal_no ?? "-"}`}
          icon={<HandCoins className="h-5 w-5" />}
        />
        <StatCard
          title="Sudah Didistribusi"
          value={formatRupiah(totalDistributed)}
          description={`Sisa: ${formatRupiah(totalRemaining)}.`}
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          title="Kas Alokasi Modal"
          value={formatRupiah(internalCapital)}
          description="Bagian cadangan/pengembangan modal."
          icon={<WalletCards className="h-5 w-5" />}
        />
        <StatCard
          title="Status"
          value={allCompleted ? "Selesai" : "Belum Selesai"}
          description={`Alokasi ${header.allocation_status}.`}
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      <Card className="mb-5">
        <CardHeader
          title="Informasi Alokasi"
          description="Ringkasan header penetapan Bagi Hasil dan status jurnal utama."
          action={
            <Badge variant={allCompleted ? "success" : "warning"}>
              {allCompleted ? "Selesai" : "Perlu Cek"}
            </Badge>
          }
        />

        <div className="grid gap-4 px-5 pb-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Nomor Alokasi
            </p>
            <p className="mt-2 font-bold text-slate-950">{header.allocation_no}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Tanggal
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {formatDate(header.allocation_date)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Skema
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {header.scheme_name ?? "-"}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Jurnal Penetapan
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {header.allocation_journal_no ?? "-"}
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Detail Distribusi Bagi Hasil"
          description="PADes, Dana Sosial, dan Insentif menjadi pembayaran keluar. Cadangan Modal menjadi transfer internal ke Kas Alokasi Bagi Hasil."
          action={<Badge variant="success">Audit Flow</Badge>}
        />

        <DataTable
          columns={[
            "Alokasi",
            "Nominal",
            "Distribusi",
            "Kas Sumber",
            "Kas Tujuan",
            "Jurnal Distribusi",
            "Status",
          ]}
          emptyText="Belum ada detail alokasi."
        >
          {rows.map((row) => (
            <tr key={row.allocation_code} className="hover:bg-slate-50">
              <td className="px-4 py-4">
                <div className="font-bold text-slate-950">
                  {row.allocation_name}
                </div>
                <div className="mt-1 text-xs font-medium text-slate-500">
                  {row.allocation_code} · {formatPercent(row.allocation_percentage)} ·{" "}
                  {row.target_account_code} {row.target_account_name}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-800">
                  {formatRupiah(row.allocation_amount)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Sisa: {formatRupiah(row.remaining_amount)}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-800">
                  {getDistributionLabel(row.distribution_type)}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {row.distribution_no ?? "-"} · {formatDate(row.distribution_date)}
                </div>
              </td>
              <td className="px-4 py-4 text-sm font-medium text-slate-700">
                {row.source_cash_bank_code ?? "-"}
                <div className="mt-1 text-xs text-slate-500">
                  {row.source_cash_bank_transaction_type ?? "-"}
                </div>
              </td>
              <td className="px-4 py-4 text-sm font-medium text-slate-700">
                {row.destination_cash_bank_code ?? "-"}
                <div className="mt-1 text-xs text-slate-500">
                  {row.destination_cash_bank_transaction_type ?? "-"}
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="font-semibold text-slate-800">
                  {row.distribution_journal_no ?? "-"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {row.distribution_journal_status ?? "-"}
                </div>
              </td>
              <td className="px-4 py-4">
                <Badge variant={getFlowVariant(row.flow_status)}>
                  {getFlowLabel(row.flow_status)}
                </Badge>
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
