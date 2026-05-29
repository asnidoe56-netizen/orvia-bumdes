import { Building2, CreditCard, Hammer, Info, PlusCircle, Wallet } from "lucide-react";
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
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Catat Transaksi / Belanja Modal
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Belanja Modal
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Catat pembelian aset operasional seperti peralatan, mesin,
              meubelair, bangunan, konstruksi, software, atau aset tak berwujud.
              Engine database otomatis membuat jurnal, kas/bank atau utang,
              dan daftar aset tetap.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Building2 className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-emerald-700">
            <Info className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-sm font-bold text-emerald-950">
              Engine Belanja Modal aktif
            </h2>
            <p className="mt-1 text-sm leading-6 text-emerald-800">
              Saat disimpan, transaksi langsung diposting. Tunai mencatat aset
              dan kas/bank keluar. Kredit mencatat aset dan utang belanja modal.
              Daftar aset tetap juga dibuat otomatis oleh engine database.
            </p>
          </div>
        </div>
      </section>

      <form action={createAndPostCapitalExpenditure} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <PlusCircle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Data Belanja Modal
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Isi data pembelian aset dalam bahasa operasional. Debit, kredit,
              jurnal, dan aset tetap diproses oleh engine database.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Tanggal Transaksi
            </span>
            <input
              name="transaction_date"
              type="date"
              required
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Cara Pembayaran
            </span>
            <select
              name="payment_type"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              defaultValue=""
            >
              <option value="" disabled>
                Pilih cara pembayaran
              </option>
              <option value="cash">Tunai / Kas Bank</option>
              <option value="credit">Kredit / Belum Dibayar</option>
            </select>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Supplier / Pihak Penjual
            </span>
            <select
              name="supplier_id"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Akun Kas/Bank untuk Tunai
            </span>
            <select
              name="cash_bank_account_id"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
              Wajib dipilih untuk pembayaran tunai. Untuk kredit, biarkan kosong.
            </p>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Kategori Aset
            </span>
            <select
              name="asset_category_id"
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Nama Aset
            </span>
            <input
              name="asset_name"
              type="text"
              required
              placeholder="Contoh: Laptop admin unit, etalase toko, mesin penggiling"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
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
              defaultValue="1"
              placeholder="Contoh: 1"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Harga per Unit
            </span>
            <input
              name="unit_price"
              type="number"
              min="1"
              step="1"
              required
              placeholder="Contoh: 5000000"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Nilai Residu
            </span>
            <input
              name="residual_value"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              placeholder="Contoh: 0"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">
              Umur Manfaat
            </span>
            <input
              name="useful_life_months"
              type="number"
              min="0"
              step="1"
              placeholder="Kosongkan untuk default kategori"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="text-xs leading-5 text-slate-500">
              Kosongkan jika ingin memakai umur manfaat default dari kategori aset.
            </p>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Tanggal Jatuh Tempo
            </span>
            <input
              name="due_date"
              type="date"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <p className="text-xs leading-5 text-slate-500">
              Wajib diisi jika belanja modal dilakukan secara kredit. Untuk tunai, biarkan kosong.
            </p>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Deskripsi Aset
            </span>
            <textarea
              name="description"
              rows={2}
              placeholder="Keterangan detail aset, lokasi, spesifikasi, atau nomor seri"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              Catatan Transaksi
            </span>
            <textarea
              name="notes"
              rows={3}
              placeholder="Catatan tambahan, nomor nota, atau keterangan lain"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 border-t border-slate-200 pt-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <Wallet className="h-4 w-4 text-emerald-700" />
              Tunai
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Engine mencatat aset bertambah dan kas/bank berkurang.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <CreditCard className="h-4 w-4 text-emerald-700" />
              Kredit
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Engine mencatat aset bertambah dan utang belanja modal.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <Hammer className="h-4 w-4 text-emerald-700" />
              Aset
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Daftar aset tetap dibuat otomatis setelah transaksi posted.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Jika saldo kas/bank tidak cukup untuk transaksi tunai, engine database akan menolak posting agar tidak terjadi kas minus.
          </p>

          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            Simpan & Posting Belanja Modal
          </button>
        </div>
      </form>
    </div>
  );
}

