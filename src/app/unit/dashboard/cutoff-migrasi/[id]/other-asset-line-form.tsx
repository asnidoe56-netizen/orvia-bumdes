import { createUnitCutoffOtherAssetLineAction } from "../actions";

type OtherAssetLineFormProps = {
  cutoffMigrationId: string;
  canEdit: boolean;
};

export function OtherAssetLineForm({
  cutoffMigrationId,
  canEdit,
}: OtherAssetLineFormProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <form
      action={createUnitCutoffOtherAssetLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label
            htmlFor="item_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Aset Lain
          </label>
          <input
            id="item_name"
            name="item_name"
            type="text"
            required
            defaultValue="Perlengkapan/ATK"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
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
            defaultValue="85000"
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
            defaultValue="1.1.06.01"
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
            defaultValue="Perlengkapan/ATK"
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
            defaultValue="Perlengkapan/ATK cut-off Rp85.000."
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-end justify-end">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 xl:w-auto"
          >
            Tambah Aset Lain
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Catatan audit: akun khusus 1400 Perlengkapan/ATK belum tersedia di COA. Data tetap dipisahkan sebagai Aset Lain agar tidak tercampur dengan persediaan barang dagang atau aset tetap.
      </p>
    </form>
  );
}
