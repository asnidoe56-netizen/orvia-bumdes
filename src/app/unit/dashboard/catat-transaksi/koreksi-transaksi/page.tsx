export const dynamic = "force-dynamic";

import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FilePenLine,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { postJournalCorrectionByRequesterAction } from "./actions";

type EligibleEntryRow = {
  journal_entry_id: string;
  tenant_id: string;
  unit_id: string | null;
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  journal_no: string;
  journal_date: string;
  source_type: string;
  description: string | null;
  journal_status: string;
  total_debit: number | string | null;
  total_credit: number | string | null;
  line_count: number | string | null;
  is_balanced: boolean | null;
  created_at: string | null;
};

type CorrectionFlowRow = {
  correction_id: string;
  correction_no: string;
  correction_date: string;
  correction_status: string;
  flow_status: string;
  audit_result: string;
  original_journal_no: string | null;
  original_source_type: string | null;
  original_total_debit: number | string | null;
  corrected_journal_no: string | null;
  corrected_total_debit: number | string | null;
  requested_by: string | null;
  requested_by_name: string | null;
  requested_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  posted_by_name: string | null;
  posted_at: string | null;
  reason: string | null;
  created_at: string | null;
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
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function sourceTypeLabel(value: string) {
  const labels: Record<string, string> = {
    purchase_invoice: "Pembelian",
    sales_invoice: "Penjualan",
    cash_bank_transaction: "Kas & Bank",
    operational_expense: "Beban Operasional",
    capital_expenditure: "Belanja Modal",
    revenue_receipt: "Terima Pendapatan",
    debt_payment: "Pembayaran Hutang",
  };

  return labels[value] ?? value;
}

function correctionStatusLabel(value: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Menunggu Pengawas",
    approved: "Siap Posting",
    posted: "Sudah Diposting",
    rejected: "Ditolak",
    cancelled: "Dibatalkan",
  };

  return labels[value] ?? value;
}

function CorrectionStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return <Badge variant="warning">Siap Posting</Badge>;
  }

  if (status === "posted") {
    return <Badge variant="success">Sudah Diposting</Badge>;
  }

  if (status === "pending_approval") {
    return <Badge variant="neutral">Menunggu Pengawas</Badge>;
  }

  if (status === "rejected" || status === "cancelled") {
    return <Badge variant="danger">{correctionStatusLabel(status)}</Badge>;
  }

  return <Badge variant="neutral">{correctionStatusLabel(status)}</Badge>;
}

