# Frontend Gap 000028 Column Requirements — ORVIA-BUMDES

Tanggal audit: 2026-06-02

Tujuan: mengambil interface/type dan pola akses kolom dari frontend untuk menyusun view migration 000028 secara akurat.

## `src\app\bupati\dashboard\page.tsx`

```tsx
   14:   ShieldCheck,
   15:   TrendingUp,
   16: } from "lucide-react";
   17: 
   18: import { Badge } from "@/components/ui/badge";
   19: import { Card, CardHeader } from "@/components/ui/card";
   20: import { createClient } from "@/lib/supabase/server";
   21: 
   22: type DashboardSummary = {
   23:   report_year: number | null;
   24:   total_bumdes_terpantau: number | null;
   25:   total_unit_terpantau: number | null;
   26:   total_dana_tersalur: number | null;
   27:   total_aset: number | null;
   28:   total_pendapatan: number | null;
   29:   laba_rugi_bersih: number | null;
   30:   skor_kesehatan_rata_rata: number | null;
   31:   skor_maksimal_rata_rata: number | null;
   32:   total_sehat: number | null;
   33:   total_kurang_sehat: number | null;
   34:   total_tidak_sehat: number | null;
   35:   status_kesehatan_kabupaten: string | null;
   36:   aset_terhadap_dana_tersalur_percent: number | null;
   37:   produktivitas_dana_percent: number | null;
   38: };
   39: 
   40: type KecamatanPerformance = {
   41:   nama_kecamatan: string | null;
   42:   total_bumdes: number | null;
   43:   total_unit: number | null;
   44:   total_pendapatan: number | null;
   45:   laba_rugi_bersih: number | null;
   46:   total_aset: number | null;
   47:   skor_rata_rata: number | null;
   48:   skor_maksimal_rata_rata: number | null;
   49:   total_sehat: number | null;
   50:   total_kurang_sehat: number | null;
   51:   total_tidak_sehat: number | null;
   52:   total_dana_tersalur: number | null;
   53: };
   54: 
   55: type BumdesPriority = {
   56:   kode_bumdes: string | null;
   57:   nama_bumdes: string | null;
   58:   nama_desa: string | null;
   59:   nama_kecamatan: string | null;
   60:   nama_unit: string | null;
   61:   total_pendapatan: number | null;
   62:   laba_rugi_bersih: number | null;
   63:   total_aset: number | null;
   64:   kas_setara_kas: number | null;
   65:   skor_kesehatan: number | null;
   66:   skor_maksimal: number | null;
   67:   dashboard_health_status: string | null;
   68:   accounting_consistency_status: string | null;
   69:   masalah_utama: string | null;
   70: };
   71: 
   72: type TopPerformingBumdes = {
   73:   kode_bumdes: string | null;
   74:   nama_bumdes: string | null;
   75:   nama_desa: string | null;
   76:   nama_kecamatan: string | null;
   77:   nama_unit: string | null;
   78:   total_pendapatan: number | null;
   79:   laba_rugi_bersih: number | null;
   80:   total_aset: number | null;
   81:   roe_percent: number | null;
   82:   roi_percent: number | null;
   83:   skor_kesehatan: number | null;
   84:   skor_maksimal: number | null;
   85:   dashboard_health_status: string | null;
   86:   accounting_consistency_status: string | null;
   87: };
   88: 
   89: const numberFormatter = new Intl.NumberFormat("id-ID");
   90: const currencyFormatter = new Intl.NumberFormat("id-ID", {
   91:   style: "currency",
   92:   currency: "IDR",
   93:   maximumFractionDigits: 0,
   94: });
   95: 
   96: function toNumber(value: number | string | null | undefined) {
   97:   if (value === null || value === undefined) return 0;
```

```tsx
  305:   const supabase = await createClient();
  306: 
  307:   const [
  308:     summaryResult,
  309:     kecamatanResult,
  310:     priorityResult,
  311:     topResult,
  312:   ] = await Promise.all([
  313:     supabase.from("v_bupati_dashboard_summary").select("*").maybeSingle(),
  314:     supabase
  315:       .from("v_bupati_kecamatan_performance")
  316:       .select("*")
  317:       .order("skor_rata_rata", { ascending: false })
  318:       .limit(8),
  319:     supabase
  320:       .from("v_bupati_bumdes_priority_attention")
  321:       .select("*")
  322:       .order("skor_kesehatan", { ascending: true })
  323:       .limit(8),
  324:     supabase
  325:       .from("v_bupati_top_performing_bumdes")
  326:       .select("*")
  327:       .order("skor_kesehatan", { ascending: false })
  328:       .limit(6),
  329:   ]);
  330: 
  331:   const summary = summaryResult.data as DashboardSummary | null;
  332:   const kecamatanRows = (kecamatanResult.data ?? []) as KecamatanPerformance[];
  333:   const priorityRows = (priorityResult.data ?? []) as BumdesPriority[];
  334:   const topRows = (topResult.data ?? []) as TopPerformingBumdes[];
  335: 
  336:   const errors = [
  337:     summaryResult.error?.message,
  338:     kecamatanResult.error?.message,
  339:     priorityResult.error?.message,
  340:     topResult.error?.message,
  341:   ].filter(Boolean);
  342: 
  343:   const totalSehat = toNumber(summary?.total_sehat);
  344:   const totalKurangSehat = toNumber(summary?.total_kurang_sehat);
  345:   const totalTidakSehat = toNumber(summary?.total_tidak_sehat);
  346:   const score = toNumber(summary?.skor_kesehatan_rata_rata);
  347:   const maxScore = toNumber(summary?.skor_maksimal_rata_rata) || 100;
  348: 
  349:   return (
  350:     <div className="space-y-6">
  351:       {errors.length > 0 ? (
  352:         <Card className="border-red-200 bg-red-50">
```

