export const dynamic = "force-dynamic";

import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  approveJournalCorrectionAction,
  rejectJournalCorrectionAction,
} from "../actions";

type AnyRow = Record<string, unknown>;

function asText(value: unknown, fallback = "-") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function asNumber(value: unknown) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: unknown) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function formatDateTime(value: unknown) {
  if (!value) return "-";

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: unknown) {
  const value = asText(status);
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_approval: "Menunggu Persetujuan",
    approved: "Disetujui",
    rejected: "Ditolak",
    posted: "Sudah Diposting",
    cancelled: "Dibatalkan",
  };

  return labels[value] ?? value;
}

function StatusBadge({ status }: { status: unknown }) {
  const value = asText(status);

  if (value === "pending_approval") {
    return <Badge variant="warning">Menunggu Persetujuan</Badge>;
  }

  if (value === "approved" || value === "posted") {
    return <Badge variant="success">{statusLabel(value)}</Badge>;
  }

  if (value === "rejected" || value === "cancelled") {
    return <Badge variant="danger">{statusLabel(value)}</Badge>;
  }

  return <Badge variant="neutral">{statusLabel(value)}</Badge>;
}

function journalRoleLabel(value: unknown) {
  const role = asText(value);
  const labels: Record<string, string> = {
    original: "Transaksi Lama",
    reversal: "Pembatalan Otomatis",
    corrected: "Transaksi Pengganti",
  };

  return labels[role] ?? role;
}

export default async function PengawasKoreksiTransaksiDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: correctionId } = await params;
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: correctionData, error: correctionError } = await supabase
    .from("v_journal_correction_flow")
    .select("*")
    .eq("correction_id", correctionId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (correctionError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca detail koreksi transaksi: {correctionError.message}
      </div>
    );
  }

  if (!correctionData) {
    notFound();
  }

  const correction = correctionData as unknown as AnyRow;

  const { data: lineData } = await supabase
    .from("v_journal_correction_line_comparison")
    .select("*")
    .eq("correction_id", correctionId)
    .order("journal_role_order", { ascending: true })
    .order("line_no", { ascending: true });

  const { data: timelineData } = await supabase
    .from("v_journal_correction_governance_timeline")
    .select("*")
    .eq("correction_id", correctionId)
    .order("timeline_order", { ascending: true })
    .order("event_at", { ascending: true });

  const lineRows = ((lineData ?? []) as unknown) as AnyRow[];
  const timelineRows = ((timelineData ?? []) as unknown) as AnyRow[];

  const isPendingApproval =
    asText(correction.correction_status) === "pending_approval";

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/pengawas/dashboard/koreksi-transaksi"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar koreksi
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Pengawas / Detail Koreksi Transaksi
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {asText(correction.correction_no)}
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Review alasan koreksi, transaksi lama, transaksi pengganti, dan
              jejak governance sebelum menyetujui atau menolak koreksi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={correction.correction_status} />
            <Badge
              variant={asText(correction.audit_result) === "PASS" ? "success" : "neutral"}
            >
              Audit: {asText(correction.audit_result)}
            </Badge>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Unit Terkait
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {asText(correction.nama_unit)}
              </p>
              <p className="text-xs text-slate-500">
                {asText(correction.kode_unit)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Diajukan Oleh
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {asText(correction.requested_by_name)}
              </p>
              <p className="text-xs text-slate-500">
                {formatDateTime(correction.requested_at)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Transaksi Lama
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {asText(correction.original_journal_no)}
              </p>
              <p className="text-xs text-slate-500">
                {formatRupiah(correction.original_total_debit)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Transaksi Pengganti
              </p>
              <p className="mt-1 font-bold text-slate-950">
                {asText(correction.corrected_journal_no)}
              </p>
              <p className="text-xs text-slate-500">
                {asText(correction.flow_status)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader
          title="Alasan Koreksi"
          description="Alasan ini menjadi dasar Pengawas untuk menyetujui atau menolak koreksi."
          action={<StatusBadge status={correction.correction_status} />}
        />

        <div className="px-5 pb-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {asText(correction.reason)}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Perbandingan Transaksi"
          description="Transaksi lama, pembatalan otomatis, dan transaksi pengganti ditampilkan untuk audit pengawas."
          action={<Badge variant="neutral">{lineRows.length} baris</Badge>}
        />

        <DataTable
          columns={[
            "Jenis",
            "Nomor Jurnal",
            "Akun",
            "Keterangan",
            "Debit",
            "Kredit",
          ]}
          emptyText="Belum ada detail baris transaksi untuk koreksi ini."
        >
          {lineRows.length > 0
            ? lineRows.map((line, index) => (
                <tr
                  key={`${asText(line.journal_role)}-${asText(line.line_id)}-${index}`}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">
                      {journalRoleLabel(line.journal_role)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {asText(line.journal_status)}
                    </div>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {asText(line.journal_no)}
                  </td>

                  <td className="px-4 py-4">
                    <div className="font-semibold text-slate-800">
                      {asText(line.account_code)} · {asText(line.account_name)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {asText(line.account_type)}
                    </div>
                  </td>

                  <td className="px-4 py-4 text-slate-600">
                    {asText(line.line_description)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(line.debit)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {formatRupiah(line.credit)}
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader
            title="Timeline Governance"
            description="Jejak proses koreksi dari draft sampai keputusan pengawas."
            action={<Badge variant="neutral">{timelineRows.length} event</Badge>}
          />

          <div className="space-y-3 px-5 pb-5">
            {timelineRows.length > 0 ? (
              timelineRows.map((item, index) => (
                <div
                  key={`${asText(item.timeline_event)}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">
                        {asText(item.timeline_event)}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {asText(item.note)}
                      </p>
                    </div>

                    <div className="text-left text-xs text-slate-500 sm:text-right">
                      <p className="font-semibold">
                        {asText(item.actor_name)}
                      </p>
                      <p>{formatDateTime(item.event_at)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">
                Belum ada timeline governance.
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Keputusan Pengawas"
            description="Setujui bila koreksi sudah layak, atau tolak dengan alasan yang jelas."
            action={
              isPendingApproval ? (
                <Badge variant="warning">Menunggu Keputusan</Badge>
              ) : (
                <StatusBadge status={correction.correction_status} />
              )
            }
          />

          <div className="space-y-4 px-5 pb-5">
            {isPendingApproval ? (
              <>
                <form action={approveJournalCorrectionAction}>
                  <input
                    type="hidden"
                    name="correction_id"
                    value={correctionId}
                  />
                  <button
                    type="submit"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Setujui Koreksi
                  </button>
                </form>

                <form
                  action={rejectJournalCorrectionAction}
                  className="rounded-2xl border border-red-100 bg-red-50 p-4"
                >
                  <input
                    type="hidden"
                    name="correction_id"
                    value={correctionId}
                  />

                  <label
                    htmlFor="rejection_reason"
                    className="text-sm font-bold text-red-900"
                  >
                    Alasan Penolakan
                  </label>

                  <textarea
                    id="rejection_reason"
                    name="rejection_reason"
                    rows={4}
                    required
                    placeholder="Tuliskan alasan penolakan koreksi..."
                    className="mt-2 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-100"
                  />

                  <button
                    type="submit"
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                  >
                    <XCircle className="h-4 w-4" />
                    Tolak Koreksi
                  </button>
                </form>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                Koreksi ini sudah berada pada status{" "}
                <span className="font-bold text-slate-950">
                  {statusLabel(correction.correction_status)}
                </span>
                . Tombol keputusan hanya tersedia saat status masih menunggu
                persetujuan pengawas.
              </div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}