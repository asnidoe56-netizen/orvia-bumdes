export const dynamic = "force-dynamic";

import { CheckCircle2, Clock3, FileSearch, ShieldCheck, XCircle } from "lucide-react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type AuditAccessRequestRow = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  transparency_note_id: string;
  source_type: string;
  source_id: string;
  request_reason: string;
  status: string;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  opened_at: string | null;
  created_at: string;
};

type TransparencyNoteRow = {
  id: string;
  transaction_date: string;
  recorded_at: string;
  days_difference: number | string;
  severity: string;
  operator_reason: string | null;
  review_status: string;
};

type UnitRow = {
  id: string;
  nama_unit: string;
};

const sourceLabels: Record<string, string> = {
  operational_expense: "Beban Operasional",
  revenue_receipt: "Terima Pendapatan",
  purchase_invoice: "Pembelian",
  sales_invoice: "Penjualan",
  cash_bank_transaction: "Kas/Bank",
};

const severityLabels: Record<string, string> = {
  normal: "Normal",
  light_note: "Catatan ringan",
  attention: "Perlu perhatian",
  review_required: "Perlu tinjauan",
};

const statusLabels: Record<string, string> = {
  pending: "Menunggu keputusan",
  approved: "Disetujui",
  rejected: "Ditolak",
  opened: "Sudah dibuka",
  closed: "Ditutup",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(date);
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

function StatusBadge({ status }: { status: string }) {
  if (status === "pending") {
    return <Badge variant="neutral">Menunggu keputusan</Badge>;
  }

  if (status === "approved" || status === "opened") {
    return <Badge variant="success">{statusLabels[status] ?? status}</Badge>;
  }

  if (status === "rejected") {
    return <Badge variant="danger">Ditolak</Badge>;
  }

  return <Badge variant="neutral">{statusLabels[status] ?? status}</Badge>;
}

function SeverityBadge({ severity }: { severity: string | undefined }) {
  if (severity === "review_required") {
    return <Badge variant="danger">Perlu tinjauan</Badge>;
  }

  if (severity === "attention") {
    return <Badge variant="neutral">Perlu perhatian</Badge>;
  }

  if (severity === "light_note") {
    return <Badge variant="success">Catatan ringan</Badge>;
  }

  return <Badge variant="neutral">{severityLabels[severity ?? "normal"] ?? "Normal"}</Badge>;
}

async function approveAuditAccessAction(formData: FormData) {
  "use server";

  const requestId = String(formData.get("request_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!requestId) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_transaction_audit_access", {
    p_request_id: requestId,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/bumdes/dashboard/akses-audit");
  revalidatePath("/pengawas/dashboard/transparansi-transaksi");
}

async function rejectAuditAccessAction(formData: FormData) {
  "use server";

  const requestId = String(formData.get("request_id") ?? "").trim();
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();

  if (!requestId || !rejectionReason) return;

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_transaction_audit_access", {
    p_request_id: requestId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/bumdes/dashboard/akses-audit");
  revalidatePath("/pengawas/dashboard/transparansi-transaksi");
}

export default async function BumdesAksesAuditPage() {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: requestsData, error: requestsError } = await supabase
    .from("transaction_audit_access_requests")
    .select(
      [
        "id",
        "tenant_id",
        "unit_id",
        "transparency_note_id",
        "source_type",
        "source_id",
        "request_reason",
        "status",
        "approved_at",
        "rejected_at",
        "rejection_reason",
        "opened_at",
        "created_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const requests = ((requestsData ?? []) as unknown) as AuditAccessRequestRow[];

  const noteIds = requests.map((request) => request.transparency_note_id);
  const unitIds = Array.from(
    new Set(requests.map((request) => request.unit_id).filter(Boolean))
  ) as string[];

  const { data: notesData } =
    noteIds.length > 0
      ? await supabase
          .from("transaction_transparency_notes")
          .select(
            "id, transaction_date, recorded_at, days_difference, severity, operator_reason, review_status"
          )
          .in("id", noteIds)
      : { data: [] };

  const { data: unitsData } =
    unitIds.length > 0
      ? await supabase
          .from("business_units")
          .select("id, nama_unit")
          .in("id", unitIds)
      : { data: [] };

  const notes = ((notesData ?? []) as unknown) as TransparencyNoteRow[];
  const units = ((unitsData ?? []) as unknown) as UnitRow[];

  const noteById = new Map(notes.map((note) => [note.id, note]));
  const unitNameById = new Map(units.map((unit) => [unit.id, unit.nama_unit]));

  const pendingCount = requests.filter((request) => request.status === "pending").length;
  const approvedCount = requests.filter(
    (request) => request.status === "approved" || request.status === "opened"
  ).length;
  const rejectedCount = requests.filter((request) => request.status === "rejected").length;

  if (requestsError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Data permintaan akses audit gagal dimuat: {requestsError.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="BUMDes / Persetujuan Audit"
        title="Persetujuan Akses Audit"
        description="Direktur/Admin BUMDes menilai permintaan akses detail transaksi dari Pengawas. Detail transaksi hanya dibuka jika ada alasan audit investigatif yang dapat dipertanggungjawabkan."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Permintaan"
          value={String(requests.length)}
          description="Seluruh permintaan akses audit."
          icon={<FileSearch className="h-5 w-5" />}
        />

        <StatCard
          title="Menunggu"
          value={String(pendingCount)}
          description="Permintaan yang perlu keputusan."
          icon={<Clock3 className="h-5 w-5" />}
        />

        <StatCard
          title="Disetujui/Dibuka"
          value={String(approvedCount)}
          description="Akses yang telah diotorisasi."
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="Ditolak"
          value={String(rejectedCount)}
          description="Permintaan yang tidak disetujui."
          icon={<XCircle className="h-5 w-5" />}
        />
      </section>

      <Card>
        <CardHeader
          title="Daftar Permintaan Akses Audit"
          description="Tampilan ini hanya memuat metadata dan alasan audit. Detail transaksi tetap tidak dibuka di halaman approval."
          action={
            pendingCount > 0 ? (
              <Badge variant="danger">Perlu Keputusan</Badge>
            ) : (
              <Badge variant="success">Tidak Ada Pending</Badge>
            )
          }
        />

        <DataTable
          columns={[
            "Unit",
            "Catatan",
            "Tanggal",
            "Alasan",
            "Status",
            "Keputusan",
          ]}
          emptyText="Belum ada permintaan akses audit investigatif."
        >
          {requests.length > 0
            ? requests.map((request) => {
                const note = noteById.get(request.transparency_note_id);
                const unitName = request.unit_id
                  ? unitNameById.get(request.unit_id) ?? request.unit_id
                  : "Tenant";

                return (
                  <tr key={request.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-950">{unitName}</div>
                      <div className="mt-1 text-xs font-medium text-slate-500">
                        {sourceLabels[request.source_type] ?? request.source_type}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <SeverityBadge severity={note?.severity} />
                      <div className="mt-2 text-xs leading-5 text-slate-500">
                        Selisih: {note ? `${note.days_difference} hari` : "-"}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        Alasan operator: {note?.operator_reason || "-"}
                      </div>
                    </td>

                    <td className="px-4 py-4 text-xs font-medium text-slate-600">
                      <div>
                        Transaksi:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatDate(note?.transaction_date)}
                        </span>
                      </div>
                      <div className="mt-2">
                        Input:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatDateTime(note?.recorded_at)}
                        </span>
                      </div>
                      <div className="mt-2">
                        Diajukan:{" "}
                        <span className="font-semibold text-slate-800">
                          {formatDateTime(request.created_at)}
                        </span>
                      </div>
                    </td>

                    <td className="min-w-[260px] px-4 py-4 text-sm leading-6 text-slate-700">
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-emerald-800">
                        {request.request_reason}
                      </div>

                      {request.rejection_reason ? (
                        <div className="mt-2 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                          Ditolak: {request.rejection_reason}
                        </div>
                      ) : null}

                      {request.opened_at ? (
                        <div className="mt-2 rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-700">
                          Dibuka: {formatDateTime(request.opened_at)}
                        </div>
                      ) : null}
                    </td>

                    <td className="px-4 py-4">
                      <StatusBadge status={request.status} />
                    </td>

                    <td className="min-w-[260px] px-4 py-4">
                      {request.status === "pending" ? (
                        <div className="space-y-3">
                          <form action={approveAuditAccessAction}>
                            <input type="hidden" name="request_id" value={request.id} />

                            <input
                              name="notes"
                              placeholder="Catatan persetujuan opsional"
                              className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-400"
                            />

                            <button
                              type="submit"
                              className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                            >
                              Setujui Akses
                            </button>
                          </form>

                          <form action={rejectAuditAccessAction}>
                            <input type="hidden" name="request_id" value={request.id} />

                            <textarea
                              name="rejection_reason"
                              rows={2}
                              placeholder="Alasan penolakan"
                              className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-rose-400"
                              required
                            />

                            <button
                              type="submit"
                              className="inline-flex w-full items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              Tolak Akses
                            </button>
                          </form>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                          Keputusan sudah tercatat.
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            : null}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Prinsip Otorisasi"
          description="Persetujuan akses audit bukan berarti transaksi bermasalah. Persetujuan hanya membuka ruang audit investigatif secara terbatas, beralasan, dan tercatat dalam audit trail."
          action={<ShieldCheck className="h-5 w-5 text-emerald-600" />}
        />
      </Card>
    </div>
  );
}
