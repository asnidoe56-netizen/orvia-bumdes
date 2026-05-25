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

type SalesFlowAudit = {
  sales_invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  payment_type: string;
  invoice_status: string;
  customer_code: string | null;
  customer_name: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  line_count: number;
  total_quantity: number | string;
  total_cogs: number | string;
  movement_count: number;
  total_qty_out: number | string;
  total_inventory_cost: number | string;
  cash_tx_count: number;
  cash_transaction_type: string | null;
  cash_tx_status: string | null;
  journal_status: string | null;
  total_debit: number | string;
  total_credit: number | string;
  journal_diff: number | string;
  has_cash_debit: boolean;
  has_sales_credit: boolean;
  has_cogs_debit: boolean;
  has_inventory_credit: boolean;
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

function ResultBadge({ isPass }: { isPass: boolean }) {
  return (
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
      {isPass ? "Lengkap" : "Perlu dicek"}
    </span>
  );
}

function StepCard({
  label,
  detail,
  icon: Icon,
  ok,
}: {
  label: string;
  detail: string;
  icon: typeof ReceiptText;
  ok: boolean;
}) {
  return (
    <div
      className={
        ok
          ? "rounded-2xl border border-emerald-100 bg-emerald-50 p-3"
          : "rounded-2xl border border-amber-100 bg-amber-50 p-3"
      }
    >
      <div className="flex items-center gap-2">
        <Icon
          className={
            ok ? "h-4 w-4 text-emerald-700" : "h-4 w-4 text-amber-700"
          }
        />
        <p
          className={
            ok
              ? "text-sm font-bold text-emerald-900"
              : "text-sm font-bold text-amber-900"
          }
        >
          {label}
        </p>
      </div>

      <p
        className={
          ok
            ? "mt-1 text-xs leading-5 text-emerald-700"
            : "mt-1 text-xs leading-5 text-amber-700"
        }
      >
        {detail}
      </p>
    </div>
  );
}

function NotesBox({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;

  return (
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
  );
}

function PurchaseAuditCard({ audit }: { audit: PurchaseFlowAudit }) {
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

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-950">
              {audit.invoice_no}
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Pembelian {formatPaymentType(audit.payment_type)}
            </span>

            <ResultBadge isPass={isPass} />
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
        <StepCard label="Transaksi" detail={getStepState(hasInvoice)} icon={ReceiptText} ok={hasInvoice} />
        <StepCard label="Barang" detail={`${audit.line_count} baris, total ${Number(audit.total_quantity ?? 0)} barang`} icon={ShoppingBag} ok={hasItems} />
        <StepCard label="Stok" detail={getStepState(hasStock)} icon={PackageCheck} ok={hasStock} />
        <StepCard label={audit.payment_type === "cash" ? "Kas" : "Utang"} detail={audit.payment_type === "cash" ? `${audit.cash_tx_count} pembayaran` : "Tercatat sebagai pembelian kredit"} icon={CircleDollarSign} ok={hasCashOrDebt} />
        <StepCard label="Pencatatan" detail={Number(audit.journal_diff ?? 0) === 0 ? "Seimbang" : "Tidak seimbang"} icon={ClipboardCheck} ok={hasBalancedRecord} />
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

      {!isPass ? <NotesBox notes={notes} /> : null}
    </article>
  );
}

function SalesAuditCard({ audit }: { audit: SalesFlowAudit }) {
  const isPass = audit.audit_result === "PASS";
  const notes = audit.audit_notes ?? [];

  const hasInvoice = audit.invoice_status === "posted";
  const hasItems = Number(audit.line_count ?? 0) > 0;
  const hasStockOut =
    Number(audit.movement_count ?? 0) > 0 &&
    Number(audit.total_qty_out ?? 0) === Number(audit.total_quantity ?? 0);
  const hasCashReceipt =
    audit.cash_transaction_type === "receipt" &&
    audit.cash_tx_status === "posted" &&
    Number(audit.cash_tx_count ?? 0) > 0;
  const hasBalancedRecord =
    audit.journal_status === "posted" && Number(audit.journal_diff ?? 0) === 0;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-950">
              {audit.invoice_no}
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Penjualan {formatPaymentType(audit.payment_type)}
            </span>

            <ResultBadge isPass={isPass} />
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {formatDate(audit.invoice_date)} - Pelanggan:{" "}
            {audit.customer_code && audit.customer_name
              ? `${audit.customer_code} - ${audit.customer_name}`
              : "Umum / tanpa pelanggan"}
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
        <StepCard label="Transaksi" detail={getStepState(hasInvoice)} icon={ReceiptText} ok={hasInvoice} />
        <StepCard label="Barang" detail={`${audit.line_count} baris, total ${Number(audit.total_quantity ?? 0)} barang`} icon={ShoppingBag} ok={hasItems} />
        <StepCard label="Stok Keluar" detail={hasStockOut ? "sales_delivery lengkap" : "Belum lengkap"} icon={PackageCheck} ok={hasStockOut} />
        <StepCard label="Kas Masuk" detail={hasCashReceipt ? `${audit.cash_tx_count} receipt posted` : "Belum lengkap"} icon={CircleDollarSign} ok={hasCashReceipt} />
        <StepCard label="Pencatatan" detail={Number(audit.journal_diff ?? 0) === 0 ? "Seimbang" : "Tidak seimbang"} icon={ClipboardCheck} ok={hasBalancedRecord} />
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Stok / HPP
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            Keluar {Number(audit.total_qty_out ?? 0)} barang - HPP {formatRupiah(audit.total_cogs)}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Kas Masuk
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            Receipt {formatRupiah(audit.paid_amount)}
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

      {!isPass ? <NotesBox notes={notes} /> : null}
    </article>
  );
}

