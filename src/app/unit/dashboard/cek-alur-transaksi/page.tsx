import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  PackageCheck,
  ReceiptText,
  SearchCheck,
  ShoppingBag,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type PurchaseFlowAudit = {
  purchase_invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  payment_type: string;
  invoice_status: string;
  supplier_code: string | null;
  supplier_name: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  line_count: number;
  total_quantity: number | string;
  movement_count: number;
  journal_status: string | null;
  total_debit: number | string;
  total_credit: number | string;
  journal_diff: number | string;
  cash_tx_count: number;
  audit_result: string;
  audit_notes: string[] | null;
  created_at: string;
};

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatPaymentType(value: string) {
  if (value === "cash") return "Tunai";
  if (value === "credit") return "Kredit";
  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getResultLabel(value: string) {
  if (value === "PASS") return "Lengkap";
  return "Perlu dicek";
}

function getStepState(ok: boolean) {
  return ok ? "Lengkap" : "Belum lengkap";
}

export default async function CekAlurTransaksiPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_purchase_invoice_flow_audit")
    .select(
      "purchase_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, supplier_code, supplier_name, total_amount, paid_amount, line_count, total_quantity, movement_count, journal_status, total_debit, total_credit, journal_diff, cash_tx_count, audit_result, audit_notes, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    throw new Error(error.message);
  }

  const audits = (data ?? []) as PurchaseFlowAudit[];
  const passCount = audits.filter((audit) => audit.audit_result === "PASS").length;
  const checkCount = audits.filter((audit) => audit.audit_result !== "PASS").length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Cek Alur Transaksi
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Cek Alur Transaksi
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Pantau apakah transaksi sudah lengkap diproses oleh engine database:
              barang, stok, kas atau utang, dan pencatatan keuangan.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <SearchCheck className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Transaksi Dicek</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{audits.length}</p>
        </div>

        <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-emerald-700">Lengkap</p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">{passCount}</p>
        </div>

        <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-700">Perlu Dicek</p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{checkCount}</p>
        </div>
      </section>

      <section className="space-y-4">
        {audits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-3 text-lg font-bold text-slate-950">
              Belum ada transaksi pembelian
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Setelah unit mencatat pembelian, hasil pengecekan alurnya akan muncul di sini.
            </p>
          </div>
        ) : (
          audits.map((audit) => {
            const isPass = audit.audit_result === "PASS";
            const notes = audit.audit_notes ?? [];

            const hasInvoice = audit.invoice_status === "posted";
            const hasItems = Number(audit.line_count ?? 0) > 0;
            const hasStock = Number(audit.movement_count ?? 0) > 0;
            const hasCashOrDebt =
              audit.payment_type === "cash"
                ? Number(audit.cash_tx_count ?? 0) > 0
                : Number(audit.paid_amount ?? 0) === 0;
            const hasBalancedRecord =
              audit.journal_status === "posted" && Number(audit.journal_diff ?? 0) === 0;

            const steps = [
              {
                label: "Transaksi",
                detail: getStepState(hasInvoice),
                icon: ReceiptText,
                ok: hasInvoice,
              },
              {
                label: "Barang",
                detail: `${audit.line_count} baris, total ${Number(audit.total_quantity ?? 0)} barang`,
                icon: ShoppingBag,
                ok: hasItems,
              },
              {
                label: "Stok",
                detail: getStepState(hasStock),
                icon: PackageCheck,
                ok: hasStock,
              },
              {
                label: audit.payment_type === "cash" ? "Kas" : "Utang",
                detail:
                  audit.payment_type === "cash"
                    ? `${audit.cash_tx_count} pembayaran`
                    : "Tercatat sebagai pembelian kredit",
                icon: CircleDollarSign,
                ok: hasCashOrDebt,
              },
              {
                label: "Pencatatan",
                detail: Number(audit.journal_diff ?? 0) === 0 ? "Seimbang" : "Tidak seimbang",
                icon: ClipboardCheck,
                ok: hasBalancedRecord,
              },
            ];

            return (
              <article
                key={audit.purchase_invoice_id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-950">
                        {audit.invoice_no}
                      </h2>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                        {formatPaymentType(audit.payment_type)}
                      </span>

                      <span
                        className={
                          isPass
                            ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"
                        }
                      >
                        {isPass ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {getResultLabel(audit.audit_result)}
                      </span>
                    </div>

                    <p className="mt-1 text-sm text-slate-600">
                      {formatDate(audit.invoice_date)} - Supplier:{" "}
                      {audit.supplier_code && audit.supplier_name
                        ? `${audit.supplier_code} - ${audit.supplier_name}`
                        : "Tidak ada supplier"}
                    </p>
                  </div>

                  <div className="text-left lg:text-right">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Nilai Transaksi
                    </p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      {formatRupiah(audit.total_amount)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  {steps.map((step) => {
                    const Icon = step.icon;

                    return (
                      <div
                        key={step.label}
                        className={
                          step.ok
                            ? "rounded-2xl border border-emerald-100 bg-emerald-50 p-3"
                            : "rounded-2xl border border-amber-100 bg-amber-50 p-3"
                        }
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            className={
                              step.ok
                                ? "h-4 w-4 text-emerald-700"
                                : "h-4 w-4 text-amber-700"
                            }
                          />
                          <p
                            className={
                              step.ok
                                ? "text-sm font-bold text-emerald-900"
                                : "text-sm font-bold text-amber-900"
                            }
                          >
                            {step.label}
                          </p>
                        </div>

                        <p
                          className={
                            step.ok
                              ? "mt-1 text-xs leading-5 text-emerald-700"
                              : "mt-1 text-xs leading-5 text-amber-700"
                          }
                        >
                          {step.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Barang / Stok
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {Number(audit.total_quantity ?? 0)} barang - {formatRupiah(audit.total_amount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Kas / Utang
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {audit.payment_type === "cash"
                        ? `Kas keluar ${formatRupiah(audit.paid_amount)}`
                        : `Utang tercatat ${formatRupiah(audit.total_amount)}`}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Pencatatan Keuangan
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      Debit {formatRupiah(audit.total_debit)} - Kredit {formatRupiah(audit.total_credit)}
                    </p>
                  </div>
                </div>

                {!isPass && notes.length > 0 ? (
                  <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-900">
                      Catatan pemeriksaan
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-800">
                      {notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}