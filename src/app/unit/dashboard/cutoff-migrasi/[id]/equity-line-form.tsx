"use client";

import { useState } from "react";
import { createUnitCutoffEquityLineAction } from "../actions";

type EquityLineFormProps = {
  cutoffMigrationId: string;
  canEdit: boolean;
};

type EquityPreset = {
  equitySourceType: "initial_capital" | "retained_earnings";
  amount: string;
  oldAccountCode: string;
  oldAccountName: string;
  notes: string;
};

const presets: Record<string, EquityPreset> = {
  initial_capital: {
    equitySourceType: "initial_capital",
    amount: "197376000",
    oldAccountCode: "3.1.01.01",
    oldAccountName: "Penyertaan Modal Desa",
    notes: "Penyertaan modal desa sebelum ORVIA.",
  },
  retained_earnings: {
    equitySourceType: "retained_earnings",
    amount: "8680000",
    oldAccountCode: "SURPLUS-LAMA",
    oldAccountName: "Saldo Laba Sebelum ORVIA",
    notes: "Saldo laba lama dari pendapatan, HPP, dan beban sebelum ORVIA.",
  },
};

export function EquityLineForm({
  cutoffMigrationId,
  canEdit,
}: EquityLineFormProps) {
  const [presetKey, setPresetKey] =
    useState<"initial_capital" | "retained_earnings">("initial_capital");
  const [form, setForm] = useState<EquityPreset>(presets.initial_capital);

  if (!canEdit) {
    return null;
  }

  function handlePresetChange(nextKey: "initial_capital" | "retained_earnings") {
    setPresetKey(nextKey);
    setForm(presets[nextKey]);
  }

  function updateField(key: keyof EquityPreset, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <form
      action={createUnitCutoffEquityLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />
      <input type="hidden" name="equity_source_type" value={form.equitySourceType} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div>
          <label
            htmlFor="equity_preset"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Jenis Ekuitas
          </label>
          <select
            id="equity_preset"
            value={presetKey}
            onChange={(event) =>
              handlePresetChange(
                event.target.value as "initial_capital" | "retained_earnings"
              )
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="initial_capital">Penyertaan Modal Desa</option>
            <option value="retained_earnings">Saldo Laba Sebelum ORVIA</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nominal
          </label>
          <input
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(event) => updateField("amount", event.target.value)}
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
            value={form.oldAccountCode}
            onChange={(event) => updateField("oldAccountCode", event.target.value)}
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
            value={form.oldAccountName}
            onChange={(event) => updateField("oldAccountName", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
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
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
        >
          Tambah Ekuitas
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Pendapatan, HPP, dan beban lama tidak diposting ulang. Hasil bersihnya masuk ke Saldo Laba Sebelum ORVIA.
      </p>
    </form>
  );
}
