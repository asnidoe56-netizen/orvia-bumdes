import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoginContext } from "@/types/auth";

export type AssistantExpenseAccountOption = {
  id: string;
  kode: string;
  nama: string;
};

export type AssistantRevenueAccountOption = {
  id: string;
  kode: string;
  nama: string;
};

export type AssistantCashBankAccountOption = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

export type OperationalExpenseAssistantOptions = {
  expenseAccounts: AssistantExpenseAccountOption[];
  cashBankAccounts: AssistantCashBankAccountOption[];
};

export type RevenueReceiptAssistantOptions = {
  revenueAccounts: AssistantRevenueAccountOption[];
  cashBankAccounts: AssistantCashBankAccountOption[];
};

function assertUnitContext(context: LoginContext | null) {
  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  return {
    tenantId: context.tenant_id,
    unitId: context.unit_id,
  };
}

async function getCashBankAssistantOptions(
  supabase: SupabaseClient,
  tenantId: string,
  unitId: string
): Promise<AssistantCashBankAccountOption[]> {
  const { data: cashBankAccounts, error: cashBankAccountsError } =
    await supabase
      .from("v_cash_bank_balance")
      .select(
        "cash_bank_account_id, account_code, account_name, account_kind, current_balance"
      )
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .order("account_code", { ascending: true });

  if (cashBankAccountsError) {
    throw new Error(cashBankAccountsError.message);
  }

  return (cashBankAccounts ?? [])
    .filter((account) => Boolean(account.cash_bank_account_id))
    .map((account) => ({
      id: account.cash_bank_account_id as string,
      account_code: account.account_code ?? "",
      account_name: account.account_name ?? "",
      account_kind: account.account_kind ?? "",
      current_balance: Number(account.current_balance ?? 0),
    }));
}

/**
 * Read-only assistant tool.
 *
 * Batas keras:
 * - hanya membaca akun beban aktif
 * - hanya membaca kas/bank dan saldo unit
 * - tidak insert
 * - tidak update
 * - tidak delete
 * - tidak posting
 * - tidak memanggil RPC transaksi
 */
export async function getOperationalExpenseAssistantOptions(
  supabase: SupabaseClient,
  context: LoginContext | null
): Promise<OperationalExpenseAssistantOptions> {
  const { tenantId, unitId } = assertUnitContext(context);

  const { data: expenseAccounts, error: expenseAccountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .eq("tipe", "beban")
    .eq("account_type", "BEBAN")
    .eq("normal_balance", "debit")
    .eq("is_active", true)
    .eq("is_postable", true)
    .order("kode", { ascending: true });

  if (expenseAccountsError) {
    throw new Error(expenseAccountsError.message);
  }

  return {
    expenseAccounts: (expenseAccounts ?? []).map((account) => ({
      id: account.id,
      kode: account.kode,
      nama: account.nama,
    })),
    cashBankAccounts: await getCashBankAssistantOptions(
      supabase,
      tenantId,
      unitId
    ),
  };
}

/**
 * Read-only assistant tool untuk Terima Pendapatan.
 *
 * Batas keras:
 * - hanya membaca akun pendapatan yang memang dipakai form
 * - hanya membaca kas/bank dan saldo unit
 * - tidak insert
 * - tidak update
 * - tidak delete
 * - tidak posting
 * - tidak memanggil RPC transaksi
 */
export async function getRevenueReceiptAssistantOptions(
  supabase: SupabaseClient,
  context: LoginContext | null
): Promise<RevenueReceiptAssistantOptions> {
  const { tenantId, unitId } = assertUnitContext(context);

  const { data: revenueAccounts, error: revenueAccountsError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .eq("tipe", "pendapatan")
    .eq("account_type", "PENDAPATAN")
    .eq("normal_balance", "credit")
    .eq("is_active", true)
    .eq("is_postable", true)
    .in("kode", ["4200", "4310", "4400"])
    .order("kode", { ascending: true });

  if (revenueAccountsError) {
    throw new Error(revenueAccountsError.message);
  }

  return {
    revenueAccounts: (revenueAccounts ?? []).map((account) => ({
      id: account.id,
      kode: account.kode,
      nama: account.nama,
    })),
    cashBankAccounts: await getCashBankAssistantOptions(
      supabase,
      tenantId,
      unitId
    ),
  };
}

export type AssistantPurchaseSupplierOption = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

export type AssistantPurchaseInventoryItemOption = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
};

export type CashPurchaseAssistantOptions = {
  suppliers: AssistantPurchaseSupplierOption[];
  items: AssistantPurchaseInventoryItemOption[];
};

/**
 * Read-only assistant tool untuk Pembelian Tunai.
 *
 * Batas keras:
 * - hanya membaca supplier aktif unit
 * - hanya membaca barang persediaan aktif unit
 * - tidak membaca/memilih kas-bank
 * - tidak insert
 * - tidak update
 * - tidak delete
 * - tidak posting
 * - tidak memanggil RPC transaksi
 */
export async function getCashPurchaseAssistantOptions(
  supabase: SupabaseClient,
  context: LoginContext | null
): Promise<CashPurchaseAssistantOptions> {
  const { tenantId, unitId } = assertUnitContext(context);

  const [supplierResult, itemResult] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_code, supplier_name")
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .order("supplier_name", { ascending: true }),

    supabase
      .from("inventory_items")
      .select("id, item_code, item_name, unit_of_measure")
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .order("item_name", { ascending: true }),
  ]);

  if (supplierResult.error) {
    throw new Error(supplierResult.error.message);
  }

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  return {
    suppliers: (supplierResult.data ?? []).map((supplier) => ({
      id: supplier.id,
      supplier_code: supplier.supplier_code ?? "",
      supplier_name: supplier.supplier_name ?? "",
    })),
    items: (itemResult.data ?? []).map((item) => ({
      id: item.id,
      item_code: item.item_code ?? "",
      item_name: item.item_name ?? "",
      unit_of_measure: item.unit_of_measure ?? "",
    })),
  };
}