## `src\app\unit\dashboard\catat-transaksi\_components\capital-debt-payment-entry-form.tsx`

```tsx
  110:                 <PageHeader />
  111: 
  112:                 <ErrorState message="Konteks tenant/unit tidak ditemukan. Silakan login ulang." />
  113:             </div>
  114:         );
  115:     }
  116: 
  117:     const { data: payables, error: payablesError } = await supabase
  118:         .from("v_capital_expenditure_payables")
  119:         .select(
  120:             "capital_expenditure_id, transaction_no, supplier_name, transaction_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
  121:         )
  122:         .eq("tenant_id", loginContext.tenant_id)
  123:         .eq("unit_id", loginContext.unit_id)
  124:         .gt("outstanding_amount", 0)
  125:         .order("transaction_date", { ascending: false });
  126: 
  127:     const { data: cashBanks, error: cashBanksError } = await supabase
  128:         .from("v_cash_bank_balance")
  129:         .select("cash_bank_account_id, account_code, account_name, current_balance")
  130:         .eq("tenant_id", loginContext.tenant_id)
  131:         .eq("unit_id", loginContext.unit_id)
  132:         .gt("current_balance", 0)
  133:         .order("account_code", { ascending: true });
  134: 
  135:     const payableRows = (payables || []) as CapitalPayable[];
  136:     const cashBankRows = (cashBanks || []) as CashBankBalance[];
  137: 
  138:     const errorMessage = payablesError?.message || cashBanksError?.message;
  139: 
  140:     return (
  141:         <div className="space-y-5">
  142:             <PageHeader />
  143: 
  144:             {errorMessage && <ErrorState message={errorMessage} />}
  145: 
  146:             <CapitalDebtPaymentFormClient
  147:                 payables={payableRows}
  148:                 cashBanks={cashBankRows}
  149:             />
  150: 
  151:             <PayableList payables={payableRows} />
  152:         </div>
  153:     );
  154: }
```

## `src\app\unit\dashboard\catat-transaksi\_components\supplier-payment-entry-form.tsx`

```tsx
    1: import { HandCoins, PlusCircle } from "lucide-react";
    2: import { redirect } from "next/navigation";
    3: import { PageBackButton } from "@/components/ui/page-back-button";
    4: import { createClient } from "@/lib/supabase/server";
    5: import { getLoginContext } from "@/lib/auth/get-login-context";
    6: import { paySupplierPurchaseInvoice } from "../_actions/supplier-payment-actions";
    7: 
    8: type PayableInvoice = {
    9:   purchase_invoice_id: string;
   10:   supplier_name: string | null;
   11:   invoice_no: string;
   12:   invoice_date: string;
   13:   due_date: string | null;
   14:   total_amount: number | string;
   15:   payment_amount: number | string;
   16:   outstanding_amount: number | string;
   17:   payable_status: string;
   18: };
   19: 
   20: type CashBankAccount = {
   21:   id: string;
   22:   account_code: string;
   23:   account_name: string;
   24:   account_kind: string;
   25: };
   26: 
   27: type CashBankBalance = {
   28:   cash_bank_account_id: string;
   29:   current_balance: number | string;
   30: };
   31: 
   32: function formatRupiah(value: number | string | null | undefined) {
   33:   const numberValue = Number(value ?? 0);
   34: 
   35:   return new Intl.NumberFormat("id-ID", {
   36:     style: "currency",
   37:     currency: "IDR",
   38:     maximumFractionDigits: 0,
   39:   }).format(Number.isNaN(numberValue) ? 0 : numberValue);
   40: }
   41: 
   42: export async function SupplierPaymentEntryForm() {
   43:   const context = await getLoginContext();
   44: 
   45:   if (!context?.tenant_id || !context.unit_id) {
   46:     redirect("/login");
   47:   }
   48: 
   49:   const supabase = await createClient();
   50: 
   51:   const [payableResult, cashBankResult, balanceResult] = await Promise.all([
   52:     supabase
   53:       .from("v_purchase_invoice_payables")
   54:       .select(
   55:         "purchase_invoice_id, supplier_name, invoice_no, invoice_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
   56:       )
   57:       .eq("tenant_id", context.tenant_id)
   58:       .eq("unit_id", context.unit_id)
   59:       .gt("outstanding_amount", 0)
   60:       .order("invoice_date", { ascending: true })
   61:       .order("invoice_no", { ascending: true }),
   62: 
   63:     supabase
   64:       .from("cash_bank_accounts")
   65:       .select("id, account_code, account_name, account_kind")
   66:       .eq("tenant_id", context.tenant_id)
   67:       .eq("unit_id", context.unit_id)
   68:       .eq("is_active", true)
   69:       .order("account_code", { ascending: true }),
   70: 
   71:     supabase
   72:       .from("v_cash_bank_balance")
   73:       .select("cash_bank_account_id, current_balance")
   74:       .eq("tenant_id", context.tenant_id)
   75:       .eq("unit_id", context.unit_id),
   76:   ]);
   77: 
   78:   if (payableResult.error) throw new Error(payableResult.error.message);
   79:   if (cashBankResult.error) throw new Error(cashBankResult.error.message);
   80:   if (balanceResult.error) throw new Error(balanceResult.error.message);
   81: 
   82:   const payables = (payableResult.data ?? []) as PayableInvoice[];
   83:   const cashBankAccounts = (cashBankResult.data ?? []) as CashBankAccount[];
   84:   const balances = (balanceResult.data ?? []) as CashBankBalance[];
   85: 
   86:   const balanceByAccount = new Map(
   87:     balances.map((balance) => [
   88:       balance.cash_bank_account_id,
   89:       Number(balance.current_balance ?? 0),
   90:     ])
   91:   );
   92: 
   93:   return (
   94:     <div className="space-y-5">
   95:       <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />
   96: 
   97:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
   98:         <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
   99:           <div>
  100:             <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
```

