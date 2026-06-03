import { ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { SalesEntryFormClient } from "./sales-entry-form-client";

type PaymentType = "cash" | "credit";

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
};

type InventoryItem = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  default_sales_price: number;
  active_sales_price?: number | null;
  current_stock: number;
};

type SalesEntryFormProps = {
  paymentType: PaymentType;
  title: string;
  subtitle: string;
  eyebrow: string;
  submitLabel: string;
};

export async function SalesEntryForm({
  paymentType,
  title,
  subtitle,
  eyebrow,
  submitLabel,
}: SalesEntryFormProps) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [customerResult, itemResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_code, customer_name")
      .eq("tenant_id", context.tenant_id)
      .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
      .eq("is_active", true)
      .order("customer_name", { ascending: true }),

    supabase
      .from("v_inventory_item_stock_summary")
      .select("id, item_code, item_name, unit_of_measure, default_sales_price, active_sales_price, current_stock")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .eq("item_type", "stock")
      .order("item_name", { ascending: true }),
  ]);

  if (customerResult.error) throw new Error(customerResult.error.message);
  if (itemResult.error) throw new Error(itemResult.error.message);

  const customers = (customerResult.data ?? []) as Customer[];
  const items = (itemResult.data ?? []) as InventoryItem[];

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              {eyebrow}
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {title}
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <ReceiptText className="h-6 w-6" />
          </div>
        </div>
      </section>

      <SalesEntryFormClient
        paymentType={paymentType}
        submitLabel={submitLabel}
        customers={customers}
        items={items}
      />
    </div>
  );
}