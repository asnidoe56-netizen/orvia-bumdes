import { Clock3, Eye, FileCheck2, ShieldCheck, XCircle } from "lucide-react";
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
  original_description: string | null;
  original_total_debit: number | string | null;
  corrected_journal_no: string | null;
  flow_status: string;
  audit_result: string;
  requested_by_name: string | null;
  requested_at: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  rejected_by_name: string | null;
  rejected_at: string | null;
  posted_by_name: string | null;
  posted_at: string | null;
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
    approved: "Disetujui",
    rejected: "Ditolak",
    posted: "Sudah Diposting",
    cancelled: "Dibatalkan",
  };

  return labels[status] ?? status;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "pending_approval") {
    return <Badge variant="warning">Menunggu Persetujuan</Badge>;
  }

  if (status === "approved" || status === "posted") {
    return <Badge variant="success">{statusLabel(status)}</Badge>;
  }

  if (status === "rejected" || status === "cancelled") {
    return <Badge variant="danger">{statusLabel(status)}</Badge>;
  }

  return <Badge variant="neutral">{statusLabel(status)}</Badge>;
}

export default async function PengawasKoreksiTransaksiPage() {
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
        "original_description",
        "original_total_debit",
        "corrected_journal_no",
        "flow_status",
        "audit_result",
        "requested_by_name",
        "requested_at",
        "approved_by_name",
        "approved_at",
        "rejected_by_name",
        "rejected_at",
        "posted_by_name",
        "posted_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];

  const waitingRows = rows.filter(
    (item) => item.correction_status === "pending_approval"
  );

  const approvedCount = rows.filter(
    (item) => item.correction_status === "approved"
  ).length;

  const rejectedCount = rows.filter(
    (item) => item.correction_status === "rejected"
  ).length;

  const postedCount = rows.filter(
    (item) => item.correction_status === "posted"
  ).length;

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
              Pengawas / Koreksi Transaksi
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Persetujuan Koreksi Transaksi
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review koreksi transaksi yang diajukan unit BUMDes. Pengawas hanya
              menyetujui atau menolak. Posting koreksi tetap dilakukan oleh sistem
              atau admin yang berwenang.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-semibold text-emerald-700">Scope Pengawasan</p>
            <p className="mt-1 font-bold text-emerald-950">
              {rows[0]?.nama_bumdes ?? context.tenant_id}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Menunggu Persetujuan"
          value={String(waitingRows.length)}
          description="Koreksi yang perlu direview pengawas."
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Disetujui"
          value={String(approvedCount)}
          description="Sudah disetujui, menunggu posting."
          icon={<ShieldCheck className="h-5 w-5" />}
        />

        <StatCard
          title="Ditolak"
          value={String(rejectedCount)}
          description="Dikembalikan dengan alasan penolakan."
          icon={<XCircle className="h-5 w-5" />}
        />

        <StatCard
          title="Sudah Diposting"
          value={String(postedCount)}
          description="Koreksi final dan masuk audit trail."
          icon={<FileCheck2 className="h-5 w-5" />}
        />
      </section>

      <Card>
        <CardHeader
          title="Daftar Koreksi Menunggu Persetujuan"
          description="Data ini bersumber dari v_journal_correction_flow dan dibatasi sesuai tenant pengawas."
          action={<Badge variant="warning">Perlu Review</Badge>}
        />

        <DataTable
          columns={[
            "Nomor Koreksi",
            "Unit",
            "Transaksi Asal",
            "Nilai",
            "Alasan",
            "Diajukan",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada koreksi transaksi yang menunggu persetujuan."
        >
          {waitingRows.length > 0
            ? waitingRows.map((item) => (
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

                  <td className="px-4 py-4">
                    <p className="max-w-xs line-clamp-2 text-sm text-slate-700">
                      {item.reason}
                    </p>
                  </td>

                  <td className="px-4 py-4 text-sm text-slate-600">
                    <div>{item.requested_by_name ?? "-"}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.requested_at)}
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <StatusBadge status={item.correction_status} />
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`/pengawas/dashboard/koreksi-transaksi/${item.correction_id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
                    >
                      <Eye className="h-4 w-4" />
                      Review
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