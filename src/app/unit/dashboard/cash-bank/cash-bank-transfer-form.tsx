"use client";

import { useMemo, useState } from "react";
import { useActionState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  createAndPostCashBankTransfer,
  type CashBankTransferActionState,
} from "./actions";

type CashBankAccountOption = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: "cash" | "bank";
  current_balance: number;
};

type CashBankTransferFormProps = {
  accounts: CashBankAccountOption[];
};

const initialState: CashBankTransferActionState = {
  success: false,
  message: "",
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function CashBankTransferForm({ accounts }: CashBankTransferFormProps) {
  const [state, formAction, pending] = useActionState(
    createAndPostCashBankTransfer,
    initialState
  );

  const [transferMode, setTransferMode] = useState<"bank_to_cash" | "cash_to_bank">(
    "bank_to_cash"
  );

  const sourceKind = transferMode === "bank_to_cash" ? "bank" : "cash";
  const targetKind = transferMode === "bank_to_cash" ? "cash" : "bank";

  const sourceAccounts = useMemo(
    () => accounts.filter((account) => account.account_kind === sourceKind),
    [accounts, sourceKind]
  );

  const targetAccounts = useMemo(
    () => accounts.filter((account) => account.account_kind === targetKind),
    [accounts, targetKind]
  );

  const modeTitle =
    transferMode === "bank_to_cash"
      ? "Tarik tunai dari Bank ke Kas"
      : "Setor tunai dari Kas ke Bank";

  const modeDescription =
    transferMode === "bank_to_cash"
      ? "Gunakan saat uang ditarik dari rekening bank dan dimasukkan ke kas tunai unit."
      : "Gunakan saat uang kas tunai disetorkan ke rekening bank unit.";

  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-slate-950">Transaksi Kas-Bank</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Pilih jenis transaksi sesuai kondisi lapangan. Jurnal, mutasi kas-bank,
          audit, periode, dan validasi saldo diproses oleh database.
        </p>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setTransferMode("bank_to_cash")}
          className={[
            "rounded-2xl border p-4 text-left transition",
            transferMode === "bank_to_cash"
              ? "border-emerald-500 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">
              <ArrowDownToLine className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">Tarik Tunai</span>
              <span className="block text-xs text-slate-500">
                Bank → Kas Tunai
              </span>
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTransferMode("cash_to_bank")}
          className={[
            "rounded-2xl border p-4 text-left transition",
            transferMode === "cash_to_bank"
              ? "border-emerald-500 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm">
              <ArrowUpFromLine className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-bold">Setor Tunai</span>
              <span className="block text-xs text-slate-500">
                Kas Tunai → Bank
              </span>
            </span>
          </div>
        </button>
      </div>

      <form action={formAction} className="grid gap-4">
        <input type="hidden" name="transfer_mode" value={transferMode} />

        <div className="rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">{modeTitle}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {modeDescription}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Tanggal
            </span>
            <input
              type="date"
              name="transfer_date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Nomor Bukti
            </span>
            <input
              type="text"
              name="transfer_no"
              placeholder="Kosongkan untuk nomor otomatis"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Akun Sumber
            </span>
            <select
              name="source_cash_bank_account_id"
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Pilih akun sumber</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code} - {account.account_name} | Saldo{" "}
                  {formatRupiah(account.current_balance)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Akun Tujuan
            </span>
            <select
              name="target_cash_bank_account_id"
              required
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="">Pilih akun tujuan</option>
              {targetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code} - {account.account_name} | Saldo{" "}
                  {formatRupiah(account.current_balance)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Nominal
            </span>
            <input
              type="number"
              name="amount"
              min="1"
              step="1"
              required
              placeholder="Contoh: 500000"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Keterangan
            </span>
            <input
              type="text"
              name="description"
              placeholder="Contoh: Tarik tunai untuk operasional harian"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </label>
        </div>

        {state.message ? (
          <div
            className={[
              "rounded-2xl border px-4 py-3 text-sm font-semibold",
              state.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan & Posting
          </Button>
        </div>
      </form>
    </section>
  );
}
