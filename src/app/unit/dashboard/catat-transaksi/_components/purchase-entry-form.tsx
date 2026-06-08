import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { PurchaseEntryClientForm } from "./purchase-entry-client-form";

type PaymentType = "cash" | "credit";

export type PurchaseSupplierOption = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

export type PurchaseInventoryItemOption = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
};

type PurchaseEntryFormProps = {
  paymentType: PaymentType;
  title: string;
  subtitle: string;
  eyebrow: string;
  submitLabel: string;
};

export async function PurchaseEntryForm({
  paymentType,
  title,
  subtitle,
  eyebrow,
  submitLabel,
}: PurchaseEntryFormProps) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [supplierResult, itemResult] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_code, supplier_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("supplier_name", { ascending: true }),

    supabase
      .from("inventory_items")
      .select("id, item_code, item_name, unit_of_measure")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("item_name", { ascending: true }),
  ]);

  if (supplierResult.error) throw new Error(supplierResult.error.message);
  if (itemResult.error) throw new Error(itemResult.error.message);

  const suppliers = (supplierResult.data ?? []) as PurchaseSupplierOption[];
  const items = (itemResult.data ?? []) as PurchaseInventoryItemOption[];

  return (
    <div className="space-y-3">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <PurchaseEntryClientForm
        paymentType={paymentType}
        title={title}
        subtitle={subtitle}
        eyebrow={eyebrow}
        submitLabel={submitLabel}
        suppliers={suppliers}
        items={items}
      />
    </div>
  );
}
