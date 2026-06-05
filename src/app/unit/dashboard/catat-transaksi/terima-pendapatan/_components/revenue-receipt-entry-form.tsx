"use client";

import { useActionState } from "react";
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

const initialState: RevenueReceiptActionState = {
  success: false,
  message: "",
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

  const today = new Date().toISOString().slice(0, 10);

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
            defaultValue={today}
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
            defaultValue=""
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
            defaultValue=""
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

