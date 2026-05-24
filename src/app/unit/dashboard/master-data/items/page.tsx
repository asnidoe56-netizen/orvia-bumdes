import { Package, PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createMasterItem } from "../actions";

type InventoryItem = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string;
  item_type: string;
  minimum_stock: number;
  is_active: boolean;
};

function formatItemType(type: string) {
  if (type === "stock") return "Stock";
  if (type === "service") return "Service";
  if (type === "non_stock") return "Non Stock";
  return type;
}

export default async function UnitMasterItemsPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, item_code, item_name, unit_of_measure, item_type, minimum_stock, is_active")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const itemList = (items ?? []) as InventoryItem[];

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/master-data" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Master Data / Persediaan Barang
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Persediaan Barang
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Kelola master barang, jasa, dan item non-stok sebagai referensi
              transaksi pembelian, penjualan, dan persediaan unit.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
            <Package className="h-4 w-4" />
            {itemList.length} Item
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <form action={createMasterItem} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Form Item
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Simpan master item ke engine inventory_items.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Kode Item
              </span>
              <input
                name="item_code"
                required
                placeholder="Contoh: BRG-001"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Item
              </span>
              <input
                name="item_name"
                required
                placeholder="Contoh: Beras 5 Kg"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Satuan
              </span>
              <input
                name="unit_of_measure"
                defaultValue="pcs"
                placeholder="pcs / kg / karung / liter"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Tipe Item
              </span>
              <select
                name="item_type"
                defaultValue="stock"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="stock">Stock</option>
                <option value="service">Service</option>
                <option value="non_stock">Non Stock</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Minimum Stok
              </span>
              <input
                name="minimum_stock"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Deskripsi
              </span>
              <textarea
                name="description"
                rows={3}
                placeholder="Catatan item, merek, ukuran, atau keterangan lain"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Simpan Item
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Package className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Daftar Item
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Tabel master persediaan barang unit.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Item</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Min</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {itemList.length > 0 ? (
                  itemList.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {item.item_code}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-semibold">{item.item_name}</div>
                        <div className="text-xs text-slate-500">
                          Satuan: {item.unit_of_measure}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatItemType(item.item_type)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.minimum_stock}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                          {item.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Belum ada item. Tambahkan item pertama dari form di samping.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
