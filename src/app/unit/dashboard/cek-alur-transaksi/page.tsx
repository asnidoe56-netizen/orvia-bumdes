import {
  AlertTriangle,
  Boxes,
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Landmark,
  PackageCheck,
  ReceiptText,
  SearchCheck,
  ShoppingBag,
  TrendingDown,
  WalletCards,
  type LucideIcon,
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
  has_receivable_debit: boolean;
  has_sales_credit: boolean;
  has_cogs_debit: boolean;
  has_inventory_credit: boolean;
  audit_result: string;
  audit_notes: string[] | null;
  created_at: string;
};

type CapitalExpenditureFlowAudit = {
  capital_expenditure_id: string;
  transaction_no: string;
  transaction_date: string;
  payment_type: string;
  due_date: string | null;
  status: string;
  total_amount: number | string;
  paid_amount: number | string;
  category_code: string | null;
  category_name: string | null;
  asset_account_code: string | null;
  asset_account_name: string | null;
  liability_account_code: string | null;
  liability_account_name: string | null;
  journal_no: string | null;
  journal_status: string | null;
  cash_bank_transaction_no: string | null;
  cash_bank_transaction_type: string | null;
  cash_bank_transaction_status: string | null;
  line_count: number;
  fixed_asset_count: number;
  total_debit: number | string;
  total_credit: number | string;
  has_asset_debit: boolean;
  has_cash_credit: boolean;
  has_liability_credit: boolean;
  cash_bank_transaction_count: number;
  audit_result: string;
  audit_notes: string[] | null;
  created_at: string;
};

