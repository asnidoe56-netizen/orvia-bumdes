import { createUnitCutoffInventoryLineAction } from "../actions";

type InventoryLineFormProps = {
  cutoffMigrationId: string;
  canEdit: boolean;
};

export function InventoryLineForm({
  cutoffMigrationId,
  canEdit,
}: InventoryLineFormProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <form
      action={createUnitCutoffInventoryLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <label
            htmlFor="item_code"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Kode Barang
          </label>
          <input
            id="item_code"
            name="item_code"
            type="text"
            required
            defaultValue="BRG-BERAS"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="item_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Barang
          </label>
          <input
            id="item_name"
            name="item_name"
            type="text"
            required
            defaultValue="Beras"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="unit_of_measure"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Satuan
          </label>
          <input
            id="unit_of_measure"
            name="unit_of_measure"
            type="text"
            required
            defaultValue="koli"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="quantity"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Qty
          </label>
          <input
            id="quantity"
            name="quantity"
            type="text"
            inputMode="decimal"
            required
            defaultValue="27"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="unit_cost"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Harga Satuan
          </label>
          <input
            id="unit_cost"
            name="unit_cost"
            type="text"
            inputMode="decimal"
            required
            defaultValue="650000"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="old_account_code"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Akun Lama
          </label>
          <input
            id="old_account_code"
            name="old_account_code"
            type="text"
            defaultValue="1.1.05.06"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-2">
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
            defaultValue="Persediaan Brg Dagangan Ketapang"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="md:col-span-2 xl:col-span-3">
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
            placeholder="27 koli x Rp650.000 = Rp17.550.000"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 xl:w-auto"
          >
            Tambah Persediaan
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Total dihitung otomatis oleh server. Mapping ORVIA otomatis ke akun 1300, 4100, dan 5100.
      </p>
    </form>
  );
}
