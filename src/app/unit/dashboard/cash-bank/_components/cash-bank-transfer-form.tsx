"use client";

import { useActionState, useMemo } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import {
  createCashBankInternalTransfer,
  type CashBankTransferActionState,
} from "../actions";

type CashBankAccountOption = {
  cash_bank_account_id: string;
  account_code: string;
  account_name: string;
  account_kind: "cash" | "bank";
  current_balance: number | string | null;
};

type CashBankTransferFormProps = {
  accounts: CashBankAccountOption[];
};

const initialState: CashBankTransferActionState = {
  ok: false,
  message: "",
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function accountKindLabel(kind: "cash" | "bank") {
  return kind === "bank" ? "Bank" : "Kas";
}

function todayInputValue() {
  const today = new Date();
  const timezoneOffset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

function generateTransferNumber() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return [
    "TRF",
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("-");
}

export function CashBankTransferForm({ accounts }: CashBankTransferFormProps) {
  const [state, formAction, isPending] = useActionState(
    createCashBankInternalTransfer,
    initialState,
  );

  const activeAccounts = useMemo(
    () =>
      accounts
        .filter((account) => account.cash_bank_account_id)
        .sort((a, b) => {
          if (a.account_kind !== b.account_kind) {
            return a.account_kind.localeCompare(b.account_kind);
          }

          return a.account_code.localeCompare(b.account_code);
        }),
    [accounts],
  );

  const canSubmit = activeAccounts.length >= 2;

  return (
    <section className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Mutasi Internal
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">
            Transfer Antar Kas/Bank
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Pindahkan saldo dari kas tunai ke bank, bank ke kas tunai, atau antar akun kas-bank dalam unit yang sama.
            Sistem akan langsung membuat jurnal seimbang dan dua mutasi ledger: transfer keluar dan transfer masuk.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
          <ArrowRightLeft className="h-4 w-4" />
          Dr Bank/Kas • Cr Kas/Bank
        </div>
      </div>

      {!canSubmit ? (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Minimal diperlukan dua akun kas/bank aktif untuk membuat transfer internal.
        </div>
      ) : (
        <form action={formAction} className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="source_cash_bank_account_id" className="text-sm font-semibold text-slate-700">
              Akun Sumber
            </label>
            <select
              id="source_cash_bank_account_id"
              name="source_cash_bank_account_id"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Pilih akun sumber</option>
              {activeAccounts.map((account) => (
                <option key={account.cash_bank_account_id} value={account.cash_bank_account_id}>
                  {account.account_code} — {account.account_name} ({accountKindLabel(account.account_kind)}) • Saldo {formatCurrency(account.current_balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="target_cash_bank_account_id" className="text-sm font-semibold text-slate-700">
              Akun Tujuan
            </label>
            <select
              id="target_cash_bank_account_id"
              name="target_cash_bank_account_id"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Pilih akun tujuan</option>
              {activeAccounts.map((account) => (
                <option key={account.cash_bank_account_id} value={account.cash_bank_account_id}>
                  {account.account_code} — {account.account_name} ({accountKindLabel(account.account_kind)}) • Saldo {formatCurrency(account.current_balance)}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="transfer_no" className="text-sm font-semibold text-slate-700">
              Nomor Transfer
            </label>
            <input
              id="transfer_no"
              name="transfer_no"
              type="text"
              required
              defaultValue={generateTransferNumber()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold uppercase text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="transfer_date" className="text-sm font-semibold text-slate-700">
              Tanggal Transfer
            </label>
            <input
              id="transfer_date"
              name="transfer_date"
              type="date"
              required
              defaultValue={todayInputValue()}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="amount" className="text-sm font-semibold text-slate-700">
              Nominal Transfer
            </label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              placeholder="Contoh: 100000"
              required
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-semibold text-slate-700">
              Keterangan
            </label>
            <input
              id="description"
              name="description"
              type="text"
              placeholder="Contoh: Setor kas tunai ke rekening bank unit"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          {state.message ? (
            <div
              className={`lg:col-span-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                state.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {state.message}
            </div>
          ) : null}

          <div className="lg:col-span-2 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs leading-relaxed text-slate-500">
              Transfer ini bukan pendapatan dan bukan beban. Sistem hanya memindahkan saldo antar akun kas-bank dalam unit yang sama.
            </p>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
              {isPending ? "Memposting..." : "Posting Transfer"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