## `src\app\unit\dashboard\cek-alur-transaksi\page.tsx`

```tsx
   15:   TrendingDown,
   16:   WalletCards,
   17:   type LucideIcon,
   18: } from "lucide-react";
   19: import { redirect } from "next/navigation";
   20: import { createClient } from "@/lib/supabase/server";
   21: import { getLoginContext } from "@/lib/auth/get-login-context";
   22: 
   23: type PurchaseFlowAudit = {
   24:   purchase_invoice_id: string;
   25:   invoice_no: string;
   26:   invoice_date: string;
   27:   payment_type: string;
   28:   invoice_status: string;
   29:   supplier_code: string | null;
   30:   supplier_name: string | null;
   31:   total_amount: number | string;
   32:   paid_amount: number | string;
   33:   line_count: number;
   34:   total_quantity: number | string;
   35:   movement_count: number;
   36:   journal_status: string | null;
   37:   total_debit: number | string;
   38:   total_credit: number | string;
   39:   journal_diff: number | string;
   40:   cash_tx_count: number;
   41:   audit_result: string;
   42:   audit_notes: string[] | null;
   43:   created_at: string;
   44: };
   45: 
   46: type SalesFlowAudit = {
   47:   sales_invoice_id: string;
   48:   invoice_no: string;
   49:   invoice_date: string;
   50:   payment_type: string;
   51:   invoice_status: string;
   52:   customer_code: string | null;
   53:   customer_name: string | null;
   54:   total_amount: number | string;
   55:   paid_amount: number | string;
   56:   line_count: number;
   57:   total_quantity: number | string;
   58:   total_cogs: number | string;
   59:   movement_count: number;
   60:   total_qty_out: number | string;
   61:   total_inventory_cost: number | string;
   62:   cash_tx_count: number;
   63:   cash_transaction_type: string | null;
   64:   cash_tx_status: string | null;
   65:   journal_status: string | null;
   66:   total_debit: number | string;
   67:   total_credit: number | string;
   68:   journal_diff: number | string;
   69:   has_cash_debit: boolean;
   70:   has_receivable_debit: boolean;
   71:   has_sales_credit: boolean;
   72:   has_cogs_debit: boolean;
   73:   has_inventory_credit: boolean;
   74:   audit_result: string;
   75:   audit_notes: string[] | null;
   76:   created_at: string;
   77: };
   78: 
   79: type CapitalExpenditureFlowAudit = {
   80:   capital_expenditure_id: string;
   81:   transaction_no: string;
   82:   transaction_date: string;
   83:   payment_type: string;
   84:   due_date: string | null;
   85:   status: string;
   86:   total_amount: number | string;
   87:   paid_amount: number | string;
   88:   category_code: string | null;
   89:   category_name: string | null;
   90:   asset_account_code: string | null;
   91:   asset_account_name: string | null;
   92:   liability_account_code: string | null;
   93:   liability_account_name: string | null;
   94:   journal_no: string | null;
   95:   journal_status: string | null;
   96:   cash_bank_transaction_no: string | null;
   97:   cash_bank_transaction_type: string | null;
   98:   cash_bank_transaction_status: string | null;
   99:   line_count: number;
  100:   fixed_asset_count: number;
  101:   total_debit: number | string;
  102:   total_credit: number | string;
  103:   has_asset_debit: boolean;
  104:   has_cash_credit: boolean;
  105:   has_liability_credit: boolean;
  106:   cash_bank_transaction_count: number;
  107:   audit_result: string;
  108:   audit_notes: string[] | null;
  109:   created_at: string;
  110: };
  111: 
  112: type FixedAssetDepreciationFlowAudit = {
  113:   depreciation_id: string;
  114:   fixed_asset_id: string;
  115:   asset_code: string;
  116:   asset_name: string;
  117:   acquisition_cost: number | string;
  118:   residual_value: number | string;
  119:   useful_life_months: number;
  120:   asset_status: string;
  121:   period_year: number;
  122:   period_month: number;
  123:   depreciation_date: string;
  124:   depreciation_amount: number | string;
  125:   accumulated_depreciation_amount: number | string;
  126:   book_value_after: number | string;
  127:   depreciation_status: string;
  128:   journal_no: string | null;
  129:   journal_status: string | null;
  130:   depreciation_expense_account_code: string | null;
  131:   depreciation_expense_account_name: string | null;
  132:   accumulated_depreciation_account_code: string | null;
  133:   accumulated_depreciation_account_name: string | null;
  134:   total_debit: number | string;
  135:   total_credit: number | string;
  136:   journal_diff: number | string;
  137:   has_expense_debit: boolean;
```

