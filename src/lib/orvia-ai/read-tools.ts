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
