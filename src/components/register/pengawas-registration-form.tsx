"use client";

import { useActionState } from "react";
import { submitPengawasRegistration } from "@/app/register/pengawas/actions";

type TenantOption = {
  id: string;
  nama_bumdes: string | null;
  kode_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
};

type PengawasRegistrationFormProps = {
  tenants: TenantOption[];
};

const initialState = {
  success: false,
  message: "",
};

export function PengawasRegistrationForm({
  tenants,
}: PengawasRegistrationFormProps) {
  const [state, formAction] = useActionState(
    submitPengawasRegistration,
    initialState
  );

  return (
    <section className="mx-auto max-w-5xl">
      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">
            Registrasi Pengawas
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
            Daftar sebagai Pengawas BUMDes
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Akun Pengawas bekerja pada level BUMDes, bukan unit. Setelah dibuat,
            Pengawas dapat mereview koreksi transaksi dan cut-off migrasi seluruh unit
            dalam BUMDes yang dipilih.
          </p>
        </div>

        {state.message ? (
          <div
            className={`mb-5 rounded-2xl border p-4 text-sm font-semibold ${
              state.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {state.message}
          </div>
        ) : null}

        <form action={formAction} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label
                htmlFor="full_name"
                className="text-sm font-semibold text-slate-800"
              >
                Nama Lengkap
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                required
                placeholder="Nama Pengawas"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="phone" className="text-sm font-semibold text-slate-800">
                Nomor HP
              </label>
              <input
                id="phone"
                name="phone"
                type="text"
                placeholder="08xxxxxxxxxx"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-sm font-semibold text-slate-800">
                Email Login
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="pengawas@example.com"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="tenant_id"
                className="text-sm font-semibold text-slate-800"
              >
                BUMDes yang Diawasi
              </label>
              <select
                id="tenant_id"
                name="tenant_id"
                required
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Pilih BUMDes</option>
                {tenants.map((tenant) => (
                  <option key={tenant.id} value={tenant.id}>
                    {tenant.nama_bumdes ?? "BUMDes"} - {tenant.nama_desa ?? "Desa"} (
                    {tenant.nama_kecamatan ?? "Kecamatan"})
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Mapping engine: role pengawas akan dibuat di tenant BUMDes ini dengan unit_id kosong.
              </p>
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-slate-800"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label
                htmlFor="confirm_password"
                className="text-sm font-semibold text-slate-800"
              >
                Konfirmasi Password
              </label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                required
                minLength={8}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label htmlFor="notes" className="text-sm font-semibold text-slate-800">
              Catatan
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Contoh: Pengawas internal BUMDes Rajawali."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
            Akun ini langsung aktif untuk kebutuhan pengujian. Mapping yang dibuat:
            role pengawas, tenant sesuai BUMDes yang dipilih, dan unit_id kosong.
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
            >
              Daftar Pengawas
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
