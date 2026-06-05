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
  const [selectedSourceAccountId, setSelectedSourceAccountId] = useState("");
  const [selectedTargetAccountId, setSelectedTargetAccountId] = useState("");

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

  const selectedSourceAccount = useMemo(
    () =>
      sourceAccounts.find((account) => account.id === selectedSourceAccountId) ??
      null,
    [sourceAccounts, selectedSourceAccountId]
  );

  const selectedTargetAccount = useMemo(
    () =>
      targetAccounts.find((account) => account.id === selectedTargetAccountId) ??
      null,
    [targetAccounts, selectedTargetAccountId]
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
    <section className="mb-5 w-full max-w-full overflow-hidden rounded-2xl border border-slate-900 bg-white p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-sm font-bold text-slate-950">Transaksi Kas-Bank</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Pilih jenis transaksi sesuai kondisi lapangan. Jurnal, mutasi kas-bank,
          audit, periode, dan validasi saldo diproses oleh database.
        </p>
      </div>

      <div className="mb-4 grid w-full max-w-full gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setTransferMode("bank_to_cash");
            setSelectedSourceAccountId("");
            setSelectedTargetAccountId("");
          }}
          className={[
            "min-w-0 rounded-2xl border p-4 text-left transition",
            transferMode === "bank_to_cash"
              ? "border-emerald-500 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-xl bg-white p-2 text-emerald-700">
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
          onClick={() => {
            setTransferMode("cash_to_bank");
            setSelectedSourceAccountId("");
            setSelectedTargetAccountId("");
          }}
          className={[
            "min-w-0 rounded-2xl border p-4 text-left transition",
            transferMode === "cash_to_bank"
              ? "border-emerald-500 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
          ].join(" ")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 rounded-xl bg-white p-2 text-emerald-700">
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

      <form action={formAction} className="grid w-full max-w-full gap-4">
        <input type="hidden" name="transfer_mode" value={transferMode} />

        <div className="w-full max-w-full rounded-2xl border border-slate-900 bg-slate-50 p-4">
          <p className="text-sm font-bold text-slate-950">{modeTitle}</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {modeDescription}
          </p>
        </div>

        <div className="grid w-full max-w-full gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Tanggal
            </span>
            <input
              type="date"
              name="transfer_date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Nomor Bukti
            </span>
            <input
              type="text"
              name="transfer_no"
              placeholder="Kosongkan untuk nomor otomatis"
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        <div className="grid w-full max-w-full gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Akun Sumber
            </span>
            <select
              name="source_cash_bank_account_id"
              required
              value={selectedSourceAccountId}
              onChange={(event) => setSelectedSourceAccountId(event.target.value)}
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Pilih akun sumber</option>
              {sourceAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code}
                </option>
              ))}
            </select>

            {selectedSourceAccount ? (
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
                <span className="block truncate">
                  {selectedSourceAccount.account_name}
                </span>
                <span className="block">
                  Saldo akun sumber:{" "}
                  {formatRupiah(selectedSourceAccount.current_balance)}
                </span>
              </span>
            ) : null}
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Akun Tujuan
            </span>
            <select
              name="target_cash_bank_account_id"
              required
              value={selectedTargetAccountId}
              onChange={(event) => setSelectedTargetAccountId(event.target.value)}
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option value="">Pilih akun tujuan</option>
              {targetAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.account_code}
                </option>
              ))}
            </select>

            {selectedTargetAccount ? (
              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
                <span className="block truncate">
                  {selectedTargetAccount.account_name}
                </span>
                <span className="block">
                  Saldo akun tujuan:{" "}
                  {formatRupiah(selectedTargetAccount.current_balance)}
                </span>
              </span>
            ) : null}
          </label>
        </div>

        <div className="grid w-full max-w-full gap-4 lg:grid-cols-2">
          <label className="grid min-w-0 gap-2">
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
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>

          <label className="grid min-w-0 gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Keterangan
            </span>
            <input
              type="text"
              name="description"
              placeholder="Contoh: Tarik tunai untuk operasional harian"
              className="h-11 w-full max-w-full min-w-0 truncate rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </label>
        </div>

        {state.message ? (
          <div
            className={[
              "w-full max-w-full rounded-2xl border px-4 py-3 text-sm font-semibold",
              state.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700",
            ].join(" ")}
          >
            {state.message}
          </div>
        ) : null}

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-end">
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan & Posting
          </Button>
        </div>
      </form>
    </section>
  );
}



