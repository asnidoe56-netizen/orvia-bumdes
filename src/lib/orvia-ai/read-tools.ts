import { createClient } from "@/lib/supabase/server";
import { getOrviaAiContext } from "./context";
import {
  assertAiRoleAllowed,
  assertAiTenantScope,
  assertAiUnitScope,
  getAiReadableScopeFilter,
} from "./permissions";
import { logOrviaAiToolUsage } from "./audit";

export type AiCashBankPositionRow = {
  cash_bank_account_id: string;
  unit_id: string | null;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

type CashBankBalanceDbRow = {
  cash_bank_account_id: string | null;
  unit_id: string | null;
  account_code: string | null;
  account_name: string | null;
  account_kind: string | null;
  current_balance: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  const numericValue =
    typeof value === "string" ? Number(value) : value ?? 0;

  return Number.isFinite(numericValue) ? Number(numericValue) : 0;
}

/**
 * Read-only ORVIA AI tool.
 *
 * Purpose:
 * - Read tenant-bound cash/bank position for AI answers and future MCP tools.
 *
 * Hard boundaries:
 * - no insert
 * - no update
 * - no delete
 * - no posting
 * - no journal mutation
 * - no cash/bank mutation
 * - tenant_id and unit_id are derived from authenticated login context only
 */
export async function getAiCashBankPosition(prompt?: string | null) {
  const supabase = await createClient();
  const context = await getOrviaAiContext();

  assertAiRoleAllowed(context, "read.cash_bank");
  assertAiTenantScope(context);
  assertAiUnitScope(context);

  const scopeFilter = getAiReadableScopeFilter(context);

  let query = supabase
    .from("v_cash_bank_balance")
    .select(
      "cash_bank_account_id, unit_id, account_code, account_name, account_kind, current_balance"
    )
    .eq("tenant_id", scopeFilter.tenantId)
    .in("account_kind", ["cash", "bank"])
    .order("account_kind", { ascending: true })
    .order("account_code", { ascending: true });

  if (scopeFilter.scope === "unit") {
    query = query.eq("unit_id", scopeFilter.unitId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal membaca posisi kas/bank: ${error.message}`);
  }

  const rows: AiCashBankPositionRow[] = ((data ?? []) as CashBankBalanceDbRow[])
    .filter((row) => Boolean(row.cash_bank_account_id))
    .map((row) => ({
      cash_bank_account_id: row.cash_bank_account_id as string,
      unit_id: row.unit_id ?? null,
      account_code: row.account_code ?? "-",
      account_name: row.account_name ?? "-",
      account_kind: row.account_kind ?? "-",
      current_balance: toNumber(row.current_balance),
    }));

  const totalCash = rows
    .filter((row) => row.account_kind === "cash")
    .reduce((sum, row) => sum + row.current_balance, 0);

  const totalBank = rows
    .filter((row) => row.account_kind === "bank")
    .reduce((sum, row) => sum + row.current_balance, 0);

  const totalBalance = totalCash + totalBank;

  await logOrviaAiToolUsage(supabase, context, {
    toolName: "orvia.read.cash_bank_position",
    permission: "read.cash_bank",
    prompt: prompt ?? null,
    summary: "ORVIA AI membaca posisi kas/bank.",
    metadata: {
      row_count: rows.length,
      total_cash: totalCash,
      total_bank: totalBank,
      total_balance: totalBalance,
    },
  });

  return {
    mode: "read_only",
    tool: "orvia.read.cash_bank_position",
    requires_user_confirmation: false,
    scope: scopeFilter.scope,
    tenant_id: context.tenantId,
    unit_id: scopeFilter.unitId,
    totals: {
      cash: totalCash,
      bank: totalBank,
      balance: totalBalance,
    },
    rows,
  };
}

export type AiCustomerReceivableRow = {
  sales_invoice_id: string;
  unit_id: string | null;
  customer_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  paid_amount: number;
  outstanding_amount: number;
  receivable_status: string;
};

type CustomerReceivableDbRow = {
  sales_invoice_id: string | null;
  unit_id: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number | string | null;
  paid_amount: number | string | null;
  outstanding_amount: number | string | null;
  receivable_status: string | null;
};

/**
 * Read-only ORVIA AI tool.
 *
 * Purpose:
 * - Read tenant-bound customer receivables for AI answers and future MCP tools.
 *
 * Hard boundaries:
 * - no insert
 * - no update
 * - no delete
 * - no posting
 * - no journal mutation
 * - no receivable mutation
 * - no cash/bank mutation
 * - tenant_id and unit_id are derived from authenticated login context only
 */
export async function getAiCustomerReceivables(prompt?: string | null) {
  const supabase = await createClient();
  const context = await getOrviaAiContext();

  assertAiRoleAllowed(context, "read.receivables");
  assertAiTenantScope(context);
  assertAiUnitScope(context);

  const scopeFilter = getAiReadableScopeFilter(context);

  let query = supabase
    .from("v_sales_invoice_receivables")
    .select(
      "sales_invoice_id, unit_id, customer_name, invoice_no, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, receivable_status"
    )
    .eq("tenant_id", scopeFilter.tenantId)
    .gt("outstanding_amount", 0)
    .order("invoice_date", { ascending: true })
    .order("invoice_no", { ascending: true });

  if (scopeFilter.scope === "unit") {
    query = query.eq("unit_id", scopeFilter.unitId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal membaca piutang pelanggan: ${error.message}`);
  }

  const rows: AiCustomerReceivableRow[] = (
    (data ?? []) as CustomerReceivableDbRow[]
  )
    .filter((row) => Boolean(row.sales_invoice_id))
    .map((row) => ({
      sales_invoice_id: row.sales_invoice_id as string,
      unit_id: row.unit_id ?? null,
      customer_name: row.customer_name ?? null,
      invoice_no: row.invoice_no ?? "-",
      invoice_date: row.invoice_date ?? "-",
      due_date: row.due_date ?? null,
      total_amount: toNumber(row.total_amount),
      paid_amount: toNumber(row.paid_amount),
      outstanding_amount: toNumber(row.outstanding_amount),
      receivable_status: row.receivable_status ?? "-",
    }));

  const totalOutstanding = rows.reduce(
    (sum, row) => sum + row.outstanding_amount,
    0
  );

  const largestReceivables = [...rows]
    .sort((a, b) => b.outstanding_amount - a.outstanding_amount)
    .slice(0, 5);

  await logOrviaAiToolUsage(supabase, context, {
    toolName: "orvia.read.customer_receivables",
    permission: "read.receivables",
    prompt: prompt ?? null,
    summary: "ORVIA AI membaca daftar piutang pelanggan.",
    metadata: {
      row_count: rows.length,
      total_outstanding: totalOutstanding,
      largest_receivable_count: largestReceivables.length,
    },
  });

  return {
    mode: "read_only",
    tool: "orvia.read.customer_receivables",
    requires_user_confirmation: false,
    scope: scopeFilter.scope,
    tenant_id: context.tenantId,
    unit_id: scopeFilter.unitId,
    totals: {
      outstanding: totalOutstanding,
      invoice_count: rows.length,
    },
    largest_receivables: largestReceivables,
    rows,
  };
}
