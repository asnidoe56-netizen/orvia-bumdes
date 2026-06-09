"use client";

import { useState } from "react";
import { Building2, CreditCard, Hammer, PlusCircle, Wallet } from "lucide-react";
import { createAndPostCapitalExpenditure } from "../_actions/capital-expenditure-actions";

export type AssetCategory = {
  id: string;
  category_code: string;
  category_name: string;
  default_useful_life_months: number;
  is_depreciable: boolean;
};

export type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

export type CashBankAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
};

type CapitalExpenditureFormClientProps = {
  assetCategories: AssetCategory[];
  suppliers: Supplier[];
  cashBankAccounts: CashBankAccount[];
};

type AssistantResult = {
  tone: "success" | "warning" | "error";
  message: string;
  warnings?: string[];
};

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function CapitalExpenditureFormClient({
  assetCategories,
  suppliers,
  cashBankAccounts,
}: CapitalExpenditureFormClientProps) {
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(
    null
  );
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const [transactionDate, setTransactionDate] = useState(getTodayDate());
  const [paymentType, setPaymentType] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [cashBankAccountId, setCashBankAccountId] = useState("");
  const [assetCategoryId, setAssetCategoryId] = useState("");
  const [assetName, setAssetName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitPrice, setUnitPrice] = useState("");
  const [residualValue, setResidualValue] = useState("0");
  const [usefulLifeMonths, setUsefulLifeMonths] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  async function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu belanja modalnya. Contoh: hari ini beli laptop 5 juta tunai dari kas.",
      });
      return;
    }

    setIsAssistantLoading(true);
    setAssistantResult(null);

    try {
      const response = await fetch("/api/unit/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: "capital_expenditure",
          prompt,
          client_today: getTodayDate(),
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setAssistantResult({
          tone: "error",
          message:
            payload?.message ||
            "Assistant belum berhasil membaca data Belanja Modal.",
        });
        return;
      }

      const draft = payload.draft ?? {};

      setTransactionDate(String(draft.transaction_date ?? getTodayDate()));
      setPaymentType(String(draft.payment_type ?? ""));
      setSupplierId(String(draft.supplier_id ?? ""));
      setCashBankAccountId(String(draft.cash_bank_account_id ?? ""));
      setAssetCategoryId(String(draft.asset_category_id ?? ""));
      setAssetName(String(draft.asset_name ?? ""));
      setQuantity(String(draft.quantity ?? "1"));
      setUnitPrice(String(draft.unit_price ?? ""));
      setResidualValue(String(draft.residual_value ?? "0"));
      setUsefulLifeMonths(String(draft.useful_life_months ?? ""));
      setDueDate(String(draft.due_date ?? ""));
      setDescription(String(draft.description ?? prompt));
      setNotes(String(draft.notes ?? prompt));

      setAssistantResult({
        tone:
          Array.isArray(payload.warnings) && payload.warnings.length > 0
            ? "warning"
            : "success",
        message:
          payload.summary ||
          "Assistant berhasil menyusun draft. Periksa kembali sebelum posting.",
        warnings: payload.warnings ?? [],
      });
    } catch (error) {
      setAssistantResult({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Assistant belum berhasil membaca data Belanja Modal.",
      });
    } finally {
      setIsAssistantLoading(false);
    }
  }

  return (
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

          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-950">
              Asisten Isi Belanja Modal
            </p>
            <p className="mt-1 text-xs leading-5 text-emerald-800">
              Tulis belanja aset dengan bahasa biasa. Assistant hanya membantu
              isi form. Posting tetap lewat tombol resmi.
            </p>

            <textarea
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
              rows={3}
              placeholder="Contoh: hari ini beli laptop 5 juta tunai dari kas"
              className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={handleAssistantFill}
                disabled={isAssistantLoading}
                className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAssistantLoading
                  ? "Assistant membaca database..."
                  : "Gunakan Asisten untuk Isi Form"}
              </button>

              <p className="text-xs leading-5 text-emerald-800">
                Assistant membaca kategori aset, supplier, dan kas/bank secara
                read-only.
              </p>
            </div>

            {assistantResult ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${
                  assistantResult.tone === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : assistantResult.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-white text-emerald-800"
                }`}
              >
                <p className="font-semibold">{assistantResult.message}</p>

                {assistantResult.warnings?.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {assistantResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
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
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
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
                value={paymentType}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setPaymentType(nextValue);

                  if (nextValue === "credit") {
                    setCashBankAccountId("");
                  }

                  if (nextValue === "cash") {
                    setDueDate("");
                  }
                }}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={cashBankAccountId}
                onChange={(event) => setCashBankAccountId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Kosongkan jika pembayaran kredit</option>
                {cashBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_code} - {account.account_name} (
                    {account.account_kind})
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
                value={assetCategoryId}
                onChange={(event) => setAssetCategoryId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="" disabled>
                  Pilih kategori aset
                </option>
                {assetCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.category_name} - umur manfaat default{" "}
                    {category.default_useful_life_months} bulan
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
                value={assetName}
                onChange={(event) => setAssetName(event.target.value)}
                placeholder="Contoh: Laptop admin unit, etalase toko, mesin penggiling"
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Jumlah</span>
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
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
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
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
                value={residualValue}
                onChange={(event) => setResidualValue(event.target.value)}
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
                value={usefulLifeMonths}
                onChange={(event) => setUsefulLifeMonths(event.target.value)}
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
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
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
                value={description}
                onChange={(event) => setDescription(event.target.value)}
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
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
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
            <p className="mt-1 text-xl font-black text-slate-950">Aset Tetap</p>
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-slate-900 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-500">
                <Wallet className="h-4 w-4 text-emerald-700" />
                Tunai
              </span>
              <span className="font-bold text-slate-950">Aset + Kas/Bank</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-slate-500">
                <CreditCard className="h-4 w-4 text-emerald-700" />
                Kredit
              </span>
              <span className="font-bold text-slate-950">Aset + Utang</span>
            </div>

            <div className="border-t border-slate-200 pt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-bold text-slate-700">
                  <Hammer className="h-4 w-4 text-emerald-700" />
                  Register Aset
                </span>
                <span className="font-black text-emerald-700">Otomatis</span>
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
              Form ini hanya mengirim data operasional. Validasi saldo, posting
              jurnal, dan pencatatan aset tetap tetap dilakukan oleh engine
              database.
            </p>
          </div>
        </aside>
      </div>
    </form>
  );
}