```tsx
  657:   const [
  658:     purchaseResult,
  659:     salesResult,
  660:     capitalExpenditureResult,
  661:     depreciationResult,
  662:   ] = await Promise.all([
  663:     supabase
  664:       .from("v_purchase_invoice_flow_audit")
  665:       .select(
  666:         "purchase_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, supplier_code, supplier_name, total_amount, paid_amount, line_count, total_quantity, movement_count, journal_status, total_debit, total_credit, journal_diff, cash_tx_count, audit_result, audit_notes, created_at"
  667:       )
  668:       .eq("tenant_id", context.tenant_id)
  669:       .eq("unit_id", context.unit_id)
  670:       .order("created_at", { ascending: false })
  671:       .limit(15),
  672: 
  673:     supabase
  674:       .from("v_sales_invoice_flow_audit")
  675:       .select(
  676:         "sales_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, customer_code, customer_name, total_amount, paid_amount, line_count, total_quantity, total_cogs, movement_count, total_qty_out, total_inventory_cost, cash_tx_count, cash_transaction_type, cash_tx_status, journal_status, total_debit, total_credit, journal_diff, has_cash_debit, has_receivable_debit, has_sales_credit, has_cogs_debit, has_inventory_credit, audit_result, audit_notes, created_at"
  677:       )
  678:       .eq("tenant_id", context.tenant_id)
  679:       .eq("unit_id", context.unit_id)
  680:       .order("created_at", { ascending: false })
  681:       .limit(15),
  682: 
  683:     supabase
  684:       .from("v_capital_expenditure_flow_audit")
  685:       .select(
  686:         "capital_expenditure_id, transaction_no, transaction_date, payment_type, due_date, status, total_amount, paid_amount, category_code, category_name, asset_account_code, asset_account_name, liability_account_code, liability_account_name, journal_no, journal_status, cash_bank_transaction_no, cash_bank_transaction_type, cash_bank_transaction_status, line_count, fixed_asset_count, total_debit, total_credit, has_asset_debit, has_cash_credit, has_liability_credit, cash_bank_transaction_count, audit_result, audit_notes, created_at"
  687:       )
  688:       .eq("tenant_id", context.tenant_id)
  689:       .eq("unit_id", context.unit_id)
  690:       .eq("status", "posted")
  691:       .order("created_at", { ascending: false })
  692:       .limit(15),
  693: 
  694:     supabase
  695:       .from("v_fixed_asset_depreciation_flow_audit")
  696:       .select(
  697:         "depreciation_id, fixed_asset_id, asset_code, asset_name, acquisition_cost, residual_value, useful_life_months, asset_status, period_year, period_month, depreciation_date, depreciation_amount, accumulated_depreciation_amount, book_value_after, depreciation_status, journal_no, journal_status, depreciation_expense_account_code, depreciation_expense_account_name, accumulated_depreciation_account_code, accumulated_depreciation_account_name, total_debit, total_credit, journal_diff, has_expense_debit, has_accumulated_credit, audit_result, audit_notes, created_at"
  698:       )
  699:       .eq("tenant_id", context.tenant_id)
  700:       .eq("unit_id", context.unit_id)
  701:       .order("created_at", { ascending: false })
  702:       .limit(15),
  703:   ]);
  704: 
  705:   if (purchaseResult.error) {
  706:     throw new Error(purchaseResult.error.message);
  707:   }
  708: 
  709:   if (salesResult.error) {
  710:     throw new Error(salesResult.error.message);
  711:   }
  712: 
  713:   if (capitalExpenditureResult.error) {
  714:     throw new Error(capitalExpenditureResult.error.message);
  715:   }
  716: 
  717:   if (depreciationResult.error) {
  718:     throw new Error(depreciationResult.error.message);
  719:   }
  720: 
  721:   const purchaseAudits = (purchaseResult.data ?? []) as PurchaseFlowAudit[];
  722:   const salesAudits = (salesResult.data ?? []) as SalesFlowAudit[];
  723:   const capitalExpenditureAudits =
  724:     (capitalExpenditureResult.data ?? []) as CapitalExpenditureFlowAudit[];
  725:   const depreciationAudits =
  726:     (depreciationResult.data ?? []) as FixedAssetDepreciationFlowAudit[];
```

## `src\app\unit\dashboard\aset-tetap\page.tsx`

```tsx
    9:   WalletCards,
   10: } from "lucide-react";
   11: import { redirect } from "next/navigation";
   12: import { PageBackButton } from "@/components/ui/page-back-button";
   13: import { createClient } from "@/lib/supabase/server";
   14: import { getLoginContext } from "@/lib/auth/get-login-context";
   15: import { postMonthlyFixedAssetDepreciation } from "./_actions/fixed-asset-actions";
   16: 
   17: type FixedAssetSummary = {
   18:   fixed_asset_id: string;
   19:   asset_code: string;
   20:   asset_name: string;
   21:   acquisition_date: string;
   22:   acquisition_cost: number | string;
   23:   residual_value: number | string;
   24:   useful_life_months: number;
   25:   asset_status: string;
   26:   asset_account_code: string | null;
   27:   asset_account_name: string | null;
   28:   accumulated_depreciation_total: number | string;
   29:   current_book_value: number | string;
   30:   last_depreciation_date: string | null;
   31:   posted_depreciation_count: number;
   32:   posted_journal_count: number;
   33:   current_period_year: number | null;
   34:   current_period_month: number | null;
   35:   current_period_status: string | null;
   36:   depreciation_readiness_status: string;
   37:   monthly_depreciation_estimate: number | string;
   38:   created_at: string;
   39: };
   40: 
   41: function formatRupiah(value: number | string | null | undefined) {
   42:   const numericValue = Number(value ?? 0);
```

