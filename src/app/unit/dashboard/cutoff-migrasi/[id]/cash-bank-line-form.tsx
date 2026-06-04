"use client";

import { useState } from "react";
import { createUnitCutoffCashBankLineAction } from "../actions";

type CashBankOption = {
  id: string;
  account_code: string | null;
  account_name: string | null;
  account_id: string | null;
  account_kind: string | null;
};

type CashBankLineFormProps = {
  cutoffMigrationId: string;
  options: CashBankOption[];
  canEdit: boolean;
};

function defaultSourceName(kind: string) {
  if (kind === "bank") return "Kas di Bank SulutGo";
  return "Kas Tunai";
}

function defaultOldAccountCode(kind: string) {
  if (kind === "bank") return "1.1.01.03";
  return "1.1.01.01";
}

function defaultOldAccountName(kind: string) {
  if (kind === "bank") return "Kas di Bank Sulut Go";
  return "Kas Tunai";
}

export function CashBankLineForm({
  cutoffMigrationId,
  canEdit,
}: CashBankLineFormProps) {
  const [kind, setKind] = useState("cash");
  const [sourceName, setSourceName] = useState(defaultSourceName("cash"));
  const [oldCode, setOldCode] = useState(defaultOldAccountCode("cash"));
  const [oldName, setOldName] = useState(defaultOldAccountName("cash"));

  if (!canEdit) {
    return null;
  }

  function handleKindChange(nextKind: string) {
    setKind(nextKind);
    setSourceName(defaultSourceName(nextKind));
    setOldCode(defaultOldAccountCode(nextKind));
    setOldName(defaultOldAccountName(nextKind));
  }

  return (
    <form
      action={createUnitCutoffCashBankLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label
            htmlFor="cash_bank_kind"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Jenis
          </label>
          <select
            id="cash_bank_kind"
            name="cash_bank_kind"
            required
            value={kind}
            onChange={(event) => handleKindChange(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="cash">Kas</option>
            <option value="bank">Bank</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            ORVIA otomatis mapping ke {kind === "bank" ? "BANK-UTAMA" : "KAS-UTAMA"}.
          </p>
        </div>

        <div>
          <label
            htmlFor="source_bank_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Kas/Bank Lama
          </label>
          <input
            id="source_bank_name"
            name="source_bank_name"
            type="text"
            required
            value={sourceName}
            onChange={(event) => setSourceName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Saldo Awal
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            placeholder={kind === "bank" ? "120376000" : "63095000"}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="old_account_code"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Kode Akun Lama
          </label>
          <input
            id="old_account_code"
            name="old_account_code"
            type="text"
            value={oldCode}
            onChange={(event) => setOldCode(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="old_account_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Akun Lama
          </label>
          <input
            id="old_account_name"
            name="old_account_name"
            type="text"
            value={oldName}
            onChange={(event) => setOldName(event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-4">
          <label
            htmlFor="notes"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Catatan
          </label>
          <input
            id="notes"
            name="notes"
            type="text"
            placeholder="Saldo kas/bank hasil cut-off"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 xl:w-auto"
          >
            Tambah Kas/Bank
          </button>
        </div>
      </div>
    </form>
  );
}
