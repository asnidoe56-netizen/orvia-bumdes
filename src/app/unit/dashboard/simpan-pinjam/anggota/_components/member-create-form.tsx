"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createSavingsLoanMember,
  type SavingsLoanMemberActionState,
} from "../actions";

const initialState: SavingsLoanMemberActionState = {
  success: false,
  message: "",
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? "Menyimpan..." : "Simpan Anggota"}
    </button>
  );
}

export function MemberCreateForm() {
  const [state, formAction] = useActionState(
    createSavingsLoanMember,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold text-slate-950">
          Tambah Anggota
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Isi data anggota dalam bahasa operasional. Validasi unit Simpan
          Pinjam diproses oleh engine database.
        </p>
      </div>

      {state.message ? (
        <div
          className={[
            "rounded-2xl border p-4 text-sm font-semibold",
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-rose-200 bg-rose-50 text-rose-700",
          ].join(" ")}
        >
          {state.message}
        </div>
      ) : null}

      <div className="min-w-0 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Nomor Anggota
          </span>
          <input
            name="member_no"
            required
            placeholder="Contoh: AGT-0003"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Nama Lengkap
          </span>
          <input
            name="full_name"
            required
            placeholder="Nama anggota"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            NIK / Nomor Identitas
          </span>
          <input
            name="identity_number"
            placeholder="Opsional"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Nomor HP
          </span>
          <input
            name="phone"
            placeholder="Contoh: 08xxxxxxxxxx"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Tanggal Bergabung
          </span>
          <input
            name="join_date"
            type="date"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Alamat
          </span>
          <textarea
            name="address"
            rows={3}
            placeholder="Alamat anggota"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">
            Catatan
          </span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Opsional"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}

