"use client";

import { useActionState, useMemo } from "react";

import {
  createSavingsLoanRepayment,
  generateSavingsLoanRepaymentSchedule,
  type RepaymentActionState,
} from "../actions";

type CashBankAccountOption = {
  id: string;
  account_code: string | null;
  account_name: string | null;
  account_kind: string | null;
};

type LoanProductOption = {
  id: string;
  product_code: string | null;
  product_name: string | null;
  interest_method: string | null;
  service_rate: number | string | null;
};

type NextSchedule = {
  installment_no: number | null;
  due_date: string | null;
  remaining_principal_amount: number | string | null;
  remaining_service_amount: number | string | null;
  remaining_admin_amount: number | string | null;
  remaining_penalty_amount: number | string | null;
  remaining_total_amount: number | string | null;
};

type RepaymentActionPanelProps = {
  applicationId: string;
  applicationNo: string;
  canRepay: boolean;
  hasSchedule: boolean;
  outstandingPrincipal: number;
  nextSchedule: NextSchedule | null;
  cashBankAccounts: CashBankAccountOption[];
  products: LoanProductOption[];
};

const initialState: RepaymentActionState = {
  success: false,
  message: "",
};

const formatCurrency = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

function useToday() {
  return useMemo(() => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);
}

export function RepaymentActionPanel({
  applicationId,
  applicationNo,
  canRepay,
  hasSchedule,
  outstandingPrincipal,
  nextSchedule,
  cashBankAccounts,
  products,
}: RepaymentActionPanelProps) {
  const today = useToday();

  const [scheduleState, scheduleAction, isGeneratingSchedule] = useActionState(
    generateSavingsLoanRepaymentSchedule,
    initialState,
  );

  const [repaymentState, repaymentAction, isPostingRepayment] = useActionState(
    createSavingsLoanRepayment,
    initialState,
  );

  const defaultPrincipal = Number(
    nextSchedule?.remaining_principal_amount ?? 0,
  );
  const defaultService = Number(nextSchedule?.remaining_service_amount ?? 0);
  const defaultAdmin = Number(nextSchedule?.remaining_admin_amount ?? 0);
  const defaultPenalty = Number(nextSchedule?.remaining_penalty_amount ?? 0);

  return (
    <div className="space-y-3">
      {!hasSchedule ? (
        <form
          action={scheduleAction}
          className="space-y-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-4"
        >
          <input type="hidden" name="application_id" value={applicationId} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Jadwal Belum Dibuat
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {applicationNo}
            </p>
            <p className="text-xs leading-5 text-slate-600">
              Pilih produk pinjaman agar sistem membuat jadwal pokok dan jasa
              otomatis dari engine database.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Produk Pinjaman
              <select
                name="product_id"
                required
                disabled={isGeneratingSchedule || products.length === 0}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              >
                <option value="">Pilih produk</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.product_code ?? "-"} -{" "}
                    {product.product_name ?? "Produk Pinjaman"} (
                    {product.service_rate ?? 0}%)
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Jatuh Tempo Pertama
              <input
                type="date"
                name="first_due_date"
                required
                disabled={isGeneratingSchedule}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>
          </div>

          {scheduleState.message ? (
            <div
              className={[
                "rounded-xl px-3 py-2 text-xs font-medium",
                scheduleState.success
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {scheduleState.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isGeneratingSchedule || products.length === 0}
            className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isGeneratingSchedule ? "Membuat Jadwal..." : "Buat Jadwal Angsuran"}
          </button>
        </form>
      ) : null}

      {canRepay ? (
        <form
          action={repaymentAction}
          className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
        >
          <input type="hidden" name="application_id" value={applicationId} />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Terima Angsuran
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-950">
              {applicationNo}
            </p>
            <p className="text-xs text-slate-600">
              Sisa pokok: {formatCurrency(outstandingPrincipal)}
            </p>
          </div>

          {nextSchedule ? (
            <div className="rounded-2xl border border-emerald-100 bg-white/70 p-3 text-xs text-slate-600">
              <p className="font-semibold text-emerald-700">
                Tagihan terdekat: Angsuran ke-{nextSchedule.installment_no ?? "-"}
              </p>
              <p className="mt-1">
                Total sisa tagihan:{" "}
                <span className="font-semibold text-slate-950">
                  {formatCurrency(nextSchedule.remaining_total_amount)}
                </span>
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Akun Kas/Bank
              <select
                name="cash_bank_account_id"
                required
                disabled={isPostingRepayment || cashBankAccounts.length === 0}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              >
                <option value="">Pilih akun</option>
                {cashBankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.account_code ?? "-"} -{" "}
                    {account.account_name ?? "Kas/Bank"}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Tanggal Angsuran
              <input
                type="date"
                name="repayment_date"
                defaultValue={today}
                required
                disabled={isPostingRepayment}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              Pokok
              <input
                type="number"
                name="principal_amount"
                min="0"
                step="1"
                defaultValue={defaultPrincipal || ""}
                disabled={isPostingRepayment}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Jasa
              <input
                type="number"
                name="service_amount"
                min="0"
                step="1"
                defaultValue={defaultService || ""}
                disabled={isPostingRepayment}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Admin
              <input
                type="number"
                name="admin_amount"
                min="0"
                step="1"
                defaultValue={defaultAdmin || ""}
                disabled={isPostingRepayment}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>

            <label className="space-y-1 text-xs font-medium text-slate-700">
              Denda
              <input
                type="number"
                name="penalty_amount"
                min="0"
                step="1"
                defaultValue={defaultPenalty || ""}
                disabled={isPostingRepayment}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
              />
            </label>
          </div>

          <label className="space-y-1 text-xs font-medium text-slate-700">
            Catatan
            <textarea
              name="notes"
              rows={2}
              disabled={isPostingRepayment}
              placeholder="Opsional, contoh: angsuran diterima tunai dari pemohon."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100"
            />
          </label>

          {repaymentState.message ? (
            <div
              className={[
                "rounded-xl px-3 py-2 text-xs font-medium",
                repaymentState.success
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-rose-200 bg-rose-50 text-rose-700",
              ].join(" ")}
            >
              {repaymentState.message}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPostingRepayment || cashBankAccounts.length === 0}
            className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPostingRepayment ? "Memproses..." : "Posting Angsuran"}
          </button>
        </form>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">
          Tidak ada sisa pokok yang perlu ditagih.
        </div>
      )}
    </div>
  );
}