```tsx
  104: 
  105:   if (!context?.tenant_id || !context.unit_id) {
  106:     redirect("/login");
  107:   }
  108: 
  109:   const supabase = await createClient();
  110: 
  111:   const { data, error } = await supabase
  112:     .from("v_fixed_asset_depreciation_summary")
  113:     .select(`
  114:       fixed_asset_id,
  115:       asset_code,
  116:       asset_name,
  117:       acquisition_date,
  118:       acquisition_cost,
  119:       residual_value,
  120:       useful_life_months,
  121:       asset_status,
  122:       asset_account_code,
  123:       asset_account_name,
  124:       accumulated_depreciation_total,
  125:       current_book_value,
  126:       last_depreciation_date,
  127:       posted_depreciation_count,
  128:       posted_journal_count,
  129:       current_period_year,
  130:       current_period_month,
  131:       current_period_status,
  132:       depreciation_readiness_status,
  133:       monthly_depreciation_estimate,
  134:       created_at
  135:     `)
  136:     .eq("tenant_id", context.tenant_id)
  137:     .eq("unit_id", context.unit_id)
  138:     .order("created_at", { ascending: false });
  139: 
  140:   if (error) {
  141:     throw new Error(error.message);
  142:   }
  143: 
  144:   const assets = (data ?? []) as FixedAssetSummary[];
  145:   const totalAssets = assets.length;
  146:   const activeAssets = assets.filter((asset) => asset.asset_status === "active").length;
  147:   const readyAssets = assets.filter(
  148:     (asset) => asset.depreciation_readiness_status === "READY"
  149:   ).length;
  150:   const doneThisPeriod = assets.filter((asset) =>
  151:     asset.depreciation_readiness_status.startsWith("DONE")
  152:   ).length;
  153: 
  154:   const totalAcquisitionCost = assets.reduce(
  155:     (sum, asset) => sum + Number(asset.acquisition_cost ?? 0),
  156:     0
  157:   );
  158:   const totalAccumulatedDepreciation = assets.reduce(
  159:     (sum, asset) => sum + Number(asset.accumulated_depreciation_total ?? 0),
  160:     0
  161:   );
  162:   const totalBookValue = assets.reduce(
  163:     (sum, asset) => sum + Number(asset.current_book_value ?? 0),
```

```tsx
  323:           <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
  324:             <CalendarDays className="h-5 w-5" />
  325:           </div>
  326:           <div>
  327:             <h2 className="text-lg font-bold text-slate-950">
  328:               Daftar Aset Unit
  329:             </h2>
  330:             <p className="text-sm text-slate-600">
  331:               Menampilkan aset dari view v_fixed_asset_depreciation_summary.
  332:             </p>
  333:           </div>
  334:         </div>
  335: 
  336:         {assets.length === 0 ? (
  337:           <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
  338:             <p className="text-sm font-semibold text-slate-700">
  339:               Belum ada aset tetap.
  340:             </p>
  341:             <p className="mt-1 text-sm text-slate-500">
  342:               Aset akan muncul setelah transaksi Belanja Modal berhasil diposting.
  343:             </p>
  344:           </div>
  345:         ) : (
  346:           <div className="overflow-hidden rounded-2xl border border-slate-200">
  347:             <div className="overflow-x-auto">
  348:               <table className="w-full min-w-[1280px] text-left text-sm">
  349:                 <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
  350:                   <tr>
  351:                     <th className="px-4 py-3">Kode Aset</th>
  352:                     <th className="px-4 py-3">Nama Aset</th>
  353:                     <th className="px-4 py-3">Kategori Akun</th>
  354:                     <th className="px-4 py-3">Tanggal Perolehan</th>
  355:                     <th className="px-4 py-3 text-right">Nilai Perolehan</th>
  356:                     <th className="px-4 py-3 text-right">Akumulasi Susut</th>
```

## `src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx`

```tsx
    5: import { notFound, redirect } from "next/navigation";
    6: import { Badge } from "@/components/ui/badge";
    7: import { Card, CardHeader } from "@/components/ui/card";
    8: import { DataTable } from "@/components/ui/data-table";
    9: import { createClient } from "@/lib/supabase/server";
   10: import { getLoginContext } from "@/lib/auth/get-login-context";
   11: import { CorrectionRequestForm } from "./correction-request-form";
   12: 
   13: type EligibleEntry = {
   14:   journal_entry_id: string;
   15:   tenant_id: string;
   16:   unit_id: string | null;
   17:   journal_no: string;
   18:   journal_date: string;
   19:   source_type: string;
   20:   description: string | null;
   21:   total_debit: number | string | null;
   22:   total_credit: number | string | null;
   23: };
   24: 
   25: type EntryLine = {
   26:   journal_line_id: string;
   27:   line_no: number | string;
   28:   account_id: string;
   29:   account_code: string;
   30:   account_name: string;
   31:   line_description: string | null;
   32:   debit: number | string;
   33:   credit: number | string;
   34: };
   35: 
   36: type AccountOption = {
   37:   account_id: string;
   38:   account_code: string;
   39:   account_name: string;
   40:   account_tipe: string;
   41:   account_type: string;
   42:   normal_balance: string;
   43:   unit_id: string | null;
   44: };
   45: 
   46: function toNumber(value: number | string | null | undefined) {
   47:   if (value === null || value === undefined) return 0;
   48:   const parsed = Number(value);
   49:   return Number.isFinite(parsed) ? parsed : 0;
   50: }
   51: 
   52: function formatRupiah(value: number | string | null | undefined) {
   53:   return new Intl.NumberFormat("id-ID", {
   54:     style: "currency",
   55:     currency: "IDR",
   56:     maximumFractionDigits: 0,
   57:   }).format(toNumber(value));
   58: }
   59: 
   60: function dedupeAccountOptions(
   61:   accounts: AccountOption[],
```

