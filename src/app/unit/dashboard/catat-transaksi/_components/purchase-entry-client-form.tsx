"use client";

import { useMemo, useState } from "react";
import { PlusCircle } from "lucide-react";
import { createAndPostPurchaseInvoice } from "../../purchasing/actions";
import type {
  PurchaseInventoryItemOption,
  PurchaseSupplierOption,
} from "./purchase-entry-form";

type PaymentType = "cash" | "credit";

type AssistantResult = {
  tone: "success" | "warning" | "info";
  message: string;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
export function PurchaseEntryClientForm({
  paymentType,
  title,
  subtitle,
  eyebrow,
  submitLabel,
  suppliers,
  items,
}: {
  paymentType: PaymentType;
  title: string;
  subtitle: string;
  eyebrow: string;
  submitLabel: string;
  suppliers: PurchaseSupplierOption[];
  items: PurchaseInventoryItemOption[];
}) {
  const today = formatDateInput(new Date());
  const isCredit = paymentType === "credit";
  const isAssistantAvailable = paymentType === "cash";

  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [taxAmount, setTaxAmount] = useState("0");
  const [notes, setNotes] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] =
    useState<AssistantResult | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === itemId) ?? null,
    [itemId, items]
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => supplier.id === supplierId) ?? null,
    [supplierId, suppliers]
  );

  async function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu pembelian dengan bahasa biasa. Contoh: Hari ini beli 10 sak pupuk urea harga 280 ribu dari Toko Tani.",
      });
      return;
    }

    setIsAssistantLoading(true);

    try {
      const response = await fetch("/api/unit/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: "cash_purchase",
          prompt,
          client_today: today,
        }),
      });

      const payload = await response.json();

      if (response.ok && payload?.success && payload?.draft) {
        const draft = payload.draft;

        setInvoiceDate(String(draft.invoice_date ?? today));
        setSupplierId(String(draft.supplier_id ?? ""));
        setItemId(String(draft.item_id ?? ""));
        setQuantity(String(draft.quantity ?? ""));
        setUnitCost(String(draft.unit_cost ?? ""));
        setDiscountAmount(String(draft.discount_amount ?? 0));
        setTaxAmount(String(draft.tax_amount ?? 0));
        setNotes(String(draft.notes ?? ""));

        const warnings = Array.isArray(payload.warnings)
          ? payload.warnings.filter(Boolean)
          : [];

        setAssistantResult({
          tone: warnings.length > 0 ? "warning" : "success",
          message: [
            String(
              payload.summary ??
                "Form pembelian tunai sudah dibantu isi oleh assistant backend."
            ),
            ...warnings,
            "Silakan periksa kembali sebelum menekan tombol posting.",
          ].join(" "),
        });

        return;
      }

      setAssistantResult({
        tone: "warning",
        message:
          payload?.summary ??
          "Assistant belum bisa menyusun draft. Silakan isi form secara manual.",
      });
    } catch {
      setAssistantResult({
        tone: "warning",
        message:
          "Assistant backend belum bisa dihubungi. Silakan isi form secara manual.",
      });
    } finally {
      setIsAssistantLoading(false);
    }
  }
  return (
    <form action={createAndPostPurchaseInvoice}>
      <input type="hidden" name="payment_type" value={paymentType} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:flex-1">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                {eyebrow}
              </p>
              <h2 className="mt-1 text-base font-bold text-slate-950">
                {title}
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                {subtitle}
              </p>
            </div>
          </div>

          {isAssistantAvailable ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-950">
                  Asisten Isi Pembelian Tunai
                </p>
                <p className="text-sm leading-6 text-emerald-800">
                  Tulis pembelian dengan bahasa biasa. Asisten hanya mengisi
                  form satu barang. Posting tetap dilakukan petugas lewat tombol
                  resmi.
                </p>
              </div>

              <div className="mt-3 space-y-3">
                <textarea
                  value={assistantPrompt}
                  onChange={(event) => setAssistantPrompt(event.target.value)}
                  rows={3}
                  placeholder="Contoh: Hari ini beli 10 sak pupuk urea harga 280 ribu dari Toko Tani"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={handleAssistantFill}
                    disabled={
                      isAssistantLoading ||
                      suppliers.length === 0 ||
                      items.length === 0
                    }
                    className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isAssistantLoading
                      ? "Assistant membaca database..."
                      : "Gunakan Asisten untuk Isi Form"}
                  </button>

                  <p className="text-xs leading-5 text-emerald-800">
                    Asisten tidak menyimpan, tidak memposting, dan tidak
                    mengubah stok.
                  </p>
                </div>

                {assistantResult ? (
                  <div
                    className={
                      assistantResult.tone === "success"
                        ? "rounded-xl border border-emerald-300 bg-white p-3 text-sm leading-6 text-emerald-800"
                        : "rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                    }
                  >
                    {assistantResult.message}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">
                Tanggal Pembelian
              </span>
              <input
                name="invoice_date"
                type="date"
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
                required
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            ) : null}

            <label className={`space-y-1.5 ${isCredit ? "lg:col-span-2" : ""}`}>
              <span className="text-xs font-bold text-slate-700">
                Supplier
              </span>
              <select
                name="supplier_id"
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                required
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                required
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Pilih barang</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item_code} - {item.item_name} ({item.unit_of_measure})
                  </option>
                ))}
              </select>

              {selectedItem ? (
                <p className="text-xs leading-5 text-slate-500">
                  Satuan barang:{" "}
                  <span className="font-semibold text-slate-700">
                    {selectedItem.unit_of_measure}
                  </span>
                </p>
              ) : null}
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
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
                placeholder="Contoh: 10"
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={unitCost}
                onChange={(event) => setUnitCost(event.target.value)}
                required
                placeholder="Contoh: 150000"
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={discountAmount}
                onChange={(event) => setDiscountAmount(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
                value={taxAmount}
                onChange={(event) => setTaxAmount(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold text-slate-700">
                Catatan
              </span>
              <textarea
                name="notes"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Catatan pembelian"
                className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 sm:min-w-[260px]"
            >
              {submitLabel}
            </button>
          </div>
        </section>

        <aside className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:w-[360px] lg:shrink-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            Ringkasan
          </p>

          <h2 className="mt-1 text-base font-bold text-slate-950">
            Ringkasan Pembelian
          </h2>

          <div className="mt-4 rounded-2xl border border-slate-900 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Jenis Pembayaran
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {isCredit ? "Kredit" : "Tunai"}
            </p>
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-slate-900 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Supplier</span>
              <span className="text-right font-bold text-slate-950">
                {selectedSupplier?.supplier_name ?? "Dipilih di form"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Barang</span>
              <span className="text-right font-bold text-slate-950">
                {selectedItem?.item_name ?? "Dipilih di form"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Jumlah</span>
              <span className="font-bold text-slate-950">
                {quantity || "Dari input"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Harga Beli</span>
              <span className="font-bold text-slate-950">
                {unitCost || "Dari input"}
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
  );
}


