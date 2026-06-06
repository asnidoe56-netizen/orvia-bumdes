import { createUnitCutoffLiabilityLineAction } from "../actions";

type LiabilityAccountOption = {
  id: string;
  kode: string | null;
  nama: string | null;
  normal_balance: string | null;
};

type LiabilityLineFormProps = {
  cutoffMigrationId: string;
  options: LiabilityAccountOption[];
  canEdit: boolean;
};

export function LiabilityLineForm({
  cutoffMigrationId,
  options,
  canEdit,
}: LiabilityLineFormProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <form
      action={createUnitCutoffLiabilityLineAction}
      className="mx-5 mb-5 rounded-2xl border border-amber-100 bg-amber-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label
            htmlFor="liability_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Kewajiban
          </label>
          <input
            id="liability_name"
            name="liability_name"
            type="text"
            required
            placeholder="Utang PADes Tahun Sebelum ORVIA"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </div>

        <div>
          <label
            htmlFor="orvia_account_id"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Akun Kewajiban ORVIA
          </label>
          <select
            id="orvia_account_id"
            name="orvia_account_id"
            required
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          >
            <option value="">Pilih akun kewajiban</option>
            {options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.kode} - {option.nama}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="counterparty_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Pihak Terkait
          </label>
          <input
            id="counterparty_name"
            name="counterparty_name"
            type="text"
            placeholder="Pemerintah Desa / Supplier"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
            placeholder="5000000"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </div>

        <div>
          <label
            htmlFor="due_date"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Jatuh Tempo
          </label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
            placeholder="Opsional"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
            placeholder="Opsional"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
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
            placeholder="Contoh: kewajiban setoran PADes sebelum masuk ORVIA"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end border-t border-amber-100 pt-4">
        <button
          type="submit"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 md:w-auto"
        >
          Tambah Kewajiban
        </button>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Form ini hanya menerima akun bertipe KEWAJIBAN. Contoh penggunaan: Utang PADes,
        Utang Dana Sosial, Utang Supplier, atau Utang Belanja Modal yang sudah ada sebelum ORVIA.
      </p>
    </form>
  );
}