```tsx
   95: 
   96:   if (!journalEntryId) {
   97:     redirect("/unit/dashboard/catat-transaksi/koreksi-transaksi");
   98:   }
   99: 
  100:   const supabase = await createClient();
  101: 
  102:   const { data: entryData, error: entryError } = await supabase
  103:     .from("v_journal_correction_eligible_entries")
  104:     .select("*")
  105:     .eq("journal_entry_id", journalEntryId)
  106:     .eq("tenant_id", context.tenant_id)
  107:     .eq("unit_id", context.unit_id)
  108:     .maybeSingle();
  109: 
  110:   if (entryError) {
  111:     return (
  112:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  113:         Gagal membaca transaksi lama: {entryError.message}
  114:       </div>
  115:     );
  116:   }
  117: 
  118:   if (!entryData) {
  119:     notFound();
  120:   }
  121: 
  122:   const entry = entryData as unknown as EligibleEntry;
  123: 
  124:   const { data: lineData } = await supabase
  125:     .from("v_journal_correction_eligible_entry_lines")
  126:     .select("*")
  127:     .eq("journal_entry_id", journalEntryId)
  128:     .eq("tenant_id", context.tenant_id)
  129:     .eq("unit_id", context.unit_id)
  130:     .order("line_no", { ascending: true });
  131: 
  132:   const { data: accountData } = await supabase
  133:     .from("v_journal_correction_account_options")
  134:     .select("*")
  135:     .eq("tenant_id", context.tenant_id)
  136:     .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
  137:     .order("account_code", { ascending: true });
  138: 
  139:   const originalLines = ((lineData ?? []) as unknown) as EntryLine[];
  140:   const rawAccounts = ((accountData ?? []) as unknown) as AccountOption[];
  141:   const accountOptions = dedupeAccountOptions(rawAccounts, context.unit_id);
  142: 
  143:   return (
  144:     <div className="space-y-5">
  145:       <div>
  146:         <Link
  147:           href="/unit/dashboard/catat-transaksi/koreksi-transaksi"
  148:           className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
  149:         >
  150:           <ArrowLeft className="h-4 w-4" />
  151:           Kembali ke daftar transaksi
  152:         </Link>
  153:       </div>
  154: 
  155:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  156:         <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  157:           Admin Unit / Pengajuan Koreksi
  158:         </p>
  159: 
  160:         <h1 className="mt-2 text-2xl font-bold text-slate-950">
  161:           Ajukan Koreksi Transaksi
  162:         </h1>
```

## `src\app\bumdes\dashboard\koreksi-transaksi\page.tsx`

```tsx
   11: import { redirect } from "next/navigation";
   12: import { Badge } from "@/components/ui/badge";
   13: import { Card, CardHeader } from "@/components/ui/card";
   14: import { DataTable } from "@/components/ui/data-table";
   15: import { StatCard } from "@/components/ui/stat-card";
   16: import { createClient } from "@/lib/supabase/server";
   17: import { getLoginContext } from "@/lib/auth/get-login-context";
   18: 
   19: type CorrectionFlowRow = {
   20:   correction_id: string;
   21:   tenant_id: string;
   22:   kode_bumdes: string | null;
   23:   nama_bumdes: string | null;
   24:   unit_id: string | null;
   25:   kode_unit: string | null;
   26:   nama_unit: string | null;
   27:   correction_no: string;
   28:   correction_date: string;
   29:   reason: string;
   30:   correction_status: string;
   31:   original_journal_no: string | null;
   32:   original_source_type: string | null;
   33:   original_total_debit: number | string | null;
   34:   corrected_journal_no: string | null;
   35:   flow_status: string;
   36:   audit_result: string;
   37:   requested_by_name: string | null;
   38:   requested_at: string | null;
   39:   approved_by_name: string | null;
   40:   approved_at: string | null;
   41:   posted_by_name: string | null;
   42:   posted_at: string | null;
   43:   created_at: string | null;
   44: };
```

```tsx
  107: 
  108:   if (!context?.user_id || !context.tenant_id) {
  109:     redirect("/login");
  110:   }
  111: 
  112:   const supabase = await createClient();
  113: 
  114:   const { data, error } = await supabase
  115:     .from("v_journal_correction_flow")
  116:     .select(
  117:       [
  118:         "correction_id",
  119:         "tenant_id",
  120:         "kode_bumdes",
  121:         "nama_bumdes",
  122:         "unit_id",
  123:         "kode_unit",
  124:         "nama_unit",
  125:         "correction_no",
  126:         "correction_date",
  127:         "reason",
  128:         "correction_status",
  129:         "original_journal_no",
  130:         "original_source_type",
  131:         "original_total_debit",
  132:         "corrected_journal_no",
  133:         "flow_status",
  134:         "audit_result",
  135:         "requested_by_name",
  136:         "requested_at",
  137:         "approved_by_name",
  138:         "approved_at",
  139:         "posted_by_name",
  140:         "posted_at",
  141:         "created_at",
  142:       ].join(", ")
  143:     )
  144:     .eq("tenant_id", context.tenant_id)
  145:     .in("correction_status", ["pending_approval", "approved", "rejected", "posted"])
  146:     .order("created_at", { ascending: false });
  147: 
  148:   const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];
  149: 
  150:   const readyToPostRows = rows.filter((item) => item.correction_status === "approved");
  151:   const pendingCount = rows.filter((item) => item.correction_status === "pending_approval").length;
  152:   const rejectedCount = rows.filter((item) => item.correction_status === "rejected").length;
  153:   const postedCount = rows.filter((item) => item.correction_status === "posted").length;
  154: 
  155:   if (error) {
  156:     return (
  157:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  158:         Gagal membaca data koreksi transaksi: {error.message}
  159:       </div>
  160:     );
  161:   }
  162: 
  163:   return (
  164:     <div className="space-y-5">
  165:       <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
  166:         <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
  167:           <div>
  168:             <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
  169:               Admin BUMDes / Koreksi Transaksi
  170:             </p>
  171: 
```

## `src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx`

File tidak ditemukan.

## `src\app\pengawas\dashboard\koreksi-transaksi\page.tsx`

