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

export type AiSupplierPayableRow = {
  purchase_invoice_id: string;
  unit_id: string | null;
  supplier_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number;
  payment_amount: number;
  outstanding_amount: number;
  payable_status: string;
};

type SupplierPayableDbRow = {
  purchase_invoice_id: string | null;
  unit_id: string | null;
  supplier_name: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total_amount: number | string | null;
  payment_amount: number | string | null;
  outstanding_amount: number | string | null;
  payable_status: string | null;
};

/**
 * Read-only ORVIA AI tool.
 *
 * Purpose:
 * - Read tenant-bound supplier payables for AI answers and future MCP tools.
 *
 * Hard boundaries:
 * - no insert
 * - no update
 * - no delete
 * - no posting
 * - no journal mutation
 * - no payable mutation
 * - no cash/bank mutation
 * - tenant_id and unit_id are derived from authenticated login context only
 */
export async function getAiSupplierPayables(prompt?: string | null) {
  const supabase = await createClient();
  const context = await getOrviaAiContext();

  assertAiRoleAllowed(context, "read.payables");
  assertAiTenantScope(context);
  assertAiUnitScope(context);

  const scopeFilter = getAiReadableScopeFilter(context);

  let query = supabase
    .from("v_purchase_invoice_payables")
    .select(
      "purchase_invoice_id, unit_id, supplier_name, invoice_no, invoice_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
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
    throw new Error(`Gagal membaca hutang supplier: ${error.message}`);
  }

  const rows: AiSupplierPayableRow[] = (
    (data ?? []) as SupplierPayableDbRow[]
  )
    .filter((row) => Boolean(row.purchase_invoice_id))
    .map((row) => ({
      purchase_invoice_id: row.purchase_invoice_id as string,
      unit_id: row.unit_id ?? null,
      supplier_name: row.supplier_name ?? null,
      invoice_no: row.invoice_no ?? "-",
      invoice_date: row.invoice_date ?? "-",
      due_date: row.due_date ?? null,
      total_amount: toNumber(row.total_amount),
      payment_amount: toNumber(row.payment_amount),
      outstanding_amount: toNumber(row.outstanding_amount),
      payable_status: row.payable_status ?? "-",
    }));

  const totalOutstanding = rows.reduce(
    (sum, row) => sum + row.outstanding_amount,
    0
  );

  const largestPayables = [...rows]
    .sort((a, b) => b.outstanding_amount - a.outstanding_amount)
    .slice(0, 5);

  await logOrviaAiToolUsage(supabase, context, {
    toolName: "orvia.read.supplier_payables",
    permission: "read.payables",
    prompt: prompt ?? null,
    summary: "ORVIA AI membaca daftar hutang supplier.",
    metadata: {
      row_count: rows.length,
      total_outstanding: totalOutstanding,
      largest_payable_count: largestPayables.length,
    },
  });

  return {
    mode: "read_only",
    tool: "orvia.read.supplier_payables",
    requires_user_confirmation: false,
    scope: scopeFilter.scope,
    tenant_id: context.tenantId,
    unit_id: scopeFilter.unitId,
    totals: {
      outstanding: totalOutstanding,
      invoice_count: rows.length,
    },
    largest_payables: largestPayables,
    rows,
  };
}

export type AiInventoryPositionRow = {
  item_id: string;
  unit_id: string | null;
  item_code: string;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  item_type: string;
  minimum_stock: number;
  default_sales_price: number;
  current_stock: number;
  last_purchase_price: number;
  average_unit_cost: number;
  inventory_value: number;
  stock_status: string;
  is_active: boolean;
};

type InventoryPositionDbRow = {
  id: string | null;
  unit_id: string | null;
  item_code: string | null;
  item_name: string | null;
  description: string | null;
  unit_of_measure: string | null;
  item_type: string | null;
  minimum_stock: number | string | null;
  default_sales_price: number | string | null;
  current_stock: number | string | null;
  last_purchase_price: number | string | null;
  average_unit_cost: number | string | null;
  inventory_value: number | string | null;
  stock_status: string | null;
  is_active: boolean | null;
};

/**
 * Read-only ORVIA AI tool.
 *
 * Purpose:
 * - Read tenant-bound inventory position for AI answers and future MCP tools.
 *
 * Hard boundaries:
 * - no insert
 * - no update
 * - no delete
 * - no posting
 * - no journal mutation
 * - no inventory mutation
 * - no stock mutation
 * - tenant_id and unit_id are derived from authenticated login context only
 */
