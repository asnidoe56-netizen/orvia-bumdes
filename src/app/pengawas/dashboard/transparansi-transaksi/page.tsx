export const dynamic = "force-dynamic";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type TransparencyNoteRow = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  source_type: string;
  source_id: string;
  transaction_date: string;
  recorded_at: string;
  days_difference: number | string;
  note_type: string;
  severity: string;
  operator_reason: string | null;
  review_status: string;
  created_at: string;
};

type UnitRow = {
  id: string;
  nama_unit: string;
};

type AuditAccessRow = {
  id: string;
  transparency_note_id: string;
  status: string;
  request_reason: string;
  approved_at: string | null;
  opened_at: string | null;
  created_at: string;
};

const severityStyles: Record<string, string> = {
  normal: "border-slate-200 bg-slate-50 text-slate-700",
  light_note: "border-emerald-200 bg-emerald-50 text-emerald-700",
  attention: "border-amber-200 bg-amber-50 text-amber-700",
  review_required: "border-rose-200 bg-rose-50 text-rose-700",
};

const severityLabels: Record<string, string> = {
  normal: "Normal",
  light_note: "Catatan ringan",
  attention: "Perlu perhatian",
  review_required: "Perlu tinjauan",
};

const statusStyles: Record<string, string> = {
  recorded: "border-slate-200 bg-slate-50 text-slate-700",
  reviewed: "border-sky-200 bg-sky-50 text-sky-700",
  clarification: "border-amber-200 bg-amber-50 text-amber-700",
  accepted: "border-emerald-200 bg-emerald-50 text-emerald-700",
  escalated: "border-rose-200 bg-rose-50 text-rose-700",
};

const statusLabels: Record<string, string> = {
  recorded: "Tercatat",
  reviewed: "Direview",
  clarification: "Perlu klarifikasi",
  accepted: "Diterima",
  escalated: "Dieskalasi",
};

const sourceLabels: Record<string, string> = {
  operational_expense: "Beban Operasional",
  revenue_receipt: "Terima Pendapatan",
  purchase_invoice: "Pembelian",
  sales_invoice: "Penjualan",
  cash_bank_transaction: "Kas/Bank",
};

const accessStatusStyles: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
  opened: "border-sky-200 bg-sky-50 text-sky-700",
  closed: "border-slate-200 bg-slate-50 text-slate-700",
};

