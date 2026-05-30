"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  addSavingsLoanGroupMember,
  createSavingsLoanGroup,
  type GroupActionState,
} from "../actions";

type MemberOption = {
  id: string;
  member_no: string;
  full_name: string;
};

type GroupOption = {
  id: string;
  group_no: string;
  group_name: string;
};

const initialState: GroupActionState = {
  success: false,
  message: "",
};

function MessageBox({ state }: { state: GroupActionState }) {
  if (!state.message) return null;

  return (
    <div
      className={[
        "rounded-2xl border p-4 text-sm font-semibold leading-6",
        state.success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      ].join(" ")}
    >
      {state.message}
    </div>
  );
}

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CreateGroupForm({ members }: { members: MemberOption[] }) {
  const [state, formAction] = useActionState(createSavingsLoanGroup, initialState);

  return (
    <form
      action={formAction}
      className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold text-slate-950">Tambah Kelompok</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Buat kelompok anggota dan tetapkan ketua kelompok. Validasi anggota
          aktif dan scope unit diproses oleh engine database.
        </p>
      </div>

      <MessageBox state={state} />

      <div className="min-w-0 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Nomor Kelompok</span>
          <input
            name="group_no"
            required
            placeholder="Contoh: KLP-0003"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Nama Kelompok</span>
          <input
            name="group_name"
            required
            placeholder="Nama kelompok"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Ketua Kelompok</span>
          <select
            name="leader_member_id"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Pilih anggota</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.member_no} - {member.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Tanggal Pembentukan</span>
          <input
            name="formation_date"
            type="date"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Alamat / Wilayah Kelompok</span>
          <textarea
            name="address"
            rows={3}
            placeholder="Alamat atau wilayah kelompok"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Catatan</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Opsional"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>

      <SubmitButton label="Simpan Kelompok" pendingLabel="Menyimpan..." />
    </form>
  );
}

export function AddGroupMemberForm({
  groups,
  members,
}: {
  groups: GroupOption[];
  members: MemberOption[];
}) {
  const [state, formAction] = useActionState(addSavingsLoanGroupMember, initialState);

  return (
    <form
      action={formAction}
      className="min-w-0 space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-base font-bold text-slate-950">Tambah Anggota Kelompok</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          Hubungkan anggota aktif ke kelompok. Duplikasi dan keanggotaan tidak
          valid akan ditolak oleh engine database.
        </p>
      </div>

      <MessageBox state={state} />

      <div className="min-w-0 space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Kelompok</span>
          <select
            name="group_id"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Pilih kelompok</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.group_no} - {group.group_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Anggota</span>
          <select
            name="member_id"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="">Pilih anggota</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.member_no} - {member.full_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Peran</span>
          <select
            name="role_in_group"
            required
            defaultValue="member"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          >
            <option value="leader">Ketua</option>
            <option value="secretary">Sekretaris</option>
            <option value="treasurer">Bendahara</option>
            <option value="member">Anggota</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Tanggal Bergabung</span>
          <input
            name="joined_at"
            type="date"
            required
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-700">Catatan</span>
          <textarea
            name="notes"
            rows={3}
            placeholder="Opsional"
            className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
          />
        </label>
      </div>

      <SubmitButton label="Tambahkan Anggota" pendingLabel="Menambahkan..." />
    </form>
  );
}