export type AssistantSaleCustomerOption = {
  id: string;
  customer_code: string;
  customer_name: string;
};

export type AssistantSaleInventoryItemOption = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  default_sales_price: number;
  active_sales_price: number | null;
  current_stock: number;
};

export type CashSaleAssistantOptions = {
  customers: AssistantSaleCustomerOption[];
  items: AssistantSaleInventoryItemOption[];
};

/**
 * Read-only assistant tool untuk Jual Tunai.
 *
 * Batas keras:
 * - hanya membaca pelanggan aktif
 * - hanya membaca barang stok aktif dan saldo stok ringkas
 * - tidak membaca/mengubah harga jual sebagai input bebas
 * - tidak insert
 * - tidak update
 * - tidak delete
 * - tidak posting
 * - tidak memanggil RPC transaksi
 */
export async function getCashSaleAssistantOptions(
  supabase: SupabaseClient,
  context: LoginContext | null
): Promise<CashSaleAssistantOptions> {
  const { tenantId, unitId } = assertUnitContext(context);

  const [customerResult, itemResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_code, customer_name")
      .eq("tenant_id", tenantId)
      .or(`unit_id.eq.${unitId},unit_id.is.null`)
      .eq("is_active", true)
      .order("customer_name", { ascending: true }),

    supabase
      .from("v_inventory_item_stock_summary")
      .select(
        "id, item_code, item_name, unit_of_measure, default_sales_price, active_sales_price, current_stock"
      )
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .eq("item_type", "stock")
      .order("item_name", { ascending: true }),
  ]);

  if (customerResult.error) {
    throw new Error(customerResult.error.message);
  }

  if (itemResult.error) {
    throw new Error(itemResult.error.message);
  }

  return {
    customers: (customerResult.data ?? []).map((customer) => ({
      id: customer.id,
      customer_code: customer.customer_code ?? "",
      customer_name: customer.customer_name ?? "",
    })),
    items: (itemResult.data ?? []).map((item) => ({
      id: item.id,
      item_code: item.item_code ?? "",
      item_name: item.item_name ?? "",
      unit_of_measure: item.unit_of_measure ?? "",
      default_sales_price: Number(item.default_sales_price ?? 0),
      active_sales_price:
        item.active_sales_price === null || item.active_sales_price === undefined
          ? null
          : Number(item.active_sales_price),
      current_stock: Number(item.current_stock ?? 0),
    })),
  };
}

export type AssistantSupplierPayableInvoiceOption = {
  purchase_invoice_id: string;
  supplier_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  outstanding_amount: number;
  payable_status: string;
};

export type SupplierDebtPaymentAssistantOptions = {
  payables: AssistantSupplierPayableInvoiceOption[];
  cashBankAccounts: AssistantCashBankAccountOption[];
};

/**
 * Read-only helper for Supplier Debt Payment assistant.
 *
 * Hard boundary:
 * - no insert
 * - no update
 * - no delete
 * - no transaction RPC
 * - no journal posting
 * - no cash-bank mutation
 * - no payable mutation
 */
export async function getSupplierDebtPaymentAssistantOptions(
  supabase: SupabaseClient,
  context: LoginContext | null
): Promise<SupplierDebtPaymentAssistantOptions> {
  const { tenantId, unitId } = assertUnitContext(context);

  const [payablesResult, cashBankResult, balanceResult] = await Promise.all([
    supabase
      .from("v_purchase_invoice_payables")
      .select(
        "purchase_invoice_id, supplier_name, invoice_no, invoice_date, due_date, outstanding_amount, payable_status"
      )
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .gt("outstanding_amount", 0)
      .order("invoice_date", { ascending: true })
      .order("invoice_no", { ascending: true }),

    supabase
      .from("cash_bank_accounts")
      .select("id, account_code, account_name, account_kind")
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId)
      .eq("is_active", true)
      .order("account_code", { ascending: true }),

    supabase
      .from("v_cash_bank_balance")
      .select("cash_bank_account_id, current_balance")
      .eq("tenant_id", tenantId)
      .eq("unit_id", unitId),
  ]);

  if (payablesResult.error) {
    throw new Error(payablesResult.error.message);
  }

  if (cashBankResult.error) {
    throw new Error(cashBankResult.error.message);
  }

  if (balanceResult.error) {
    throw new Error(balanceResult.error.message);
  }

  const balanceByAccount = new Map<string, number>(
    (balanceResult.data ?? []).map((balance) => [
      String(balance.cash_bank_account_id),
      Number(balance.current_balance ?? 0),
    ])
  );

  return {
    payables: (payablesResult.data ?? []).map((invoice) => ({
      purchase_invoice_id: String(invoice.purchase_invoice_id),
      supplier_name: invoice.supplier_name
        ? String(invoice.supplier_name)
        : null,
      invoice_no: String(invoice.invoice_no),
      invoice_date: String(invoice.invoice_date),
      due_date: invoice.due_date ? String(invoice.due_date) : null,
      outstanding_amount: Number(invoice.outstanding_amount ?? 0),
      payable_status: String(invoice.payable_status ?? ""),
    })),

    cashBankAccounts: (cashBankResult.data ?? []).map((account) => ({
      id: String(account.id),
      account_code: String(account.account_code),
      account_name: String(account.account_name),
      account_kind: String(account.account_kind),
      current_balance: balanceByAccount.get(String(account.id)) ?? 0,
    })),
  };
}


