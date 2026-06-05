import { Building2, CreditCard, Hammer, PlusCircle, Wallet } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createAndPostCapitalExpenditure } from "../_actions/capital-expenditure-actions";

type AssetCategory = {
  id: string;
  category_code: string;
  category_name: string;
  default_useful_life_months: number;
  is_depreciable: boolean;
};

type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

type CashBankAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
};

export async function CapitalExpenditureEntryForm() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [categoryResult, supplierResult, cashBankResult] = await Promise.all([
    supabase
      .from("capital_expenditure_categories")
      .select("id, category_code, category_name, default_useful_life_months, is_depreciable")
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

      <form action={createAndPostCapitalExpenditure}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <section className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:flex-1">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <PlusCircle className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Data Belanja Modal
                </h2>
                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Isi pembelian aset operasional. Jurnal, kas/bank atau utang,
                  dan daftar aset tetap diproses otomatis oleh database.
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Tanggal Transaksi
                </span>
                <input
                  name="transaction_date"
                  type="date"
                  required
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Cara Pembayaran
                </span>
                <select
                  name="payment_type"
                  required
                  className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Pilih cara pembayaran
                  </option>
                  <option value="cash">Tunai / Kas Bank</option>
                  <option value="credit">Kredit / Belum Dibayar</option>
                </select>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Supplier / Pihak Penjual
                </span>
                <select
                  name="supplier_id"
                  className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  defaultValue=""
                >
                  <option value="">Tanpa supplier / belum didaftarkan</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} - {supplier.supplier_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Akun Kas/Bank untuk Tunai
                </span>
                <select
                  name="cash_bank_account_id"
                  className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  defaultValue=""
                >
                  <option value="">Kosongkan jika pembayaran kredit</option>
                  {cashBankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.account_code} - {account.account_name} ({account.account_kind})
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-slate-500">
                  Wajib dipilih untuk tunai. Untuk kredit, biarkan kosong.
                </p>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Kategori Aset
                </span>
                <select
                  name="asset_category_id"
                  required
                  className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Pilih kategori aset
                  </option>
                  {assetCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.category_name} - umur manfaat default {category.default_useful_life_months} bulan
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Nama Aset
                </span>
                <input
                  name="asset_name"
                  type="text"
                  required
                  placeholder="Contoh: Laptop admin unit, etalase toko, mesin penggiling"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
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
                  defaultValue="1"
                  placeholder="Contoh: 1"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Harga per Unit
                </span>
                <input
                  name="unit_price"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Contoh: 5000000"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Nilai Residu
                </span>
                <input
                  name="residual_value"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                  placeholder="Contoh: 0"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">
                  Umur Manfaat
                </span>
                <input
                  name="useful_life_months"
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Kosongkan untuk default kategori"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="text-xs leading-5 text-slate-500">
                  Kosongkan jika memakai default kategori.
                </p>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Tanggal Jatuh Tempo
                </span>
                <input
                  name="due_date"
                  type="date"
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="text-xs leading-5 text-slate-500">
                  Wajib diisi jika kredit. Untuk tunai, biarkan kosong.
                </p>
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Deskripsi Aset
                </span>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="Keterangan detail aset, lokasi, spesifikasi, atau nomor seri"
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-1.5 lg:col-span-2">
                <span className="text-xs font-bold text-slate-700">
                  Catatan Transaksi
                </span>
                <textarea
                  name="notes"
                  rows={2}
                  placeholder="Catatan tambahan, nomor nota, atau keterangan lain"
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Jika saldo kas/bank tidak cukup untuk transaksi tunai, engine
                database akan menolak posting agar tidak terjadi kas minus.
              </p>

              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 sm:min-w-[260px]"
              >
                Simpan & Posting Belanja Modal
              </button>
            </div>
          </section>

          <aside className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:w-[360px] lg:shrink-0">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
              Ringkasan
            </p>

            <h2 className="mt-1 text-base font-bold text-slate-950">
              Ringkasan Belanja Modal
            </h2>

            <div className="mt-4 rounded-2xl border border-slate-900 bg-slate-50 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                Output Transaksi
              </p>
              <p className="mt-1 text-xl font-black text-slate-950">
                Aset Tetap
              </p>
            </div>

            <div className="mt-3 space-y-2 rounded-2xl border border-slate-900 p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <Wallet className="h-4 w-4 text-emerald-700" />
                  Tunai
                </span>
                <span className="font-bold text-slate-950">
                  Aset + Kas/Bank
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <CreditCard className="h-4 w-4 text-emerald-700" />
                  Kredit
                </span>
                <span className="font-bold text-slate-950">
                  Aset + Utang
                </span>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-bold text-slate-700">
                    <Hammer className="h-4 w-4 text-emerald-700" />
                    Register Aset
                  </span>
                  <span className="font-black text-emerald-700">
                    Otomatis
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
              Setelah disimpan, transaksi langsung diposting. Database membuat
              jurnal, memperbarui kas/bank atau utang, dan membuat daftar aset
              tetap sesuai data belanja modal.
            </p>

            <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                <Building2 className="h-4 w-4 text-emerald-700" />
                Engine Belanja Modal Aktif
              </div>
              <p className="mt-2 text-xs leading-5 text-emerald-800">
                Form ini hanya mengirim data operasional. Validasi saldo,
                posting jurnal, dan pencatatan aset tetap tetap dilakukan oleh
                engine database.
              </p>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}