type FixedAssetDepreciationFlowAudit = {
  depreciation_id: string;
  fixed_asset_id: string;
  asset_code: string;
  asset_name: string;
  acquisition_cost: number | string;
  residual_value: number | string;
  useful_life_months: number;
  asset_status: string;
  period_year: number;
  period_month: number;
  depreciation_date: string;
  depreciation_amount: number | string;
  accumulated_depreciation_amount: number | string;
  book_value_after: number | string;
  depreciation_status: string;
  journal_no: string | null;
  journal_status: string | null;
  depreciation_expense_account_code: string | null;
  depreciation_expense_account_name: string | null;
  accumulated_depreciation_account_code: string | null;
  accumulated_depreciation_account_name: string | null;
  total_debit: number | string;
  total_credit: number | string;
  journal_diff: number | string;
  has_expense_debit: boolean;
  has_accumulated_credit: boolean;
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

function formatPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
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
  icon: LucideIcon;
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
  const isCreditSale = audit.payment_type === "credit";
  const hasReceivable = Boolean(audit.has_receivable_debit);
  const hasCashReceipt = isCreditSale
    ? hasReceivable && Number(audit.cash_tx_count ?? 0) === 0
    : audit.cash_transaction_type === "receipt" &&
      audit.cash_tx_status === "posted" &&
      Number(audit.cash_tx_count ?? 0) > 0;
  const cashOrReceivableLabel = isCreditSale ? "Piutang" : "Kas Masuk";
  const cashOrReceivableDetail = isCreditSale
    ? hasCashReceipt
      ? "Piutang penjualan kredit terbentuk"
      : "Piutang belum lengkap"
    : hasCashReceipt
      ? `${audit.cash_tx_count} receipt posted`
      : "Belum lengkap";
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
        <StepCard label={cashOrReceivableLabel} detail={cashOrReceivableDetail} icon={CircleDollarSign} ok={hasCashReceipt} />
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
            {isCreditSale ? "Piutang" : "Kas Masuk"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {isCreditSale
              ? `Piutang ${formatRupiah(audit.total_amount)}`
              : `Receipt ${formatRupiah(audit.paid_amount)}`}
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

function CapitalExpenditureAuditCard({
  audit,
}: {
  audit: CapitalExpenditureFlowAudit;
}) {
  const isPass = audit.audit_result === "PASS";
  const notes = audit.audit_notes ?? [];
  const isCredit = audit.payment_type === "credit";
  const journalDiff =
    Number(audit.total_debit ?? 0) - Number(audit.total_credit ?? 0);

  const hasTransaction = audit.status === "posted";
  const hasAsset = Number(audit.fixed_asset_count ?? 0) > 0 && audit.has_asset_debit;
  const hasPaymentOrLiability = isCredit
    ? audit.has_liability_credit && Number(audit.paid_amount ?? 0) === 0
    : audit.has_cash_credit &&
      Number(audit.cash_bank_transaction_count ?? 0) > 0 &&
      audit.cash_bank_transaction_status === "posted";
  const hasJournal =
    audit.journal_status === "posted" && Math.abs(journalDiff) < 0.01;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-950">
              {audit.transaction_no}
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Belanja Aset {formatPaymentType(audit.payment_type)}
            </span>

            <ResultBadge isPass={isPass} />
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {formatDate(audit.transaction_date)} - Kategori:{" "}
            {audit.category_code && audit.category_name
              ? `${audit.category_code} - ${audit.category_name}`
              : "Tidak ada kategori"}
          </p>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nilai Belanja Aset
          </p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            {formatRupiah(audit.total_amount)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <StepCard label="Transaksi" detail={getStepState(hasTransaction)} icon={ReceiptText} ok={hasTransaction} />
        <StepCard label="Detail Aset" detail={`${audit.line_count} baris detail`} icon={Boxes} ok={Number(audit.line_count ?? 0) > 0} />
        <StepCard label="Aset Terbentuk" detail={`${audit.fixed_asset_count} aset tetap`} icon={Landmark} ok={hasAsset} />
        <StepCard label={isCredit ? "Utang" : "Kas Keluar"} detail={isCredit ? "Utang Belanja Modal tercatat" : `${audit.cash_bank_transaction_count} payment posted`} icon={CircleDollarSign} ok={hasPaymentOrLiability} />
        <StepCard label="Pencatatan" detail={Math.abs(journalDiff) < 0.01 ? "Seimbang" : "Tidak seimbang"} icon={ClipboardCheck} ok={hasJournal} />
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Akun Aset
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {audit.asset_account_code && audit.asset_account_name
              ? `${audit.asset_account_code} - ${audit.asset_account_name}`
              : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {isCredit ? "Utang" : "Kas Keluar"}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {isCredit
              ? `${audit.liability_account_code ?? "-"} - ${audit.liability_account_name ?? "Utang Belanja Modal"}`
              : `Payment ${formatRupiah(audit.paid_amount)}`}
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

function FixedAssetDepreciationAuditCard({
  audit,
}: {
  audit: FixedAssetDepreciationFlowAudit;
}) {
  const isPass = audit.audit_result === "PASS";
  const notes = audit.audit_notes ?? [];
  const hasDepreciation = audit.depreciation_status === "posted";
  const hasExpense = audit.has_expense_debit;
  const hasAccumulated = audit.has_accumulated_credit;
  const hasBookValue =
    Number(audit.book_value_after ?? 0) >= Number(audit.residual_value ?? 0);
  const hasJournal =
    audit.journal_status === "posted" && Number(audit.journal_diff ?? 0) === 0;

  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-slate-950">
              {audit.asset_name}
            </h2>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
              Penyusutan {formatPeriod(audit.period_year, audit.period_month)}
            </span>

            <ResultBadge isPass={isPass} />
          </div>

          <p className="mt-1 text-sm text-slate-600">
            {formatDate(audit.depreciation_date)} - Kode aset:{" "}
            {audit.asset_code}
          </p>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Nilai Penyusutan
          </p>
          <p className="mt-1 text-lg font-bold text-slate-950">
            {formatRupiah(audit.depreciation_amount)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-5">
        <StepCard label="Penyusutan" detail={getStepState(hasDepreciation)} icon={TrendingDown} ok={hasDepreciation} />
        <StepCard label="Beban" detail={`${audit.depreciation_expense_account_code ?? "-"} debit`} icon={Calculator} ok={hasExpense} />
        <StepCard label="Akumulasi" detail={`${audit.accumulated_depreciation_account_code ?? "-"} kredit`} icon={WalletCards} ok={hasAccumulated} />
        <StepCard label="Nilai Buku" detail={formatRupiah(audit.book_value_after)} icon={Landmark} ok={hasBookValue} />
        <StepCard label="Pencatatan" detail={Number(audit.journal_diff ?? 0) === 0 ? "Seimbang" : "Tidak seimbang"} icon={ClipboardCheck} ok={hasJournal} />
      </div>

      <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Beban Penyusutan
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {audit.depreciation_expense_account_code ?? "-"} -{" "}
            {audit.depreciation_expense_account_name ?? "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Akumulasi Penyusutan
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {audit.accumulated_depreciation_account_code ?? "-"} -{" "}
            {audit.accumulated_depreciation_account_name ?? "-"}
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

  const [
    purchaseResult,
    salesResult,
    capitalExpenditureResult,
    depreciationResult,
  ] = await Promise.all([
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
        "sales_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, customer_code, customer_name, total_amount, paid_amount, line_count, total_quantity, total_cogs, movement_count, total_qty_out, total_inventory_cost, cash_tx_count, cash_transaction_type, cash_tx_status, journal_status, total_debit, total_credit, journal_diff, has_cash_debit, has_receivable_debit, has_sales_credit, has_cogs_debit, has_inventory_credit, audit_result, audit_notes, created_at"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("v_capital_expenditure_flow_audit")
      .select(
        "capital_expenditure_id, transaction_no, transaction_date, payment_type, due_date, status, total_amount, paid_amount, category_code, category_name, asset_account_code, asset_account_name, liability_account_code, liability_account_name, journal_no, journal_status, cash_bank_transaction_no, cash_bank_transaction_type, cash_bank_transaction_status, line_count, fixed_asset_count, total_debit, total_credit, has_asset_debit, has_cash_credit, has_liability_credit, cash_bank_transaction_count, audit_result, audit_notes, created_at"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(15),

    supabase
      .from("v_fixed_asset_depreciation_flow_audit")
      .select(
        "depreciation_id, fixed_asset_id, asset_code, asset_name, acquisition_cost, residual_value, useful_life_months, asset_status, period_year, period_month, depreciation_date, depreciation_amount, accumulated_depreciation_amount, book_value_after, depreciation_status, journal_no, journal_status, depreciation_expense_account_code, depreciation_expense_account_name, accumulated_depreciation_account_code, accumulated_depreciation_account_name, total_debit, total_credit, journal_diff, has_expense_debit, has_accumulated_credit, audit_result, audit_notes, created_at"
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

  if (capitalExpenditureResult.error) {
    throw new Error(capitalExpenditureResult.error.message);
  }

  if (depreciationResult.error) {
    throw new Error(depreciationResult.error.message);
  }

  const purchaseAudits = (purchaseResult.data ?? []) as PurchaseFlowAudit[];
  const salesAudits = (salesResult.data ?? []) as SalesFlowAudit[];
  const capitalExpenditureAudits =
    (capitalExpenditureResult.data ?? []) as CapitalExpenditureFlowAudit[];
  const depreciationAudits =
    (depreciationResult.data ?? []) as FixedAssetDepreciationFlowAudit[];

  const allAudits = [
    ...purchaseAudits,
    ...salesAudits,
    ...capitalExpenditureAudits,
    ...depreciationAudits,
  ];

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
              barang, stok, kas atau utang, aset tetap, penyusutan, dan pencatatan keuangan.
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
            Mengecek penjualan tunai dan kredit: kas masuk atau piutang, stok keluar, HPP, pendapatan, dan jurnal.
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

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Belanja Aset</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mengecek Belanja Modal: aset tetap terbentuk, kas keluar atau utang tercatat, dan jurnal aset seimbang.
          </p>
        </div>

        {capitalExpenditureAudits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Boxes className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold text-slate-950">
              Belum ada Belanja Aset
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Setelah unit mencatat Belanja Modal, hasil pengecekan alurnya akan muncul di sini.
            </p>
          </div>
        ) : (
          capitalExpenditureAudits.map((audit) => (
            <CapitalExpenditureAuditCard
              key={audit.capital_expenditure_id}
              audit={audit}
            />
          ))
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-950">Penyusutan Aset</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mengecek penyusutan aset tetap: beban penyusutan, akumulasi penyusutan, nilai buku, dan jurnal seimbang.
          </p>
        </div>

        {depreciationAudits.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <TrendingDown className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-lg font-bold text-slate-950">
              Belum ada penyusutan aset
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Setelah unit memproses penyusutan bulanan, hasil pengecekan alurnya akan muncul di sini.
            </p>
          </div>
        ) : (
          depreciationAudits.map((audit) => (
            <FixedAssetDepreciationAuditCard
              key={audit.depreciation_id}
              audit={audit}
            />
          ))
        )}
      </section>
    </div>
  );
}

