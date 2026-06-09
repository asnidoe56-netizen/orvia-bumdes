import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  CapitalExpenditureFormClient,
  type AssetCategory,
  type CashBankAccount,
  type Supplier,
} from "./capital-expenditure-form-client";

export async function CapitalExpenditureEntryForm() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [categoryResult, supplierResult, cashBankResult] = await Promise.all([
    supabase
      .from("capital_expenditure_categories")
      .select(
        "id, category_code, category_name, default_useful_life_months, is_depreciable"
      )
      .eq("is_active", true)
      .order("category_name", { ascending: true }),

    supabase
      .from("suppliers")
      .select("id, supplier_code, supplier_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("supplier_name", { ascending: true }),

    supabase
      .from("cash_bank_accounts")
      .select("id, account_code, account_name, account_kind")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("account_code", { ascending: true }),
  ]);

  if (categoryResult.error) throw new Error(categoryResult.error.message);
  if (supplierResult.error) throw new Error(supplierResult.error.message);
  if (cashBankResult.error) throw new Error(cashBankResult.error.message);

  const assetCategories = (categoryResult.data ?? []) as AssetCategory[];
  const suppliers = (supplierResult.data ?? []) as Supplier[];
  const cashBankAccounts = (cashBankResult.data ?? []) as CashBankAccount[];

  return (
    <div className="space-y-3">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <CapitalExpenditureFormClient
        assetCategories={assetCategories}
        suppliers={suppliers}
        cashBankAccounts={cashBankAccounts}
      />
    </div>
  );
}
