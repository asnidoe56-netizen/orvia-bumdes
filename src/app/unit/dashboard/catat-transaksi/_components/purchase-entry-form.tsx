import { PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createAndPostPurchaseInvoice } from "../../purchasing/actions";

type PaymentType = "cash" | "credit";

type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

type InventoryItem = {
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

  const suppliers = (supplierResult.data ?? []) as Supplier[];
  const items = (itemResult.data ?? []) as InventoryItem[];
  const isCredit = paymentType === "credit";

  return (
    <div className="space-y-3">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <form action={createAndPostPurchaseInvoice}>
        <input type="hidden" name="payment_type" value={paymentType} />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <section className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:flex-1">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <PlusCircle className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Data Pembelian
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Isi data barang yang dibeli. Nomor transaksi, stok, kas/utang,
                  dan jurnal diproses otomatis oleh database.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Tanggal Pembelian
                </span>
                <input
                  name="invoice_date"
                  type="date"
                  required
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              {isCredit ? (
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">
                    Tanggal Jatuh Tempo
                  </span>
                  <input
                    name="due_date"
                    type="date"
                    required
                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              ) : null}

              <label className={`space-y-1.5 ${isCredit ? "lg:col-span-2" : ""}`}>
                <span className="text-xs font-bold text-slate-700">
                  Supplier
                </span>
                <select
                  name="supplier_id"
                  required
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pilih supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} - {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Barang
                </span>
                <select
                  name="item_id"
                  required
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pilih barang</option>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code} - {item.item_name} ({item.unit_of_measure})
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Jumlah
                </span>
                <input
                  name="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  placeholder="Contoh: 10"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Harga Beli per Barang
                </span>
                <input
                  name="unit_cost"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  placeholder="Contoh: 150000"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Diskon
                </span>
                <input
                  name="discount_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Pajak
                </span>
                <input
                  name="tax_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue="0"
                  className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Catatan
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Catatan pembelian"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Saat disimpan, database membuat nomor transaksi otomatis dan
                memperbarui stok, kas/utang, serta pencatatan keuangan.
              </p>

              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 sm:min-w-[260px]"
              >
                {submitLabel}
              </button>
            </div>
          </section>

          <aside className="w-full rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:w-[360px] lg:shrink-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              Ringkasan
            </p>

            <h2 className="mt-1 text-base font-bold text-slate-950">
              Ringkasan Pembelian
            </h2>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Jenis Pembayaran
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">
                {isCredit ? "Kredit" : "Tunai"}
              </p>
            </div>

            <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Barang</span>
                <span className="font-bold text-slate-950">
                  Dipilih di form
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Jumlah</span>
                <span className="font-bold text-slate-950">
                  Dari input
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Harga Beli</span>
                <span className="font-bold text-slate-950">
                  Dari input
                </span>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-slate-700">
                    Dampak Posting
                  </span>
                  <span className="font-black text-emerald-700">
                    Otomatis
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              {isCredit
                ? "Pembelian kredit akan menambah persediaan dan utang supplier sesuai engine database."
                : "Pembelian tunai akan menambah persediaan dan mengurangi kas/bank sesuai engine database."}
            </p>
          </aside>
        </div>
      </form>
    </div>
  );
}
