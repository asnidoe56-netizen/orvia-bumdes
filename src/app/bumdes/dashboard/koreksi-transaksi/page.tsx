import {
  Clock3,
  Eye,
  FileCheck2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type CorrectionFlowRow = {
  correction_id: string;
  tenant_id: string;
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  unit_id: string | null;
  kode_unit: string | null;
  nama_unit: string | null;
  correction_no: string;
  correction_date: string;
  reason: string;
  correction_status: string;
  original_journal_no: string | null;
  original_source_type: string | null;
  original_total_debit: number | string | null;
  corrected_journal_no: string | null;
  flow_status: string;
  audit_result: string;
  requested_by_name: string | null;
  requested_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  posted_by_name: string | null;
  posted_at: string | null;
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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Menunggu Persetujuan",
    approved: "Siap Posting",
    rejected: "Ditolak",
    posted: "Sudah Diposting",
    cancelled: "Dibatalkan",
  };

  return labels[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
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
    return <Badge variant="danger">{statusLabel(status)}</Badge>;
  }

  return <Badge variant="neutral">{statusLabel(status)}</Badge>;
}

export default async function BumdesKoreksiTransaksiPage() {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_journal_correction_flow")
    .select(
      [
        "correction_id",
        "tenant_id",
        "kode_bumdes",
        "nama_bumdes",
        "unit_id",
        "kode_unit",
        "nama_unit",
        "correction_no",
        "correction_date",
        "reason",
        "correction_status",
        "original_journal_no",
        "original_source_type",
        "original_total_debit",
        "corrected_journal_no",
        "flow_status",
        "audit_result",
        "requested_by_name",
        "requested_at",
        "approved_by_name",
        "approved_at",
        "posted_by_name",
        "posted_at",
        "created_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .in("correction_status", ["pending_approval", "approved", "rejected", "posted"])
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];

  const readyToPostRows = rows.filter((item) => item.correction_status === "approved");
  const pendingCount = rows.filter((item) => item.correction_status === "pending_approval").length;
  const rejectedCount = rows.filter((item) => item.correction_status === "rejected").length;
  const postedCount = rows.filter((item) => item.correction_status === "posted").length;

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca data koreksi transaksi: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin BUMDes / Koreksi Transaksi
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Posting Koreksi Transaksi
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Kelola koreksi transaksi yang sudah disetujui Pengawas. Admin BUMDes
              bertugas memposting koreksi agar jurnal pembalik dan jurnal pengganti
              masuk ke pembukuan resmi.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-700">Role Login</p>
            <p className="mt-1 font-bold text-emerald-950">
              {context.role}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Siap Posting"
          value={String(readyToPostRows.length)}
          description="Sudah disetujui Pengawas."
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Menunggu Pengawas"
          value={String(pendingCount)}
          description="Belum bisa diposting."
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        <StatCard
          title="Ditolak"
          value={String(rejectedCount)}
          description="Perlu diperbaiki oleh pembuat koreksi."
          icon={<XCircle className="h-5 w-5" />}
        />

        <StatCard
          title="Sudah Diposting"
          value={String(postedCount)}
          description="Koreksi final masuk audit trail."
          icon={<FileCheck2 className="h-5 w-5" />}
        />
      </section>

      <Card>
        <CardHeader
          title="Daftar Koreksi Siap Posting"
          description="Koreksi pada daftar ini sudah disetujui Pengawas dan menunggu posting oleh Admin BUMDes."
          action={<Badge variant="warning">{readyToPostRows.length} siap posting</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Koreksi",
            "Unit",
            "Transaksi Asal",
            "Nilai",
            "Disetujui Oleh",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada koreksi transaksi yang siap diposting."
        >
          {readyToPostRows.length > 0
            ? readyToPostRows.map((item) => (
                <tr key={item.correction_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {item.correction_no}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.correction_date}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800">
                      {item.nama_unit ?? "-"}
                    </div>
                    <div className="mt-1 text-xs font-medium text-slate-500">
                      {item.kode_unit ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800">
                      {item.original_journal_no ?? "-"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.original_source_type ?? "-"}
                    </div>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(item.original_total_debit)}
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    <div>{item.approved_by_name ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.approved_at)}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={item.correction_status} />
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/bumdes/dashboard/koreksi-transaksi/${item.correction_id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      Posting
                    </Link>
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Riwayat Koreksi Transaksi"
          description="Menampilkan koreksi yang masih menunggu Pengawas, ditolak, atau sudah diposting."
          action={<Badge variant="neutral">{rows.length} total</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Koreksi",
            "Unit",
            "Status",
            "Flow",
            "Audit",
            "Tanggal",
            "Aksi",
          ]}
          emptyText="Belum ada riwayat koreksi transaksi."
        >
          {rows.length > 0
            ? rows.map((item) => (
                <tr key={item.correction_id} className="hover:bg-slate-50">
                  <td className="px-4 py-4 font-bold text-slate-950">
                    {item.correction_no}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {item.nama_unit ?? "-"}
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={item.correction_status} />
                  </td>

                  <td className="px-4 py-4 text-xs font-semibold text-slate-500">
                    {item.flow_status}
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

                  <td className="px-4 py-4">
                    <Link
                      href={`/bumdes/dashboard/koreksi-transaksi/${item.correction_id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
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
