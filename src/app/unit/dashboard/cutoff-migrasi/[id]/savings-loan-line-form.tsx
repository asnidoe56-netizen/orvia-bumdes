import { createUnitCutoffSavingsLoanLineAction } from "../actions";

type SavingsLoanLineFormProps = {
  cutoffMigrationId: string;
  canEdit: boolean;
};

export function SavingsLoanLineForm({
  cutoffMigrationId,
  canEdit,
}: SavingsLoanLineFormProps) {
  if (!canEdit) {
    return null;
  }

  return (
    <form
      action={createUnitCutoffSavingsLoanLineAction}
      className="mx-5 mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"
    >
      <input type="hidden" name="cutoff_migration_id" value={cutoffMigrationId} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div>
          <label
            htmlFor="loan_no"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nomor Pinjaman
          </label>
          <input
            id="loan_no"
            name="loan_no"
            type="text"
            required
            placeholder="PINJ-001"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="borrower_name"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Nama Peminjam
          </label>
          <input
            id="borrower_name"
            name="borrower_name"
            type="text"
            required
            placeholder="Nama anggota/debitur"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="borrower_identity_number"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            NIK / Identitas
          </label>
          <input
            id="borrower_identity_number"
            name="borrower_identity_number"
            type="text"
            placeholder="Opsional"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="loan_start_date"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Tanggal Pinjaman
          </label>
          <input
            id="loan_start_date"
            name="loan_start_date"
            type="date"
            required
            defaultValue="2025-12-31"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="original_principal_amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Pokok Awal
          </label>
          <input
            id="original_principal_amount"
            name="original_principal_amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="10000000"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="outstanding_principal_amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Sisa Pokok
          </label>
          <input
            id="outstanding_principal_amount"
            name="outstanding_principal_amount"
            type="text"
            inputMode="decimal"
            required
            placeholder="7500000"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="outstanding_service_amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Jasa/Margin Belum Diterima
          </label>
          <input
            id="outstanding_service_amount"
            name="outstanding_service_amount"
            type="text"
            inputMode="decimal"
            defaultValue="0"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="outstanding_penalty_amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Denda/Tunggakan
          </label>
          <input
            id="outstanding_penalty_amount"
            name="outstanding_penalty_amount"
            type="text"
            inputMode="decimal"
            defaultValue="0"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="installment_amount"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Angsuran/Bulan
          </label>
          <input
            id="installment_amount"
            name="installment_amount"
            type="text"
            inputMode="decimal"
            placeholder="Opsional"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="remaining_tenor_months"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Sisa Tenor
          </label>
          <input
            id="remaining_tenor_months"
            name="remaining_tenor_months"
            type="number"
            min="0"
            placeholder="Opsional"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div>
          <label
            htmlFor="collectibility_status"
            className="text-xs font-bold uppercase tracking-wide text-slate-600"
          >
            Kolektibilitas
          </label>
          <select
            id="collectibility_status"
            name="collectibility_status"
            defaultValue="current"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="current">Lancar</option>
            <option value="special_mention">Dalam Perhatian</option>
            <option value="substandard">Kurang Lancar</option>
            <option value="doubtful">Diragukan</option>
            <option value="loss">Macet</option>
          </select>
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
            placeholder="Saldo awal portofolio pinjaman sebelum ORVIA"
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
          />
        </div>

        <div className="flex items-end justify-end xl:col-span-2">
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 xl:w-auto"
          >
            Tambah Piutang Pinjaman
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        Mapping ORVIA otomatis ke akun 1210 Piutang Pinjaman Anggota dan 1220 Piutang Jasa/Margin Pinjaman.
        Data ini khusus unit Simpan Pinjam dan tidak memakai persediaan dagang.
      </p>
    </form>
  );
}
