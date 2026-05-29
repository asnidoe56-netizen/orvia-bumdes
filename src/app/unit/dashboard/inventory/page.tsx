export const dynamic = "force-dynamic";

import { Package, PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createInventoryItem } from "./actions";

type InventoryItem = {
  id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  item_type: string;
  minimum_stock: number;
  is_active: boolean;
};

type Account = {
  id: string;
  kode: string;
  nama: string;
  account_type: string;
};

export default async function UnitInventoryPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: items, error: itemError } = await supabase
    .from("inventory_items")
    .select(
      "id, item_code, item_name, description, unit_of_measure, item_type, minimum_stock, is_active"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  const { data: accounts, error: accountError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama, account_type")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("is_active", true)
    .order("kode", { ascending: true });

  const itemList = (items ?? []) as InventoryItem[];
  const accountList = (accounts ?? []) as Account[];

  const assetAccounts = accountList.filter((account) => account.account_type === "ASET");
  const incomeAccounts = accountList.filter((account) => account.account_type === "PENDAPATAN");
  const cogsAccounts = accountList.filter((account) => account.account_type === "HPP");
  const expenseAccounts = accountList.filter((account) => account.account_type === "BEBAN");

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Unit Dashboard / Inventory
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Master Persediaan
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Tambahkan barang, jasa, atau item non-stok untuk transaksi unit.
          Data otomatis tersimpan dengan scope tenant_id dan unit_id login.
        </p>
      </section>

      {itemError || accountError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {itemError?.message || accountError?.message}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Tambah Item
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Untuk tahap awal, akun COA boleh dikosongkan. Nanti bisa diwajibkan saat engine transaksi final.
              </p>
            </div>
          </div>

          <form action={createInventoryItem} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Kode Item *
                </span>
                <input
                  name="item_code"
                  required
                  placeholder="Contoh: BRG001"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Nama Item *
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
                  Satuan *
                </span>
                <input
                  name="unit_of_measure"
                  required
                  defaultValue="pcs"
                  placeholder="pcs / kg / liter / paket"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Tipe Item *
                </span>
                <select
                  name="item_type"
                  required
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Akun Akuntansi Opsional
              </h3>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Akun Persediaan
                  </span>
                  <select
                    name="inventory_account_id"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Kosongkan dulu</option>
                    {assetAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.kode} - {account.nama}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Akun Penjualan
                  </span>
                  <select
                    name="sales_account_id"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Kosongkan dulu</option>
                    {incomeAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.kode} - {account.nama}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Akun HPP
                  </span>
                  <select
                    name="cogs_account_id"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Kosongkan dulu</option>
                    {cogsAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.kode} - {account.nama}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Akun Biaya
                  </span>
                  <select
                    name="cost_account_id"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="">Kosongkan dulu</option>
                    {expenseAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.kode} - {account.nama}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-5">
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
              >
                Simpan Item
              </button>
            </div>
          </form>
        </div>

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
                Total item: {itemList.length}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {itemList.length > 0 ? (
              itemList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-slate-950">
                        {item.item_name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {item.item_code} · {item.item_type} · {item.unit_of_measure}
                      </p>
                      {item.description ? (
                        <p className="mt-2 text-sm text-slate-600">
                          {item.description}
                        </p>
                      ) : null}
                    </div>

                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Min: {item.minimum_stock}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Belum ada item. Tambahkan item pertama dari form di sebelah kiri.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
