"use client";

import { useState } from "react";
import { paySupplierPurchaseInvoice } from "../_actions/supplier-payment-actions";

type PayableInvoice = {
  purchase_invoice_id: string;
  supplier_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number | string;
  payment_amount: number | string;
  outstanding_amount: number | string;
  payable_status: string;
};

type CashBankAccountWithBalance = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

type AssistantResult = {
  tone: "success" | "warning" | "error";
  message: string;
  warnings?: string[];
};

type SupplierPaymentFormClientProps = {
  payables: PayableInvoice[];
  cashBankAccounts: CashBankAccountWithBalance[];
};

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isNaN(numberValue) ? 0 : numberValue);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function SupplierPaymentFormClient({
  payables,
  cashBankAccounts,
}: SupplierPaymentFormClientProps) {
  const today = formatDateInput(new Date());

  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] =
    useState<AssistantResult | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const [purchaseInvoiceId, setPurchaseInvoiceId] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [cashBankAccountId, setCashBankAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  async function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu kalimat pembayaran. Contoh: hari ini bayar hutang supplier Indra 500 ribu dari kas.",
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
          module: "supplier_debt_payment",
          prompt,
          client_today: today,
        }),
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        setAssistantResult({
          tone: "error",
          message:
            payload?.message ||
            "Assistant belum berhasil membaca pembayaran hutang supplier.",
        });
        return;
      }

      const draft = payload.draft ?? {};

      setPaymentDate(String(draft.payment_date ?? today));
      setPurchaseInvoiceId(String(draft.purchase_invoice_id ?? ""));
      setCashBankAccountId(String(draft.cash_bank_account_id ?? ""));
      setAmountInput(String(draft.amount ?? ""));
      setNotesInput(String(draft.notes ?? prompt));

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
            : "Assistant belum berhasil membaca data pembayaran.",
      });
    } finally {
      setIsAssistantLoading(false);
    }
  }

  return (
    <form action={paySupplierPurchaseInvoice} className="space-y-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="mb-3">
          <p className="text-xs font-bold text-emerald-950">
            Asisten Isi Pembayaran Hutang
          </p>
          <p className="mt-1 text-xs leading-5 text-emerald-800">
            Tulis pembayaran dengan bahasa biasa. Asisten hanya membantu isi
            form. Posting tetap dilakukan petugas lewat tombol resmi.
          </p>
        </div>

        <textarea
          value={assistantPrompt}
          onChange={(event) => setAssistantPrompt(event.target.value)}
          rows={3}
          placeholder="Contoh: hari ini bayar hutang supplier Indra 500 ribu dari kas"
          className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
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
            Assistant membaca invoice hutang terbuka dan saldo kas/bank secara
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

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Invoice Hutang Supplier
          </span>
          <select
            name="purchase_invoice_id"
            value={purchaseInvoiceId}
            onChange={(event) => setPurchaseInvoiceId(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Pilih invoice hutang</option>
            {payables.map((invoice) => (
              <option
                key={invoice.purchase_invoice_id}
                value={invoice.purchase_invoice_id}
              >
                {invoice.invoice_no} - {invoice.supplier_name ?? "Supplier"}
                {" | Sisa "}
                {formatRupiah(invoice.outstanding_amount)}
                {" | "}
                {invoice.payable_status}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Tanggal Pembayaran
          </span>
          <input
            name="payment_date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Nomor Pembayaran
          </span>
          <input
            name="payment_no"
            type="text"
            placeholder="Kosongkan untuk nomor otomatis"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Bayar Dari Kas/Bank
          </span>
          <select
            name="cash_bank_account_id"
            value={cashBankAccountId}
            onChange={(event) => setCashBankAccountId(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Pilih kas/bank unit</option>
            {cashBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code} - {account.account_name}
                {" | Saldo "}
                {formatRupiah(account.current_balance)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Nominal Pembayaran
          </span>
          <input
            name="amount"
            type="number"
            min="1"
            step="1"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            required
            placeholder="Contoh: 150000"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Catatan</span>
          <textarea
            name="notes"
            rows={3}
            value={notesInput}
            onChange={(event) => setNotesInput(event.target.value)}
            placeholder="Catatan pembayaran hutang supplier"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Engine database akan menolak pembayaran jika nominal melebihi sisa
          hutang atau saldo kas/bank tidak cukup.
        </p>

        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
        >
          Simpan & Posting Pembayaran
        </button>
      </div>
    </form>
  );
}
