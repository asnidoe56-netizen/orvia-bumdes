"use client";

import { useState } from "react";
import { createUnitCutoffFixedAssetLineAction } from "../actions";

type FixedAssetLineFormProps = {
  cutoffMigrationId: string;
  canEdit: boolean;
};

type Preset = {
  assetCategory: "equipment" | "furniture";
  assetCode: string;
  assetName: string;
  acquisitionCost: string;
  usefulLifeMonths: string;
  oldAccountCode: string;
  oldAccountName: string;
  notes: string;
};

const presets: Record<string, Preset> = {
  equipment: {
    assetCategory: "equipment",
    assetCode: "AST-PERALATAN-MESIN",
    assetName: "Peralatan dan Mesin",
    acquisitionCost: "4550000",
    usefulLifeMonths: "48",
    oldAccountCode: "1.3.03.01",
    oldAccountName: "Peralatan dan Mesin",
    notes: "Aset tetap cut-off per 31 Desember 2025.",
  },
  furniture: {
    assetCategory: "furniture",
    assetCode: "AST-MEUBELAIR",
    assetName: "Meubelair",
    acquisitionCost: "400000",
    usefulLifeMonths: "48",
    oldAccountCode: "1.3.04.01",
    oldAccountName: "Meubelair",
    notes: "Aset tetap cut-off per 31 Desember 2025.",
  },
};

export function FixedAssetLineForm({
  cutoffMigrationId,
  canEdit,
}: FixedAssetLineFormProps) {
  const [presetKey, setPresetKey] = useState<"equipment" | "furniture">("equipment");
  const [form, setForm] = useState<Preset>(presets.equipment);

  if (!canEdit) {
    return null;
  }

  function handlePresetChange(nextKey: "equipment" | "furniture") {
    setPresetKey(nextKey);
    setForm(presets[nextKey]);
  }

  function updateField(key: keyof Preset, value: string) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <form
      action={createUnitCutoffFixedAssetLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />
      <input type="hidden" name="asset_category" value={form.assetCategory} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <label
            htmlFor="asset_preset"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Jenis Aset
          </label>
          <select
            id="asset_preset"
            value={presetKey}
            onChange={(event) =>
              handlePresetChange(event.target.value as "equipment" | "furniture")
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="equipment">Peralatan & Mesin</option>
            <option value="furniture">Meubelair</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Mapping ORVIA otomatis ke {form.assetCategory === "furniture" ? "1502" : "1501"}.
          </p>
        </div>

        <div>
          <label
            htmlFor="asset_code"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Kode Aset
          </label>
          <input
            id="asset_code"
            name="asset_code"
            type="text"
            required
            value={form.assetCode}
            onChange={(event) => updateField("assetCode", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="asset_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Aset
          </label>
          <input
            id="asset_name"
            name="asset_name"
            type="text"
            required
            value={form.assetName}
            onChange={(event) => updateField("assetName", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="acquisition_date"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Tanggal Cut-off
          </label>
          <input
            id="acquisition_date"
            name="acquisition_date"
            type="date"
            required
            defaultValue="2025-12-31"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="acquisition_cost"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nilai Buku Awal
          </label>
          <input
            id="acquisition_cost"
            name="acquisition_cost"
            type="text"
            inputMode="decimal"
            required
            value={form.acquisitionCost}
            onChange={(event) => updateField("acquisitionCost", event.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="useful_life_months"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Umur Manfaat
          </label>
          <input
            id="useful_life_months"
            name="useful_life_months"
            type="text"
            inputMode="numeric"
            required
            value={form.usefulLifeMonths}
            onChange={(event) => updateField("usefulLifeMonths", event.target.value)}
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

        <div className="md:col-span-2">
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

        <div className="md:col-span-2 xl:col-span-2">
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

        <div className="flex items-end justify-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 xl:w-auto"
          >
            Tambah Aset
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Akumulasi penyusutan pembukaan diset 0 untuk data Rajawali. Penyusutan berikutnya dihitung oleh engine aset tetap.
      </p>
    </form>
  );
}
