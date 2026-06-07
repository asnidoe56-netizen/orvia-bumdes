import { ResponsiveTableShell } from "@/components/ui/responsive-table-shell";
export const dynamic = "force-dynamic";

import { Package, PlusCircle, AlertTriangle, CheckCircle2, CircleSlash, Boxes } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createMasterItem } from "../actions";

type InventoryItemSummary = {
  id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  item_type: string;
  minimum_stock: number;
  default_sales_price: number;
  total_quantity_in: number;
  total_quantity_out: number;
  current_stock: number;
  last_purchase_price: number;
  average_unit_cost: number;
  inventory_value: number;
  stock_status: "safe" | "low" | "empty" | "not_tracked" | string;
  is_active: boolean;
};

function formatItemType(type: string) {
  if (type === "stock") return "Stock";
  if (type === "service") return "Service";
  if (type === "non_stock") return "Non Stock";
  return type;
}

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getStockStatusLabel(item: InventoryItemSummary) {
  if (item.item_type !== "stock" || item.stock_status === "not_tracked") {
    return {
      label: "Tidak dihitung",
      className: "bg-slate-100 text-slate-600",
      icon: CircleSlash,
    };
  }

  if (item.stock_status === "empty") {
    return {
      label: "Kosong",
      className: "bg-red-50 text-red-700",
      icon: AlertTriangle,
    };
  }

  if (item.stock_status === "low") {
    return {
      label: "Stok rendah",
      className: "bg-amber-50 text-amber-700",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Aman",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  };
}

export default async function UnitMasterItemsPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: items, error } = await supabase
    .from("v_inventory_item_stock_summary")
    .select(
      "id, item_code, item_name, description, unit_of_measure, item_type, minimum_stock, default_sales_price, total_quantity_in, total_quantity_out, current_stock, last_purchase_price, average_unit_cost, inventory_value, stock_status, is_active"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const itemList = (items ?? []) as InventoryItemSummary[];
  const stockItems = itemList.filter((item) => item.item_type === "stock");
  const lowStockCount = itemList.filter((item) => item.stock_status === "low" || item.stock_status === "empty").length;
  const totalInventoryValue = itemList.reduce((total, item) => total + Number(item.inventory_value ?? 0), 0);

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
              Kelola master barang sekaligus pantau sisa stok, harga jual default,
              harga beli terakhir, dan status stok rendah.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <Package className="h-4 w-4" />
                Total Item
              </div>
              <div className="mt-1 text-xl font-black">{itemList.length}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <Boxes className="h-4 w-4" />
                Item Stock
              </div>
              <div className="mt-1 text-xl font-black">{stockItems.length}</div>
            </div>

            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <AlertTriangle className="h-4 w-4" />
                Perlu Cek
              </div>
              <div className="mt-1 text-xl font-black">{lowStockCount}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <strong>Catatan:</strong> minimum stok adalah batas peringatan stok rendah,
          bukan stok awal. Isi 0 jika belum ingin memakai peringatan. Stok awal
          sebaiknya dicatat melalui penyesuaian stok agar tetap bisa diaudit.
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <form action={createMasterItem} className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Form Item
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Simpan identitas barang. Jumlah stok tidak diinput di sini, tetapi dihitung dari pergerakan stok.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
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
                Batas Peringatan Stok Minimum
              </span>
              <input
                name="minimum_stock"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="block text-xs text-slate-500">
                Isi 0 jika belum memakai peringatan. Ini bukan stok awal.
              </span>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Harga Jual Default
              </span>
              <input
                name="default_sales_price"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                placeholder="Contoh: 75000"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
              <span className="block text-xs text-slate-500">
                Referensi harga jual otomatis saat transaksi penjualan.
              </span>
            </label>

            <label className="space-y-2 col-span-full">
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

        <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <Package className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Daftar Item & Ringkasan Stok
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Sisa stok dihitung dari inventory_movements, bukan diketik manual.
                </p>
              </div>
            </div>

            <div className="hidden rounded-2xl bg-slate-50 px-4 py-2 text-right text-xs text-slate-600 md:block">
              <div className="font-bold uppercase text-slate-500">Nilai Persediaan</div>
              <div className="text-sm font-black text-slate-900">{formatCurrency(totalInventoryValue)}</div>
            </div>
          </div>
          <div className="space-y-3 xl:hidden">
            {itemList.length > 0 ? (
              itemList.map((item) => {
                const stockStatus = getStockStatusLabel(item);
                const StatusIcon = stockStatus.icon;

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-400">
                          {item.item_code}
                        </p>
                        <h3 className="mt-1 break-words text-base font-black text-slate-950">
                          {item.item_name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500">
                          Satuan: {item.unit_of_measure} · {formatItemType(item.item_type)}
                        </p>
                      </div>

                      <span
                        className={
                          item.is_active
                            ? "shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"
                            : "shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"
                        }
                      >
                        {item.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Sisa Stok
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {item.item_type === "stock"
                            ? formatNumber(item.current_stock)
                            : "-"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Minimum
                        </p>
                        <p className="mt-1 font-black text-slate-950">
                          {formatNumber(item.minimum_stock)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Harga Jual
                        </p>
                        <p className="mt-1 break-words font-black text-slate-950">
                          {formatCurrency(item.default_sales_price)}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Harga Beli
                        </p>
                        <p className="mt-1 break-words font-black text-slate-950">
                          {formatCurrency(item.last_purchase_price)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${stockStatus.className}`}
                      >
                        <StatusIcon className="h-3.5 w-3.5" />
                        {stockStatus.label}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        Nilai: {formatCurrency(item.inventory_value)}
                      </span>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                Belum ada item. Tambahkan item pertama dari form di samping.
              </div>
            )}
          </div>

          <ResponsiveTableShell className="hidden xl:block">
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Nama Item</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Sisa Stok</th>
                  <th className="px-4 py-3 text-right">Min</th>
                  <th className="px-4 py-3 text-right">Harga Jual</th>
                  <th className="px-4 py-3 text-right">Harga Beli Terakhir</th>
                  <th className="px-4 py-3">Status Stok</th>
                  <th className="px-4 py-3">Status Item</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {itemList.length > 0 ? (
                  itemList.map((item) => {
                    const stockStatus = getStockStatusLabel(item);
                    const StatusIcon = stockStatus.icon;

                    return (
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
                        <td className="px-4 py-3 text-right font-bold text-slate-800">
                          {item.item_type === "stock"
                            ? formatNumber(item.current_stock)
                            : "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600">
                          {formatNumber(item.minimum_stock)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(item.default_sales_price)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCurrency(item.last_purchase_price)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${stockStatus.className}`}>
                            <StatusIcon className="h-3.5 w-3.5" />
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={item.is_active ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" : "rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"}>
                            {item.is_active ? "Aktif" : "Nonaktif"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Belum ada item. Tambahkan item pertama dari form di samping.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </ResponsiveTableShell>
        </div>
      </section>
    </div>
  );
}