```tsx
    5: import { redirect } from "next/navigation";
    6: import { Badge } from "@/components/ui/badge";
    7: import { Card, CardHeader } from "@/components/ui/card";
    8: import { DataTable } from "@/components/ui/data-table";
    9: import { StatCard } from "@/components/ui/stat-card";
   10: import { createClient } from "@/lib/supabase/server";
   11: import { getLoginContext } from "@/lib/auth/get-login-context";
   12: 
   13: type CorrectionFlowRow = {
   14:   correction_id: string;
   15:   tenant_id: string;
   16:   kode_bumdes: string | null;
   17:   nama_bumdes: string | null;
   18:   unit_id: string | null;
   19:   kode_unit: string | null;
   20:   nama_unit: string | null;
   21:   correction_no: string;
   22:   correction_date: string;
   23:   reason: string;
   24:   correction_status: string;
   25:   original_journal_no: string | null;
   26:   original_source_type: string | null;
   27:   original_description: string | null;
   28:   original_total_debit: number | string | null;
   29:   corrected_journal_no: string | null;
   30:   flow_status: string;
   31:   audit_result: string;
   32:   requested_by_name: string | null;
   33:   requested_at: string | null;
   34:   approved_by_name: string | null;
   35:   approved_at: string | null;
   36:   rejected_by_name: string | null;
   37:   rejected_at: string | null;
   38:   posted_by_name: string | null;
```

```tsx
   99: 
  100:   if (!context?.user_id || !context.tenant_id) {
  101:     redirect("/login");
  102:   }
  103: 
  104:   const supabase = await createClient();
  105: 
  106:   const { data, error } = await supabase
  107:     .from("v_journal_correction_flow")
  108:     .select(
  109:       [
  110:         "correction_id",
  111:         "tenant_id",
  112:         "kode_bumdes",
  113:         "nama_bumdes",
  114:         "unit_id",
  115:         "kode_unit",
  116:         "nama_unit",
  117:         "correction_no",
  118:         "correction_date",
  119:         "reason",
  120:         "correction_status",
  121:         "original_journal_no",
  122:         "original_source_type",
  123:         "original_description",
  124:         "original_total_debit",
  125:         "corrected_journal_no",
  126:         "flow_status",
  127:         "audit_result",
  128:         "requested_by_name",
  129:         "requested_at",
  130:         "approved_by_name",
  131:         "approved_at",
  132:         "rejected_by_name",
  133:         "rejected_at",
  134:         "posted_by_name",
  135:         "posted_at",
  136:       ].join(", ")
  137:     )
  138:     .eq("tenant_id", context.tenant_id)
  139:     .order("created_at", { ascending: false });
  140: 
  141:   const rows = ((data ?? []) as unknown) as CorrectionFlowRow[];
  142: 
  143:   const waitingRows = rows.filter(
  144:     (item) => item.correction_status === "pending_approval"
  145:   );
  146: 
  147:   const approvedCount = rows.filter(
  148:     (item) => item.correction_status === "approved"
  149:   ).length;
  150: 
  151:   const rejectedCount = rows.filter(
  152:     (item) => item.correction_status === "rejected"
  153:   ).length;
  154: 
  155:   const postedCount = rows.filter(
  156:     (item) => item.correction_status === "posted"
  157:   ).length;
  158: 
  159:   if (error) {
  160:     return (
  161:       <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
  162:         Gagal membaca data koreksi transaksi: {error.message}
  163:       </div>
  164:     );
```

```tsx
  219:           description="Koreksi final dan masuk audit trail."
  220:           icon={<FileCheck2 className="h-5 w-5" />}
  221:         />
  222:       </section>
  223: 
  224:       <Card>
  225:         <CardHeader
  226:           title="Daftar Koreksi Menunggu Persetujuan"
  227:           description="Data ini bersumber dari v_journal_correction_flow dan dibatasi sesuai tenant pengawas."
  228:           action={<Badge variant="warning">Perlu Review</Badge>}
  229:         />
  230: 
  231:         <DataTable
  232:           columns={[
  233:             "Nomor Koreksi",
  234:             "Unit",
  235:             "Transaksi Asal",
  236:             "Nilai",
  237:             "Alasan",
  238:             "Diajukan",
  239:             "Status",
  240:             "Aksi",
  241:           ]}
  242:           emptyText="Belum ada koreksi transaksi yang menunggu persetujuan."
  243:         >
  244:           {waitingRows.length > 0
  245:             ? waitingRows.map((item) => (
  246:                 <tr key={item.correction_id} className="hover:bg-slate-50">
  247:                   <td className="px-4 py-4">
  248:                     <div className="font-bold text-slate-950">
  249:                       {item.correction_no}
  250:                     </div>
  251:                     <div className="mt-1 text-xs text-slate-500">
  252:                       {item.correction_date}
```

## `src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx`

File tidak ditemukan.

## `src\app\unit\dashboard\reports\skoring\page.tsx`

```tsx
   14: import { PageBackButton } from "@/components/ui/page-back-button";
   15: import { PageHeader } from "@/components/ui/page-header";
   16: import {
   17:   AnimatedGaugeCard,
   18:   IndicatorLineChartCard,
   19:   type VisualIndicator,
   20: } from "./_components/skoring-visuals";
   21: 
   22: type SearchParams = Promise<Record<string, string | string[] | undefined>>;
   23: 
   24: type HealthScoringRow = {
   25:   kode_bumdes: string | null;
   26:   nama_bumdes: string | null;
   27:   nama_desa: string | null;
   28:   nama_kecamatan: string | null;
   29:   kode_unit: string | null;
   30:   nama_unit: string | null;
   31:   report_year: number | null;
   32: 
   33:   total_pendapatan: number | string | null;
   34:   total_hpp: number | string | null;
   35:   laba_kotor: number | string | null;
   36:   total_beban: number | string | null;
   37:   laba_rugi_bersih: number | string | null;
   38:   total_aset: number | string | null;
   39:   total_kewajiban: number | string | null;
   40:   total_ekuitas: number | string | null;
   41: 
   42:   kas_setara_kas: number | string | null;
   43:   piutang_usaha: number | string | null;
   44:   persediaan: number | string | null;
   45:   aset_lancar: number | string | null;
   46:   kewajiban_lancar: number | string | null;
   47:   total_penjualan_kredit: number | string | null;
   48: 
   49:   roe_percent: number | string | null;
```