export default async function UnitKoreksiTransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string; posted?: string }>;
}) {
  const { submitted, posted } = await searchParams;
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_journal_correction_eligible_entries")
    .select("*")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("journal_date", { ascending: false })
    .order("created_at", { ascending: false });

  const { data: correctionData, error: correctionError } = await supabase
    .from("v_journal_correction_flow")
    .select(
      [
        "correction_id",
        "correction_no",
        "correction_date",
        "correction_status",
        "flow_status",
        "audit_result",
        "original_journal_no",
        "original_source_type",
        "original_total_debit",
        "corrected_journal_no",
        "corrected_total_debit",
        "requested_by",
        "requested_by_name",
        "requested_at",
        "approved_by_name",
        "approved_at",
        "posted_by_name",
        "posted_at",
        "reason",
        "created_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("requested_by", context.user_id)
    .in("correction_status", ["pending_approval", "approved", "posted", "rejected"])
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown) as EligibleEntryRow[];
  const correctionRows = ((correctionData ?? []) as unknown) as CorrectionFlowRow[];
  const readyToPostRows = correctionRows.filter(
    (item) =>
      item.correction_status === "approved" &&
      item.flow_status === "READY_TO_POST"
  );

  const pendingRows = correctionRows.filter(
    (item) => item.correction_status === "pending_approval"
  );

  const postedRows = correctionRows.filter(
    (item) => item.correction_status === "posted"
  );

  if (error || correctionError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca data koreksi transaksi:{" "}
        {error?.message ?? correctionError?.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {submitted ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
          Pengajuan koreksi berhasil dikirim ke Pengawas. ID koreksi: {submitted}
        </div>
      ) : null}

      {posted ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm font-semibold text-emerald-800">
          Posting koreksi berhasil. Laporan Neraca dan Laba Rugi sekarang dapat
          membaca jurnal koreksi yang sudah final. ID koreksi: {posted}
        </div>
      ) : null}

      <section className="rounded-3xl border border-slate-900 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Koreksi Transaksi
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Ajukan & Posting Koreksi Transaksi
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Pilih transaksi yang sudah diposting, ajukan koreksi ke Pengawas,
              lalu setelah disetujui, pengaju dapat memposting koreksi final
              dari halaman ini.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <FilePenLine className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Transaksi Bisa Dikoreksi"
          value={String(rows.length)}
          description="Transaksi posted dan belum punya koreksi aktif."
          icon={<FilePenLine className="h-5 w-5" />}
        />

        <StatCard
          title="Siap Diposting"
          value={String(readyToPostRows.length)}
          description="Sudah disetujui Pengawas dan menunggu posting pengaju."
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Menunggu Pengawas"
          value={String(pendingRows.length)}
          description="Pengajuan masih dalam proses review."
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        <StatCard
          title="Sudah Diposting"
          value={String(postedRows.length)}
          description="Koreksi final sudah masuk pembukuan."
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
      </section>

      <Card>
        <CardHeader
          title="Koreksi Saya yang Siap Diposting"
          description="Koreksi yang sudah disetujui Pengawas dapat diposting oleh pengaju asli."
          action={<Badge variant="warning">{readyToPostRows.length} siap posting</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Koreksi",
            "Transaksi Lama",
            "Nilai Lama",
            "Nilai Pengganti",
            "Disetujui Oleh",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada koreksi milik Anda yang siap diposting."
        >
          {readyToPostRows.length > 0
            ? readyToPostRows.map((item) => (
                <tr key={item.correction_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {item.correction_no}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.reason ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800">
                      {item.original_journal_no ?? "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {sourceTypeLabel(item.original_source_type ?? "-")}
                    </div>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(item.original_total_debit)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(item.corrected_total_debit)}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    <div>{item.approved_by_name ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.approved_at)}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <CorrectionStatusBadge status={item.correction_status} />
                  </td>

                  <td className="px-4 py-4">
                    <form action={postJournalCorrectionByRequesterAction}>
                      <input
                        type="hidden"
                        name="correction_id"
                        value={item.correction_id}
                      />

                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Posting
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Riwayat Koreksi Saya"
          description="Status pengajuan koreksi yang Anda buat dari unit ini."
          action={<Badge variant="neutral">{correctionRows.length} koreksi</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Koreksi",
            "Transaksi Lama",
            "Nilai",
            "Status",
            "Audit",
            "Tanggal",
          ]}
          emptyText="Belum ada riwayat pengajuan koreksi."
        >
          {correctionRows.length > 0
            ? correctionRows.map((item) => (
                <tr key={item.correction_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {item.correction_no}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.reason ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    {item.original_journal_no ?? "-"}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(item.original_total_debit)}
                  </td>

                  <td className="px-4 py-4">
                    <CorrectionStatusBadge status={item.correction_status} />
                  </td>

                  <td className="px-4 py-4">
                    <Badge
                      variant={item.audit_result === "PASS" ? "success" : "neutral"}
                    >
                      {item.audit_result}
                    </Badge>
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    {formatDateTime(item.created_at)}
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Pilih Transaksi yang Akan Dikoreksi"
          description="Hanya transaksi operasional yang sudah posted dan belum memiliki koreksi aktif yang ditampilkan."
          action={<Badge variant="neutral">{rows.length} transaksi</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Transaksi",
            "Tanggal",
            "Jenis",
            "Keterangan",
            "Nilai",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada transaksi yang dapat diajukan koreksi."
        >
          {rows.length > 0
            ? rows.map((item) => (
                <tr key={item.journal_entry_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {item.journal_no}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.line_count ?? 0} baris
                    </div>
                  </td>

                  <td className="px-4 py-4 text-sm font-semibold text-slate-700">
                    {item.journal_date}
                  </td>

                  <td className="px-4 py-4">
                    <Badge variant="neutral">
                      {sourceTypeLabel(item.source_type)}
                    </Badge>
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    {item.description ?? "-"}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(item.total_debit)}
                  </td>

                  <td className="px-4 py-4">
                    <Badge variant={item.is_balanced ? "success" : "danger"}>
                      {item.is_balanced ? "Seimbang" : "Tidak Seimbang"}
                    </Badge>
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/unit/dashboard/catat-transaksi/koreksi-transaksi/new?journal_entry_id=${item.journal_entry_id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-900 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Ajukan
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>
    </div>
  );
}
