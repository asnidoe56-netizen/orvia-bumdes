"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

export function SalesEntryFormClient({
  paymentType,
  submitLabel,
  customers,
  items,
}: SalesEntryFormClientProps) {
  const [selectedItemId, setSelectedItemId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [quantityInput, setQuantityInput] = useState("1");
  const [discountPercentInput, setDiscountPercentInput] = useState("0");
  const [taxAmountInput, setTaxAmountInput] = useState("0");
  const [preview, setPreview] = useState<SalesLinePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPreviewPending, startPreviewTransition] = useTransition();

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

  return (
    <form
      action={createAndPostSalesInvoice}
      className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="payment_type" value={paymentType} />

      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <PlusCircle className="h-5 w-5" />
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-950">Data Penjualan</h2>
          <p className="mt-1 text-sm text-slate-600">
            Harga jual aktif, nominal diskon, total akhir, dan HPP dihitung oleh
            engine database. Form ini hanya mengirim jumlah dan diskon persen.
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
            value={invoiceDate}
            onChange={(event) => setInvoiceDate(event.target.value)}
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
          <span className="text-sm font-semibold text-slate-700">Barang</span>
          <select
            name="item_id"
            required
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Jumlah</span>
          <input
            name="quantity"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={quantityInput}
            onChange={(event) => setQuantityInput(event.target.value)}
            placeholder="Contoh: 1"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <div className="space-y-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
          <span className="text-sm font-semibold text-emerald-800">
            Harga Jual Aktif
          </span>
          <p className="text-xl font-black text-emerald-950">
            {formatCurrency(activePrice)}
          </p>
          <p className="text-xs leading-5 text-emerald-700">
            Harga ini readonly. Saat preview dan posting, database tetap menjadi
            sumber harga.
          </p>
        </div>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
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
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <span className="block text-xs leading-5 text-slate-500">
            Masukkan persen diskon. Nominal diskon dihitung database dan
            disimpan sebagai discount_amount.
          </span>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">Pajak</span>
          <input
            name="tax_amount"
            type="number"
            min="0"
            step="0.01"
            value={taxAmountInput}
            onChange={(event) => setTaxAmountInput(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:col-span-2">
          <div className="grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-slate-500">Subtotal DB</p>
              <p className="mt-1 font-black text-slate-950">
                {formatCurrency(preview?.gross_amount ?? grossAmount)}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Diskon DB</p>
              <p className="mt-1 font-black text-red-600">
                {preview
                  ? formatCurrency(preview.discount_amount)
                  : isPreviewPending
                    ? "Mengambil..."
                    : "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Total Akhir DB</p>
              <p className="mt-1 font-black text-emerald-700">
                {preview
                  ? formatCurrency(preview.line_total)
                  : isPreviewPending
                    ? "Mengambil..."
                    : "-"}
              </p>
            </div>

            <div>
              <p className="text-slate-500">Laba Kotor DB</p>
              <p className="mt-1 font-black text-slate-950">
                {preview
                  ? formatCurrency(preview.gross_profit)
                  : isPreviewPending
                    ? "Mengambil..."
                    : "-"}
              </p>
            </div>
          </div>

          {previewError ? (
            <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {previewError}
            </p>
          ) : null}
        </div>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Catatan</span>
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
          Saat disimpan, engine database menghitung ulang harga jual aktif,
          nominal diskon, HPP, stok, dan jurnal.
        </p>

        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}