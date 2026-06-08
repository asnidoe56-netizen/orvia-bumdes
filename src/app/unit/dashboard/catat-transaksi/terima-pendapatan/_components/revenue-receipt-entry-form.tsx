"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createAndPostRevenueReceipt,
  type RevenueReceiptActionState,
} from "../_actions/revenue-receipt-actions";
import type {
  CashBankAccountOption,
  RevenueAccountOption,
} from "./revenue-receipt-entry-section";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const initialState: RevenueReceiptActionState = {
  success: false,
  message: "",
};

type AssistantResult = {
  message: string;
  tone: "success" | "warning" | "info";
};

export function RevenueReceiptEntryForm({
  revenueAccounts,
  cashBankAccounts,
}: {
  revenueAccounts: RevenueAccountOption[];
  cashBankAccounts: CashBankAccountOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createAndPostRevenueReceipt,
    initialState
  );

  const today = formatDateInput(new Date());

  const [receiptDate, setReceiptDate] = useState(today);
  const [receiptNo, setReceiptNo] = useState("");
  const [revenueAccountId, setRevenueAccountId] = useState("");
  const [cashBankAccountId, setCashBankAccountId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] =
    useState<AssistantResult | null>(null);
  const [isAssistantLoading, setIsAssistantLoading] = useState(false);

  const selectedCashBankAccount = useMemo(
    () =>
      cashBankAccounts.find((account) => account.id === cashBankAccountId) ??
      null,
    [cashBankAccountId, cashBankAccounts]
  );

  async function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu penerimaan dengan bahasa biasa. Contoh: Terima pendapatan jasa sewa Rp250.000 ke kas hari ini.",
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
          module: "revenue_receipt",
          prompt,
          client_today: today,
        }),
      });

      const payload = await response.json();

      if (response.ok && payload?.success && payload?.draft) {
        const draft = payload.draft;

        setReceiptDate(String(draft.receipt_date ?? today));
        setRevenueAccountId(String(draft.revenue_account_id ?? ""));
        setCashBankAccountId(String(draft.cash_bank_account_id ?? ""));
        setTotalAmount(String(draft.total_amount ?? ""));
        setDescription(String(draft.description ?? ""));

        const warnings = Array.isArray(payload.warnings)
          ? payload.warnings.filter(Boolean)
          : [];

        setAssistantResult({
          tone: warnings.length > 0 ? "warning" : "success",
          message: [
            String(payload.summary ?? "Form sudah dibantu isi oleh assistant backend."),
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
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          className={
            state.success
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
              : "rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-950">
            Asisten Isi Penerimaan
          </p>
          <p className="text-sm leading-6 text-emerald-800">
            Tulis penerimaan dengan bahasa biasa. Asisten hanya membantu mengisi
            form. Posting tetap dilakukan oleh petugas melalui tombol resmi.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            rows={3}
            placeholder="Contoh: Terima pendapatan jasa sewa Rp250.000 ke kas hari ini"
            className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleAssistantFill}
              disabled={
                isAssistantLoading ||
                revenueAccounts.length === 0 ||
                cashBankAccounts.length === 0
              }
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAssistantLoading
                ? "Assistant membaca database..."
                : "Gunakan Asisten untuk Isi Form"}
            </button>

            <p className="text-xs leading-5 text-emerald-800">
              Asisten tidak menyimpan, tidak memposting, dan tidak mengubah data
              transaksi.
            </p>
          </div>

          {assistantResult ? (
            <div
              className={
                assistantResult.tone === "success"
                  ? "rounded-xl border border-emerald-300 bg-white p-3 text-sm leading-6 text-emerald-800"
                  : assistantResult.tone === "warning"
                    ? "rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                    : "rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700"
              }
            >
              {assistantResult.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="receipt_date"
            className="text-sm font-medium text-slate-700"
          >
            Tanggal Transaksi
          </label>
          <input
            id="receipt_date"
            name="receipt_date"
            type="date"
            value={receiptDate}
            onChange={(event) => setReceiptDate(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="receipt_no"
            className="text-sm font-medium text-slate-700"
          >
            Nomor Transaksi
          </label>
          <input
            id="receipt_no"
            name="receipt_no"
            type="text"
            value={receiptNo}
            onChange={(event) => setReceiptNo(event.target.value)}
            placeholder="Otomatis jika dikosongkan"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="revenue_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Jenis Pendapatan
          </label>
          <select
            id="revenue_account_id"
            name="revenue_account_id"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={revenueAccountId}
            onChange={(event) => setRevenueAccountId(event.target.value)}
            required
          >
            <option value="" disabled>
              Pilih jenis pendapatan
            </option>

            {revenueAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.kode} - {account.nama}
              </option>
            ))}
          </select>

          {revenueAccounts.length === 0 ? (
            <p className="text-xs text-rose-600">
              Belum ada akun pendapatan aktif untuk unit ini.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cash_bank_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Diterima Ke
          </label>
          <select
            id="cash_bank_account_id"
            name="cash_bank_account_id"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={cashBankAccountId}
            onChange={(event) => setCashBankAccountId(event.target.value)}
            required
          >
            <option value="" disabled>
              Pilih kas/bank
            </option>

            {cashBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code} - {account.account_name} (
                {formatRupiah(account.current_balance)})
              </option>
            ))}
          </select>

          {cashBankAccounts.length === 0 ? (
            <p className="text-xs text-rose-600">
              Belum ada akun kas/bank aktif untuk unit ini.
            </p>
          ) : null}

          {selectedCashBankAccount ? (
            <p className="text-xs leading-5 text-slate-500">
              Saldo saat ini:{" "}
              <span className="font-semibold text-slate-700">
                {formatRupiah(selectedCashBankAccount.current_balance)}
              </span>
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor="total_amount"
            className="text-sm font-medium text-slate-700"
          >
            Nominal Diterima
          </label>
          <input
            id="total_amount"
            name="total_amount"
            type="number"
            min="1"
            step="1"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            placeholder="Contoh: 250000"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="description"
          className="text-sm font-medium text-slate-700"
        >
          Keterangan
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Contoh: Terima pendapatan jasa sewa alat bulan Mei"
          className="w-full rounded-xl border border-slate-900 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="rounded-xl border bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        Setelah disimpan, engine database akan otomatis membuat jurnal
        penerimaan pendapatan, transaksi kas/bank masuk, audit log, dan laporan
        laba rugi akan ikut terbarui.
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            revenueAccounts.length === 0 ||
            cashBankAccounts.length === 0
          }
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan Terima Pendapatan"}
        </button>
      </div>
    </form>
  );
}