const accessStatusLabels: Record<string, string> = {
  pending: "Menunggu otorisasi",
  approved: "Disetujui",
  rejected: "Ditolak",
  opened: "Akses dibuka",
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

function BadgeText({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

async function requestAuditAccessAction(formData: FormData) {
  "use server";

  const noteId = String(formData.get("note_id") ?? "").trim();
  const requestReason = String(formData.get("request_reason") ?? "").trim();

  if (!noteId || !requestReason) {
    return;
  }

  const supabase = await createClient();

  await supabase.rpc("request_transaction_audit_access", {
    p_transparency_note_id: noteId,
    p_request_reason: requestReason,
  });

  revalidatePath("/pengawas/dashboard/transparansi-transaksi");
}

async function openAuditAccessAction(formData: FormData) {
  "use server";

  const requestId = String(formData.get("request_id") ?? "").trim();

  if (!requestId) {
    return;
  }

  const supabase = await createClient();

  await supabase.rpc("open_transaction_audit_access", {
    p_request_id: requestId,
  });

  revalidatePath("/pengawas/dashboard/transparansi-transaksi");
}

export default async function TransparansiTransaksiPage() {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: notesData, error: notesError } = await supabase
    .from("transaction_transparency_notes")
    .select(
      [
        "id",
        "tenant_id",
        "unit_id",
        "source_type",
        "source_id",
        "transaction_date",
        "recorded_at",
        "days_difference",
        "note_type",
        "severity",
        "operator_reason",
        "review_status",
        "created_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const notes = ((notesData ?? []) as unknown) as TransparencyNoteRow[];

  const unitIds = Array.from(
    new Set(notes.map((note) => note.unit_id).filter(Boolean))
  ) as string[];

  const { data: unitsData } =
    unitIds.length > 0
      ? await supabase
          .from("business_units")
          .select("id, nama_unit")
          .in("id", unitIds)
      : { data: [] };

  const units = ((unitsData ?? []) as unknown) as UnitRow[];
  const unitNameById = new Map(units.map((unit) => [unit.id, unit.nama_unit]));

  const noteIds = notes.map((note) => note.id);

  const { data: accessData } =
    noteIds.length > 0
      ? await supabase
          .from("transaction_audit_access_requests")
          .select(
            "id, transparency_note_id, status, request_reason, approved_at, opened_at, created_at"
          )
          .in("transparency_note_id", noteIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const accessRows = ((accessData ?? []) as unknown) as AuditAccessRow[];
  const latestAccessByNoteId = new Map<string, AuditAccessRow>();

  for (const access of accessRows) {
    if (!latestAccessByNoteId.has(access.transparency_note_id)) {
      latestAccessByNoteId.set(access.transparency_note_id, access);
    }
  }

  const totalCount = notes.length;
  const acceptedCount = notes.filter(
    (note) => note.review_status === "accepted"
  ).length;
  const clarificationCount = notes.filter(
    (note) => note.review_status === "clarification"
  ).length;
  const reviewRequiredCount = notes.filter(
    (note) => note.severity === "review_required"
  ).length;

  if (notesError) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
          Data transparansi transaksi gagal dimuat: {notesError.message}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <Link
            href="/pengawas/dashboard"
            className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Dashboard Pengawas
          </Link>

          <div className="mt-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">
              Catatan Transparansi Administrasi
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Transparansi Transaksi
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
              Halaman ini menampilkan metadata terbatas atas catatan transparansi
              transaksi. Pengawas tidak melihat detail transaksi penuh secara
              default. Detail hanya dapat dibuka melalui permintaan akses audit
              investigatif yang tercatat dan beralasan.
            </p>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ClipboardList className="h-6 w-6 text-slate-700" />
            <p className="mt-3 text-sm text-slate-500">Catatan</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {totalCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            <p className="mt-3 text-sm text-slate-500">Diterima</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {acceptedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <MessageSquareText className="h-6 w-6 text-amber-600" />
            <p className="mt-3 text-sm text-slate-500">Perlu klarifikasi</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {clarificationCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <p className="mt-3 text-sm text-slate-500">Perlu tinjauan</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {reviewRequiredCount}
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5 sm:p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Metadata Catatan Transparansi
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nominal, akun, kas/bank, jurnal, dan bukti transaksi tidak
              ditampilkan pada mode default. Akses detail harus melalui proses
              audit investigatif.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Unit</th>
                  <th className="px-5 py-3">Jenis Catatan</th>
                  <th className="px-5 py-3">Tanggal Transaksi</th>
                  <th className="px-5 py-3">Tanggal Input</th>
                  <th className="px-5 py-3">Selisih</th>
                  <th className="px-5 py-3">Kategori</th>
                  <th className="px-5 py-3">Status Review</th>
                  <th className="px-5 py-3">Alasan Operator</th>
                  <th className="px-5 py-3">Akses Audit</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {notes.length > 0 ? (
                  notes.map((note) => {
                    const access = latestAccessByNoteId.get(note.id);

                    return (
                      <tr key={note.id} className="bg-white align-top">
                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                          {note.unit_id
                            ? unitNameById.get(note.unit_id) ?? note.unit_id
                            : "Tenant"}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {sourceLabels[note.source_type] ?? note.source_type}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDate(note.transaction_date)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {formatDateTime(note.recorded_at)}
                        </td>

                        <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                          {note.days_difference} hari
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <BadgeText
                            label={severityLabels[note.severity] ?? note.severity}
                            className={
                              severityStyles[note.severity] ??
                              "border-slate-200 bg-slate-50 text-slate-700"
                            }
                          />
                        </td>

                        <td className="whitespace-nowrap px-5 py-4">
                          <BadgeText
                            label={
                              statusLabels[note.review_status] ??
                              note.review_status
                            }
                            className={
                              statusStyles[note.review_status] ??
                              "border-slate-200 bg-slate-50 text-slate-700"
                            }
                          />
                        </td>

                        <td className="min-w-[260px] px-5 py-4 text-slate-600">
                          {note.operator_reason || "-"}
                        </td>

                        <td className="min-w-[300px] px-5 py-4">
                          {access ? (
                            <div className="space-y-3">
                              <BadgeText
                                label={
                                  accessStatusLabels[access.status] ??
                                  access.status
                                }
                                className={
                                  accessStatusStyles[access.status] ??
                                  "border-slate-200 bg-slate-50 text-slate-700"
                                }
                              />

                              <p className="text-xs leading-5 text-slate-500">
                                Alasan audit: {access.request_reason}
                              </p>

                              {access.status === "approved" ? (
                                <form action={openAuditAccessAction}>
                                  <input
                                    type="hidden"
                                    name="request_id"
                                    value={access.id}
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800"
                                  >
                                    Catat pembukaan akses
                                  </button>
                                </form>
                              ) : null}
                            </div>
                          ) : (
                            <form
                              action={requestAuditAccessAction}
                              className="space-y-2"
                            >
                              <input
                                type="hidden"
                                name="note_id"
                                value={note.id}
                              />

                              <textarea
                                name="request_reason"
                                rows={2}
                                placeholder="Alasan audit investigatif"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-slate-400"
                                required
                              />

                              <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                              >
                                <FileSearch className="h-4 w-4" />
                                Minta Akses Audit
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-5 py-10 text-center text-sm text-slate-500"
                    >
                      Belum ada catatan transparansi transaksi dalam scope
                      pengawas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 sm:p-6">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <h3 className="font-bold text-emerald-900">
                Prinsip Kewenangan Pengawas
              </h3>
              <p className="mt-2 text-sm leading-6 text-emerald-800">
                Catatan transparansi bukan otomatis pelanggaran. Pengawas hanya
                melihat metadata terbatas. Detail transaksi dibuka hanya jika ada
                dasar audit investigatif, disertai alasan, dan tercatat di audit
                timeline.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
