"use client";

import { useActionState } from "react";
import {
  createAndPostOperationalExpense,
  type OperationalExpenseActionState,
} from "../_actions/expense-actions";
import type {
  CashBankAccountOption,
  ExpenseAccountOption,
} from "./expense-entry-section";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const initialState: OperationalExpenseActionState = {
  success: false,
  message: "",
};

export function ExpenseEntryForm({
  expenseAccounts,
  cashBankAccounts,
}: {
  expenseAccounts: ExpenseAccountOption[];
  cashBankAccounts: CashBankAccountOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createAndPostOperationalExpense,
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
            htmlFor="expense_date"
            className="text-sm font-medium text-slate-700"
          >
            Tanggal Transaksi
          </label>
          <input
            id="expense_date"
            name="expense_date"
            type="date"
            defaultValue={today}
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense_no"
            className="text-sm font-medium text-slate-700"
          >
            Nomor Transaksi
          </label>
          <input
            id="expense_no"
            name="expense_no"
            type="text"
            placeholder="Otomatis jika dikosongkan"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Jenis Beban
          </label>
          <select
            id="expense_account_id"
            name="expense_account_id"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            defaultValue=""
            required
          >
            <option value="" disabled>
              Pilih jenis beban
            </option>

            {expenseAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.kode} - {account.nama}
              </option>
            ))}
          </select>

          {expenseAccounts.length === 0 ? (
            <p className="text-xs text-rose-600">
              Belum ada akun beban aktif untuk unit ini.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cash_bank_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Dibayar Dari
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
            Nominal
          </label>
          <input
            id="total_amount"
            name="total_amount"
            type="number"
            min="1"
            step="1"
            placeholder="Contoh: 50000"
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
          placeholder="Contoh: Bayar listrik kantor unit bulan Mei"
          className="w-full rounded-xl border border-slate-900 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>


      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="space-y-2">
          <label
            htmlFor="operator_reason"
            className="text-sm font-medium text-amber-900"
          >
            Alasan tanggal input berbeda
          </label>
          <textarea
            id="operator_reason"
            name="operator_reason"
            rows={3}
            placeholder="Contoh: Nota baru diterima dari lapangan hari ini."
            className="w-full rounded-xl border border-amber-400 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <p className="text-xs leading-5 text-amber-800">
            Isi bagian ini jika tanggal transaksi berbeda dari tanggal input hari ini.
            Sistem tetap mencatat transaksi sesuai tanggal transaksi, dan menyimpan
            catatan ini untuk transparansi administrasi.
          </p>
        </div>
      </div>
      <div className="rounded-xl border bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        Setelah disimpan, engine database akan otomatis membuat jurnal beban,
        transaksi kas/bank keluar, audit log, dan validasi saldo kas/bank.
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            expenseAccounts.length === 0 ||
            cashBankAccounts.length === 0
          }
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan Beban Operasional"}
        </button>
      </div>
    </form>
  );
}