```tsx
   73:   owner_equity_to_asset_score: number | null;
   74: 
   75:   total_score: number | null;
   76:   max_score: number | null;
   77:   health_status: string | null;
   78:   accounting_consistency_status: string | null;
   79: };
   80: 
   81: type IndicatorRow = {
   82:   no: number;
   83:   name: string;
   84:   value: string;
   85:   score: number;
   86:   maxScore: number;
   87:   note: string;
   88: };
   89: 
   90: function toNumber(value: number | string | null | undefined) {
   91:   const parsed = Number(value ?? 0);
   92:   return Number.isFinite(parsed) ? parsed : 0;
   93: }
   94: 
   95: function formatRupiah(value: number | string | null | undefined) {
   96:   return new Intl.NumberFormat("id-ID", {
   97:     style: "currency",
   98:     currency: "IDR",
   99:     maximumFractionDigits: 0,
  100:   }).format(toNumber(value));
  101: }
  102: 
  103: function formatCompactRupiah(value: number | string | null | undefined) {
  104:   const numberValue = toNumber(value);
  105: 
  106:   if (Math.abs(numberValue) >= 1_000_000_000) {
```

```tsx
  360:   }
  361: 
  362:   const params = searchParams ? await searchParams : {};
  363:   const selectedYear = getYearParam(params);
  364: 
  365:   const supabase = await createClient();
  366: 
  367:   const { data, error } = await supabase
  368:     .from("v_unit_financial_health_scoring")
  369:     .select(
  370:       "kode_bumdes, nama_bumdes, nama_desa, nama_kecamatan, kode_unit, nama_unit, report_year, total_pendapatan, total_hpp, laba_kotor, total_beban, laba_rugi_bersih, total_aset, total_kewajiban, total_ekuitas, kas_setara_kas, piutang_usaha, persediaan, aset_lancar, kewajiban_lancar, total_penjualan_kredit, roe_percent, roi_percent, rasio_kas_percent, rasio_lancar_percent, collection_period_days, inventory_turnover_days, total_asset_turnover_percent, owner_equity_to_asset_percent, roe_max_score, roe_score, roi_max_score, roi_score, rasio_kas_max_score, rasio_kas_score, rasio_lancar_max_score, rasio_lancar_score, collection_period_max_score, collection_period_score, inventory_turnover_max_score, inventory_turnover_score, total_asset_turnover_max_score, total_asset_turnover_score, owner_equity_to_asset_max_score, owner_equity_to_asset_score, total_score, max_score, health_status, accounting_consistency_status"
  371:     )
  372:     .eq("tenant_id", context.tenant_id)
  373:     .eq("unit_id", context.unit_id)
  374:     .eq("report_year", selectedYear)
  375:     .maybeSingle();
  376: 
  377:   const scoring = data as HealthScoringRow | null;
  378: 
  379:   const totalScore = scoring?.total_score ?? 0;
  380:   const maxScore = scoring?.max_score ?? 100;
  381:   const scorePercent = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  382:   const healthStatus = scoring?.health_status ?? "Belum Ada Data";
  383:   const statusTheme = getStatusTheme(healthStatus);
  384:   const StatusIcon = statusTheme.icon;
  385: 
  386:   const indicators: IndicatorRow[] = scoring
  387:     ? [
  388:         {
  389:           no: 1,
  390:           name: "Imbalan kepada Pemilik / ROE",
  391:           value: formatPercent(scoring.roe_percent),
  392:           score: scoring.roe_score ?? 0,
  393:           maxScore: scoring.roe_max_score ?? 29,
  394:           note: "Laba bersih dibandingkan total ekuitas/modal pemilik.",
  395:         },
  396:         {
  397:           no: 2,
  398:           name: "Imbalan Investasi / ROI",
  399:           value: formatPercent(scoring.roi_percent),
```

```tsx
  704:                       </p>
  705:                       <p className="mt-1 text-sm leading-6 text-emerald-800">
  706:                         Status neraca:{" "}
  707:                         <span className="font-bold">
  708:                           {scoring.accounting_consistency_status ?? "-"}
  709:                         </span>
  710:                         . Dashboard ini membaca view{" "}
  711:                         <span className="font-bold">
  712:                           v_unit_financial_health_scoring
  713:                         </span>
  714:                         , sehingga rumus tetap berada di database.
  715:                       </p>
  716:                     </div>
  717:                   </div>
  718:                 </div>
  719:               </div>
  720:             </Card>
  721:           </section>
  722: 
  723:           <Card className="border-blue-100 bg-blue-50">
  724:             <div className="flex items-start gap-3">
  725:               <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-700">
  726:                 <Gauge className="h-5 w-5" />
  727:               </div>
  728: 
  729:               <div>
  730:                 <p className="text-sm font-bold text-blue-900">
  731:                   Visual baru skoring
  732:                 </p>
  733:                 <p className="mt-2 text-sm leading-6 text-blue-800">
  734:                   Kartu gauge kini memakai jarum animatif yang bergerak sesuai
  735:                   skor. Kotak visual kanan kini memakai line chart untuk
  736:                   memperjelas pola capaian skor per indikator. Jika nanti ingin
  737:                   line chart bulanan real, kita bisa lanjutkan dari view bulanan.
```