export async function getAiInventoryPosition(prompt?: string | null) {
  const supabase = await createClient();
  const context = await getOrviaAiContext();

  assertAiRoleAllowed(context, "read.inventory");
  assertAiTenantScope(context);
  assertAiUnitScope(context);

  const scopeFilter = getAiReadableScopeFilter(context);

  let query = supabase
    .from("v_inventory_item_stock_summary")
    .select(
      "id, unit_id, item_code, item_name, description, unit_of_measure, item_type, minimum_stock, default_sales_price, current_stock, last_purchase_price, average_unit_cost, inventory_value, stock_status, is_active"
    )
    .eq("tenant_id", scopeFilter.tenantId)
    .eq("item_type", "stock")
    .eq("is_active", true)
    .order("item_name", { ascending: true });

  if (scopeFilter.scope === "unit") {
    query = query.eq("unit_id", scopeFilter.unitId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Gagal membaca posisi stok: ${error.message}`);
  }

  const rows: AiInventoryPositionRow[] = (
    (data ?? []) as InventoryPositionDbRow[]
  )
    .filter((row) => Boolean(row.id))
    .map((row) => ({
      item_id: row.id as string,
      unit_id: row.unit_id ?? null,
      item_code: row.item_code ?? "-",
      item_name: row.item_name ?? "-",
      description: row.description ?? null,
      unit_of_measure: row.unit_of_measure ?? "-",
      item_type: row.item_type ?? "-",
      minimum_stock: toNumber(row.minimum_stock),
      default_sales_price: toNumber(row.default_sales_price),
      current_stock: toNumber(row.current_stock),
      last_purchase_price: toNumber(row.last_purchase_price),
      average_unit_cost: toNumber(row.average_unit_cost),
      inventory_value: toNumber(row.inventory_value),
      stock_status: row.stock_status ?? "-",
      is_active: Boolean(row.is_active),
    }));

  const totalInventoryValue = rows.reduce(
    (sum, row) => sum + row.inventory_value,
    0
  );

  const lowOrEmptyItems = rows.filter(
    (row) => row.stock_status === "low" || row.stock_status === "empty"
  );

  const largestInventoryValueItems = [...rows]
    .sort((a, b) => b.inventory_value - a.inventory_value)
    .slice(0, 5);

  await logOrviaAiToolUsage(supabase, context, {
    toolName: "orvia.read.inventory_position",
    permission: "read.inventory",
    prompt: prompt ?? null,
    summary: "ORVIA AI membaca posisi stok barang.",
    metadata: {
      row_count: rows.length,
      low_or_empty_count: lowOrEmptyItems.length,
      total_inventory_value: totalInventoryValue,
      largest_inventory_value_count: largestInventoryValueItems.length,
    },
  });

  return {
    mode: "read_only",
    tool: "orvia.read.inventory_position",
    requires_user_confirmation: false,
    scope: scopeFilter.scope,
    tenant_id: context.tenantId,
    unit_id: scopeFilter.unitId,
    totals: {
      item_count: rows.length,
      low_or_empty_count: lowOrEmptyItems.length,
      inventory_value: totalInventoryValue,
    },
    low_or_empty_items: lowOrEmptyItems,
    largest_inventory_value_items: largestInventoryValueItems,
    rows,
  };
}

/**
 * Read-only ORVIA AI summary tool.
 *
 * Purpose:
 * - Combine existing read-only tools into one unit health summary.
 *
 * Hard boundaries:
 * - no insert
 * - no update
 * - no delete
 * - no posting
 * - no journal mutation
 * - no cash/bank mutation
 * - no receivable mutation
 * - no payable mutation
 * - no inventory mutation
 * - no stock mutation
 * - tenant_id and unit_id are derived from authenticated login context only
 */
export async function getAiUnitHealthSummary(prompt?: string | null) {
  const [
    cashBank,
    customerReceivables,
    supplierPayables,
    inventoryPosition,
  ] = await Promise.all([
    getAiCashBankPosition(prompt ?? "Ringkasan kesehatan unit: posisi kas/bank."),
    getAiCustomerReceivables(prompt ?? "Ringkasan kesehatan unit: piutang pelanggan."),
    getAiSupplierPayables(prompt ?? "Ringkasan kesehatan unit: hutang supplier."),
    getAiInventoryPosition(prompt ?? "Ringkasan kesehatan unit: posisi stok."),
  ]);

  const cashBankBalance = cashBank.totals.balance;
  const receivableOutstanding = customerReceivables.totals.outstanding;
  const supplierPayableOutstanding = supplierPayables.totals.outstanding;
  const inventoryValue = inventoryPosition.totals.inventory_value;

  const netLiquidPosition =
    cashBankBalance + receivableOutstanding - supplierPayableOutstanding;

  const attentionNotes: string[] = [];

  if (supplierPayableOutstanding > cashBankBalance) {
    attentionNotes.push(
      "Hutang supplier lebih besar dari saldo kas/bank. Perlu perhatian sebelum melakukan pembayaran baru."
    );
  }

  if (customerReceivables.totals.invoice_count > 0) {
    attentionNotes.push(
      "Masih ada piutang pelanggan terbuka. Perlu pemantauan penagihan."
    );
  }

  if (inventoryPosition.totals.low_or_empty_count > 0) {
    attentionNotes.push(
      "Ada barang dengan stok rendah atau kosong. Perlu pemeriksaan persediaan."
    );
  }

  if (attentionNotes.length === 0) {
    attentionNotes.push(
      "Tidak ada catatan perhatian utama dari kas/bank, piutang, hutang supplier, dan stok."
    );
  }

  return {
    mode: "read_only",
    tool: "orvia.read.unit_health_summary",
    requires_user_confirmation: false,
    scope: cashBank.scope,
    tenant_id: cashBank.tenant_id,
    unit_id: cashBank.unit_id,
    summary: {
      cash_bank_balance: cashBankBalance,
      customer_receivable_outstanding: receivableOutstanding,
      supplier_payable_outstanding: supplierPayableOutstanding,
      inventory_value: inventoryValue,
      net_liquid_position: netLiquidPosition,
      customer_receivable_invoice_count:
        customerReceivables.totals.invoice_count,
      supplier_payable_invoice_count: supplierPayables.totals.invoice_count,
      inventory_item_count: inventoryPosition.totals.item_count,
      low_or_empty_inventory_count: inventoryPosition.totals.low_or_empty_count,
    },
    attention_notes: attentionNotes,
    highlights: {
      cash_bank_rows: cashBank.rows,
      largest_receivables: customerReceivables.largest_receivables,
      largest_payables: supplierPayables.largest_payables,
      low_or_empty_items: inventoryPosition.low_or_empty_items,
      largest_inventory_value_items:
        inventoryPosition.largest_inventory_value_items,
    },
  };
}
