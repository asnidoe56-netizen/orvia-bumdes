import { PlusCircle, ReceiptText } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createAndPostSalesInvoice } from "../_actions/sales-actions";

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
      .from("inventory_items")
      .select("id, item_code, item_name, unit_of_measure")
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
  const isCredit = paymentType === "credit";

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

      <form action={createAndPostSalesInvoice} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="payment_type" value={paymentType} />

        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <PlusCircle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Data Penjualan
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Isi transaksi dalam bahasa operasional. Nomor transaksi dibuat otomatis, lalu engine database langsung memproses kas masuk, stok keluar, HPP, pendapatan, dan pencatatan keuangan.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Tanggal Penjualan
            </span>
            <input
              name="invoice_date"
              type="date"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Pelanggan
            </span>
            <select
              name="customer_id"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Umum / tanpa pelanggan</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code} - {customer.customer_name}
                </option>
              ))}
            </select>
          </label>

          {isCredit ? (
            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Tanggal Jatuh Tempo
              </span>
              <input
                name="due_date"
                type="date"
                required
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          ) : null}

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Barang
            </span>
            <select
              name="item_id"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Pilih barang</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_code} - {item.item_name} ({item.unit_of_measure})
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Jumlah
            </span>
            <input
              name="quantity"
              type="number"
              min="0.01"
              step="0.01"
              required
              placeholder="Contoh: 1"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Harga Jual per Barang
            </span>
            <input
              name="unit_price"
              type="number"
              min="0"
              step="0.01"
              required
              placeholder="Contoh: 800000"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Diskon
            </span>
            <input
              name="discount_amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Pajak
            </span>
            <input
              name="tax_amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue="0"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Catatan
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Catatan penjualan"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Saat disimpan, engine database menolak stok minus. Jika persediaan tidak cukup, transaksi otomatis gagal dan tidak diposting.
          </p>

          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
