import { Card } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createUnitCutoffMigrationDraftAction } from "../actions";

export default function NewUnitCutoffMigrasiPage() {
  const defaultCutoffDate = "2025-12-31";
  const defaultOrviaStartDate = "2026-01-01";

  return (
    <div className="space-y-6">
      <PageBackButton
        fallbackHref="/unit/dashboard/cutoff-migrasi"
        label="Kembali ke Cut-off Migrasi"
      />

      <div>
        <p className="text-sm font-medium text-emerald-700">Cut-off Migrasi</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Buat Draft Cut-off Migrasi
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Buat header draft migrasi saldo awal. Setelah draft dibuat, komponen kas-bank,
          persediaan, aset tetap, kewajiban, dan ekuitas akan diisi pada tahap berikutnya.
        </p>
      </div>

      <Card className="p-5">
        <form action={createUnitCutoffMigrationDraftAction} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="cutoff_no"
                className="text-sm font-semibold text-slate-800"
              >
                Nomor Cut-off
              </label>
              <input
                id="cutoff_no"
                name="cutoff_no"
                type="text"
                required
                placeholder="CO-RJWL-2025-001"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="source_application_name"
                className="text-sm font-semibold text-slate-800"
              >
                Aplikasi / Sumber Lama
              </label>
              <input
                id="source_application_name"
                name="source_application_name"
                type="text"
                placeholder="Excel BUMDes / Aplikasi lama"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="cutoff_date"
                className="text-sm font-semibold text-slate-800"
              >
                Tanggal Cut-off
              </label>
              <input
                id="cutoff_date"
                name="cutoff_date"
                type="date"
                required
                defaultValue={defaultCutoffDate}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="orvia_start_date"
                className="text-sm font-semibold text-slate-800"
              >
                Tanggal Mulai ORVIA
              </label>
              <input
                id="orvia_start_date"
                name="orvia_start_date"
                type="date"
                required
                defaultValue={defaultOrviaStartDate}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="source_standard"
                className="text-sm font-semibold text-slate-800"
              >
                Standar / Format Sumber
              </label>
              <input
                id="source_standard"
                name="source_standard"
                type="text"
                placeholder="Kepmen 136 / Excel internal / lainnya"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="pre_orvia_profit_sharing_status"
                className="text-sm font-semibold text-slate-800"
              >
                Status Bagi Hasil Sebelum ORVIA
              </label>
              <select
                id="pre_orvia_profit_sharing_status"
                name="pre_orvia_profit_sharing_status"
                required
                defaultValue="not_applicable_or_settled"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="not_applicable_or_settled">
                  Tidak ada / sudah selesai
                </option>
                <option value="pending_distribution">
                  Masih ada kewajiban distribusi
                </option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="text-sm font-semibold text-slate-800">
              Catatan Awal
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Contoh: Migrasi saldo awal Unit Perdagangan per 31 Desember 2025."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Draft ini belum memposting jurnal dan belum mempengaruhi laporan. Posting hanya
            dapat dilakukan setelah validasi neraca, pengajuan, review Pengawas, dan approval.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Simpan Draft
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
