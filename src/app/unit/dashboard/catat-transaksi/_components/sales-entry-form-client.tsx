"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { PlusCircle } from "lucide-react";
import {
  createAndPostSalesInvoice,
  previewSalesLineDiscountPercent,
} from "../_actions/sales-actions";

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

type SalesLinePreview = {
  unit_price: number;
  unit_cost: number;
  quantity: number;
  discount_percent: number;
  discount_amount: number;
  tax_amount: number;
  gross_amount: number;
  line_total: number;
  gross_profit: number;
};

type AssistantResult = {
  tone: "success" | "warning" | "info";
  message: string;
};

type SalesEntryFormClientProps = {
  paymentType: PaymentType;
  submitLabel: string;
  customers: Customer[];
  items: InventoryItem[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

const initialActionState = {
  success: false,
  message: null as string | null,
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
export function SalesEntryFormClient({
  paymentType,
  submitLabel,
  customers,
  items,
}: SalesEntryFormClientProps) {
  const today = formatDateInput(new Date());
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(
    null
  );
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [discountPercentInput, setDiscountPercentInput] = useState("0");
  const [taxAmountInput, setTaxAmountInput] = useState("0");
  const [notesInput, setNotesInput] = useState("");
  const [preview, setPreview] = useState<SalesLinePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();
  const [actionState, formAction, isSubmitPending] = useActionState(
    createAndPostSalesInvoice,
    initialActionState
  );

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const activePrice = Number(
    preview?.unit_price ??
      selectedItem?.active_sales_price ??
      selectedItem?.default_sales_price ??
      0
  );

  const quantity = Number(quantityInput || 0);
  const discountPercent = Number(discountPercentInput || 0);
  const taxAmount = Number(taxAmountInput || 0);
  const grossAmount = preview?.gross_amount ?? activePrice * quantity;
  const isCredit = paymentType === "credit";

  useEffect(() => {
    if (!selectedItemId || !Number.isFinite(quantity) || quantity <= 0) {
      startPreviewTransition(() => {
        setPreview(null);
        setPreviewError(null);
      });
      return;
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent < 0 ||
      discountPercent > 100
    ) {
      startPreviewTransition(() => {
        setPreview(null);
        setPreviewError("Diskon persen harus berada di antara 0 sampai 100.");
      });
      return;
    }

    if (!Number.isFinite(taxAmount) || taxAmount < 0) {
      startPreviewTransition(() => {
        setPreview(null);
        setPreviewError("Pajak tidak boleh negatif.");
      });
      return;
    }

    startPreviewTransition(async () => {
      try {
        const result = await previewSalesLineDiscountPercent({
          itemId: selectedItemId,
          quantity,
          discountPercent,
          taxAmount,
          invoiceDate: invoiceDate || undefined,
        });

        setPreview(result);
        setPreviewError(null);
      } catch (error) {
        setPreview(null);
        setPreviewError(
          error instanceof Error
            ? error.message
            : "Preview perhitungan database gagal."
        );
      }
    });
  }, [selectedItemId, quantity, discountPercent, taxAmount, invoiceDate]);

  async function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu penjualan dengan bahasa biasa. Contoh: Hari ini jual jagung 2 dos ke Budi diskon 5 persen.",
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
          module: "cash_sale",
          prompt,
          client_today: today,
        }),
      });

      const payload = await response.json();

      if (response.ok && payload?.success && payload?.draft) {
        const draft = payload.draft;

        setInvoiceDate(String(draft.invoice_date ?? today));
        setCustomerId(String(draft.customer_id ?? ""));
        setSelectedItemId(String(draft.item_id ?? ""));
        setQuantityInput(String(draft.quantity ?? ""));
        setDiscountPercentInput(String(draft.discount_percent ?? 0));
        setTaxAmountInput(String(draft.tax_amount ?? 0));
        setNotesInput(String(draft.notes ?? ""));

        const warnings = Array.isArray(payload.warnings)
          ? payload.warnings.filter(Boolean)
          : [];

        setAssistantResult({
          tone: warnings.length > 0 ? "warning" : "success",
          message: [
            String(
              payload.summary ??
                "Form jual tunai sudah dibantu isi oleh assistant backend."
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
          "Assistant belum bisa membaca penjualan. Isi form secara manual.",
      });
    } catch {
      setAssistantResult({
        tone: "warning",
        message:
          "Assistant belum bisa dihubungi. Isi form secara manual, posting tetap aman lewat tombol resmi.",
      });
    } finally {
      setIsAssistantLoading(false);
    }
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="payment_type" value={paymentType} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <section className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:flex-1">
          <div className="mb-4 flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PlusCircle className="h-5 w-5" />
            </div>

            <div>
              <h2 className="text-base font-bold text-slate-950">
                Data Penjualan
              </h2>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                Isi data transaksi. Harga, diskon nominal, HPP, stok, dan
                jurnal dihitung ulang oleh database.
              </p>
            </div>
          </div>

          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="mb-3">
              <p className="text-xs font-bold text-emerald-950">
                Asisten Isi Penjualan
              </p>
              <p className="mt-1 text-xs leading-5 text-emerald-800">
                Tulis penjualan dengan bahasa biasa. Asisten hanya membantu isi form. Posting tetap dilakukan petugas lewat tombol resmi.
              </p>
            </div>

            <textarea
              value={assistantPrompt}
              onChange={(event) => setAssistantPrompt(event.target.value)}
              rows={3}
              placeholder="Contoh: Hari ini jual jagung 2 dos ke Budi diskon 5 persen"
              className="w-full rounded-xl border border-emerald-400 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
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

              <p className="text-[11px] font-medium text-emerald-800">
                Asisten tidak menyimpan, tidak memposting, dan tidak mengubah stok.
              </p>
            </div>

            {assistantResult ? (
              <div
                className={`mt-3 rounded-xl border px-3 py-2 text-sm font-semibold leading-6 ${
                  assistantResult.tone === "success"
                    ? "border-emerald-300 bg-white text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {assistantResult.message}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">
                Tanggal Penjualan
              </span>
              <input
                name="invoice_date"
                type="date"
                required
                value={invoiceDate}
                onChange={(event) => setInvoiceDate(event.target.value)}
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
                  required
                  className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            ) : null}

            <label className={`space-y-1.5 ${isCredit ? "lg:col-span-2" : ""}`}>
              <span className="text-xs font-bold text-slate-700">
                Pelanggan
              </span>
              <select
                name="customer_id"
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Umum / tanpa pelanggan</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_code} - {customer.customer_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold text-slate-700">Barang</span>
              <select
                name="item_id"
                required
                value={selectedItemId}
                onChange={(event) => setSelectedItemId(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option value="">Pilih barang</option>
                {items.map((item) => {
                  const itemPrice = Number(
                    item.active_sales_price ?? item.default_sales_price ?? 0
                  );
                  const stock = Number(item.current_stock ?? 0);

                  return (
                    <option key={item.id} value={item.id}>
                      {item.item_code} - {item.item_name} ({item.unit_of_measure}) | Harga aktif: {formatCurrency(itemPrice)} | Stok: {formatNumber(stock)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Jumlah</span>
              <input
                name="quantity"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={quantityInput}
                onChange={(event) => setQuantityInput(event.target.value)}
                placeholder="Contoh: 1"
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">
                Diskon (%)
              </span>
              <input
                name="discount_percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={discountPercentInput}
                onChange={(event) => setDiscountPercentInput(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-bold text-slate-700">Pajak</span>
              <input
                name="tax_amount"
                type="number"
                min="0"
                step="0.01"
                value={taxAmountInput}
                onChange={(event) => setTaxAmountInput(event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-900 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold text-emerald-800">
                Harga Jual Aktif
              </p>
              <p className="mt-0.5 text-lg font-black text-emerald-950">
                {formatCurrency(activePrice)}
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-emerald-700">
                Readonly. Sumber harga tetap database.
              </p>
            </div>

            <label className="space-y-1.5 lg:col-span-2">
              <span className="text-xs font-bold text-slate-700">Catatan</span>
              <textarea
                name="notes"
                rows={2}
                value={notesInput}
                onChange={(event) => setNotesInput(event.target.value)}
                placeholder="Catatan penjualan"
                className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          {actionState.message ? (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {actionState.message}
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-5 text-slate-500">
              Saat disimpan, database menghitung ulang harga, HPP, stok,
              kas/piutang, dan jurnal.
            </p>

            <button
              type="submit"
              disabled={isSubmitPending}
              className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:min-w-[260px]"
            >
              {isSubmitPending ? "Menyimpan..." : submitLabel}
            </button>
          </div>
        </section>

        <aside className="w-full rounded-3xl border border-slate-900 bg-white p-4 lg:w-[360px] lg:shrink-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-700">
            Ringkasan
          </p>

          <h2 className="mt-1 text-base font-bold text-slate-950">
            Ringkasan Penjualan
          </h2>

          <div className="mt-4 rounded-2xl border border-slate-900 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Harga Aktif
            </p>
            <p className="mt-1 text-xl font-black text-slate-950">
              {formatCurrency(activePrice)}
            </p>
          </div>

          <div className="mt-3 space-y-2 rounded-2xl border border-slate-900 p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold text-slate-950">
                {formatCurrency(preview?.gross_amount ?? grossAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Diskon</span>
              <span className="font-bold text-red-600">
                {preview
                  ? formatCurrency(preview.discount_amount)
                  : isPreviewPending
                    ? "Mengambil..."
                    : "-"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Pajak</span>
              <span className="font-bold text-slate-950">
                {preview
                  ? formatCurrency(preview.tax_amount)
                  : isPreviewPending
                    ? "Mengambil..."
                    : formatCurrency(taxAmount)}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="font-bold text-slate-700">Total Akhir</span>
                <span className="text-lg font-black text-emerald-700">
                  {preview
                    ? formatCurrency(preview.line_total)
                    : isPreviewPending
                      ? "Mengambil..."
                      : "-"}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Laba Kotor</span>
              <span className="font-bold text-slate-950">
                {preview
                  ? formatCurrency(preview.gross_profit)
                  : isPreviewPending
                    ? "Mengambil..."
                    : "-"}
              </span>
            </div>
          </div>

          {previewError ? (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {previewError}
            </p>
          ) : null}
        </aside>
      </div>
    </form>
  );
}