export default async function CekAlurTransaksiPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [purchaseResult, salesResult] = await Promise.all([
    supabase
      .from("v_purchase_invoice_flow_audit")
      .select(
        "purchase_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, supplier_code, supplier_name, total_amount, paid_amount, line_count, total_quantity, movement_count, journal_status, total_debit, total_credit, journal_diff, cash_tx_count, audit_result, audit_notes, created_at"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("v_sales_invoice_flow_audit")
      .select(
        "sales_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, customer_code, customer_name, total_amount, paid_amount, line_count, total_quantity, total_cogs, movement_count, total_qty_out, total_inventory_cost, cash_tx_count, cash_transaction_type, cash_tx_status, journal_status, total_debit, total_credit, journal_diff, has_cash_debit, has_sales_credit, has_cogs_debit, has_inventory_credit, audit_result, audit_notes, created_at"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (purchaseResult.error) {
    throw new Error(purchaseResult.error.message);
  }

  if (salesResult.error) {
    throw new Error(salesResult.error.message);
  }

  const purchaseAudits = (purchaseResult.data ?? []) as PurchaseFlowAudit[];
  const salesAudits = (salesResult.data ?? []) as SalesFlowAudit[];
  const allAudits = [...purchaseAudits, ...salesAudits];

  const passCount = allAudits.filter((audit) => audit.audit_result === "PASS").length;
  const checkCount = allAudits.filter((audit) => audit.audit_result !== "PASS").length;

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
          <p className="mt-2 text-2xl font-bold text-slate-950">{allAudits.length}</p>
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
        <div>
          <h2 className="text-base font-bold text-slate-950">Penjualan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mengecek penjualan tunai: kas masuk, stok keluar, HPP, pendapatan, dan jurnal.
          </p>
        </div>

        {salesAudits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold text-slate-950">
              Belum ada transaksi penjualan
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Setelah unit mencatat penjualan, hasil pengecekan alurnya akan muncul di sini.
            </p>
          </div>
        ) : (
          salesAudits.map((audit) => (
            <SalesAuditCard key={audit.sales_invoice_id} audit={audit} />
          ))
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Pembelian</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mengecek pembelian tunai/kredit: barang masuk, kas atau utang, dan jurnal.
          </p>
        </div>

        {purchaseAudits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <ReceiptText className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold text-slate-950">
              Belum ada transaksi pembelian
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Setelah unit mencatat pembelian, hasil pengecekan alurnya akan muncul di sini.
            </p>
          </div>
        ) : (
          purchaseAudits.map((audit) => (
            <PurchaseAuditCard key={audit.purchase_invoice_id} audit={audit} />
          ))
        )}
      </section>
    </div>
  );
}
