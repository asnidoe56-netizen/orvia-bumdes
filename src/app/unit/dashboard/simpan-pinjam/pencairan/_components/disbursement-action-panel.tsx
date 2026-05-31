"use client";

import { useActionState, useMemo } from "react";

import {
  createSavingsLoanDisbursement,
  type DisbursementActionState,
} from "../actions";

type CashBankAccountOption = {
  id: string;
  account_code: string | null;
  account_name: string | null;
  account_kind: string | null;
};

type DisbursementActionPanelProps = {
  applicationId: string;
  applicationNo: string;
  requestedAmount: number;
  canDisburse: boolean;
  cashBankAccounts: CashBankAccountOption[];
};

const initialState: DisbursementActionState = {
  success: false,
  message: "",
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export function DisbursementActionPanel({
  applicationId,
  applicationNo,
  requestedAmount,
  canDisburse,
  cashBankAccounts,
}: DisbursementActionPanelProps) {
  const [state, formAction, isPending] = useActionState(
    createSavingsLoanDisbursement,
    initialState,
  );

  const today = useMemo(() => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  if (!canDisburse) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
        Belum dapat dicairkan.
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
      <input type="hidden" name="application_id" value={applicationId} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Siap Dicairkan
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-950">
          {applicationNo}
        </p>
        <p className="text-xs text-slate-600">
          Nilai pencairan: {formatCurrency(requestedAmount)}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-slate-700">
          Akun Kas/Bank
          <select
            name="cash_bank_account_id"
            required
            disabled={isPending || cashBankAccounts.length === 0}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          >
            <option value="">Pilih akun</option>
            {cashBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code ?? "-"} - {account.account_name ?? "Kas/Bank"}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs font-medium text-slate-700">
          Tanggal Cair
          <input
            type="date"
            name="disbursement_date"
            defaultValue={today}
            required
            disabled={isPending}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
          />
        </label>
      </div>

      <label className="space-y-1 text-xs font-medium text-slate-700">
        Catatan
        <textarea
          name="notes"
          rows={2}
          disabled={isPending}
          placeholder="Opsional, contoh: pencairan diserahkan tunai kepada pemohon."
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
        />
      </label>

      {state.message ? (
        <div
          className={[
            "rounded-xl px-3 py-2 text-xs font-medium",
            state.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-rose-200 bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isPending || cashBankAccounts.length === 0}
        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {isPending ? "Memproses..." : "Cairkan Pinjaman"}
      </button>
    </form>
  );
}
