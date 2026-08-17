import { redirect } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";
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

const ITEM_COLUMNS_WITH_ACTIVE_PRICE =
  "id, item_code, item_name, unit_of_measure, default_sales_price, active_sales_price, current_stock";

const ITEM_COLUMNS_BASE =
  "id, item_code, item_name, unit_of_measure, default_sales_price, current_stock";

/**
 * Kolom yang diminta tidak ada di database ini. Skema produksi bisa tertinggal
 * dari repo (lihat AUDIT_KESIAPAN_123_DESA.md T-04), dan `active_sales_price`
 * baru ditambahkan oleh migrasi 20260603112918.
 */
function isUndefinedColumn(error: PostgrestError | null, column: string) {
  if (!error) return false;

  return (
    error.code === "42703" ||
    new RegExp(`column .*${column}.* does not exist`, "i").test(
      error.message ?? ""
    )
  );
}

function DataErrorPanel({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-red-100 bg-white p-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </div>

      <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Form penjualan belum bisa ditampilkan karena data acuan gagal diambil
        dari database. Tidak ada transaksi yang tersimpan. Sampaikan keterangan
        di bawah ke tim teknis.
      </p>

      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs leading-5 text-slate-700">
        {detail}
      </p>
    </div>
  );
}

export async function SalesEntryForm({
  paymentType,
  submitLabel,
}: SalesEntryFormProps) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const itemQuery = (columns: string) =>
    supabase
      .from("v_inventory_item_stock_summary")
      .select(columns)
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .eq("item_type", "stock")
      .order("item_name", { ascending: true });

  const [customerResult, itemResultWithPrice] = await Promise.all([
    supabase
      .from("customers")
      .select("id, customer_code, customer_name")
      .eq("tenant_id", context.tenant_id)
      .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
      .eq("is_active", true)
      .order("customer_name", { ascending: true }),

    itemQuery(ITEM_COLUMNS_WITH_ACTIVE_PRICE),
  ]);

  // Harga aktif hanya pelengkap tampilan — harga yang dipakai saat posting
  // tetap dihitung ulang oleh database. Kalau kolomnya belum ada di skema
  // produksi, form tetap harus bisa dibuka, bukan berubah jadi layar error.
  const itemResult = isUndefinedColumn(
    itemResultWithPrice.error,
    "active_sales_price"
  )
    ? await itemQuery(ITEM_COLUMNS_BASE)
    : itemResultWithPrice;

  if (customerResult.error || itemResult.error) {
    const failed = customerResult.error ? "pelanggan" : "barang";
    const error = customerResult.error ?? itemResult.error;

    return (
      <div className="space-y-3">
        <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

        <DataErrorPanel
          title={`Daftar ${failed} gagal dimuat`}
          detail={`${error?.code ?? "-"}: ${error?.message ?? "Penyebab tidak diketahui."}`}
        />
      </div>
    );
  }

  const customers = (customerResult.data ?? []) as Customer[];
  const items = (itemResult.data ?? []) as unknown as InventoryItem[];

  return (
    <div className="space-y-3">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <SalesEntryFormClient
        paymentType={paymentType}
        submitLabel={submitLabel}
        customers={customers}
        items={items}
      />
    </div>
  );
}
