"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createApplicantFirstLoanApplication,
  type ApplicationActionState,
} from "../actions";

type GroupOption = {
  id: string;
  group_no: string;
  group_name: string;
};

const initialState: ApplicationActionState = {
  success: false,
  message: "",
};

function MessageBox({ state }: { state: ApplicationActionState }) {
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

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {pending ? "Mengirim pengajuan..." : "Kirim Pengajuan"}
    </button>
  );
}

function TextInput({
  label,
  name,
  required,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  required,
  placeholder,
  rows = 3,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      <textarea
        name={name}
        required={required}
        rows={rows}
        placeholder={placeholder}
        className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
      />
    </label>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="mt-1 text-base font-bold text-slate-950">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">
            {description}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-4 text-left transition",
        active
          ? "border-emerald-300 bg-emerald-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40",
      ].join(" ")}
    >
      <span
        className={[
          "inline-flex rounded-full px-3 py-1 text-xs font-bold",
          active
            ? "bg-emerald-600 text-white"
            : "bg-slate-100 text-slate-600",
        ].join(" ")}
      >
        {active ? "Dipilih" : "Pilih"}
      </span>
      <h4 className="mt-3 text-sm font-bold text-slate-950">{title}</h4>
      <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
    </button>
  );
}

function GroupMemberFields({ index }: { index: number }) {
  const isLeader = index === 0;

  return (
    <details
      open={index < 2}
      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
    >
      <summary className="cursor-pointer list-none">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-bold text-slate-950">
              {isLeader ? "Ketua Kelompok" : `Anggota ${index + 1}`}
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              {isLeader
                ? "Baris ini wajib diisi sebagai perwakilan kelompok."
                : "Buka jika ada anggota tambahan."}
            </p>
          </div>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-bold",
              isLeader
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-200 text-slate-600",
            ].join(" ")}
          >
            {isLeader ? "Wajib" : "Opsional"}
          </span>
        </div>
      </summary>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextInput
          label="Nama Lengkap"
          name={`group_member_${index}_full_name`}
          required={isLeader}
          placeholder="Nama anggota kelompok"
        />
        <TextInput
          label="NIK / Nomor Identitas"
          name={`group_member_${index}_identity_number`}
          placeholder="Minimal NIK atau HP"
        />
        <TextInput
          label="Nomor HP"
          name={`group_member_${index}_phone`}
          placeholder="Minimal NIK atau HP"
        />

        {!isLeader ? (
          <label className="block">
            <span className="text-sm font-semibold text-slate-700">
              Peran
            </span>
            <select
              name={`group_member_${index}_role_in_group`}
              defaultValue="member"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            >
              <option value="member">Anggota</option>
              <option value="secretary">Sekretaris</option>
              <option value="treasurer">Bendahara</option>
            </select>
          </label>
        ) : null}

        <TextInput
          label="Alamat"
          name={`group_member_${index}_address`}
          placeholder="Alamat anggota"
        />
      </div>

      <div className="mt-3">
        <TextArea
          label="Catatan Anggota"
          name={`group_member_${index}_notes`}
          placeholder="Opsional"
          rows={2}
        />
      </div>
    </details>
  );
}

export function ApplicantFirstApplicationForm({
  groups,
}: {
  groups: GroupOption[];
}) {
  const [state, formAction] = useActionState(
    createApplicantFirstLoanApplication,
    initialState,
  );
  const [applicationMethod, setApplicationMethod] = useState("individual");
  const [inputMode, setInputMode] = useState("self_service");

  const modeDescription = useMemo(() => {
    if (inputMode === "assisted_by_officer") {
      return "Petugas membantu input dan sistem akan mencatat alasan bantuan sebagai jejak audit.";
    }

    return "Pemohon mengisi sendiri dan menyetujui pernyataan kebenaran data.";
  }, [inputMode]);

  return (
    <form action={formAction} className="min-w-0 space-y-4">
      <input type="hidden" name="application_method" value={applicationMethod} />
      <input type="hidden" name="input_mode" value={inputMode} />

      <SectionCard
        eyebrow="Applicant-first intake"
        title="Ajukan Pinjaman"
        description="Mulai dari pengajuan. Data anggota dan kelompok akan dibuat atau dicocokkan otomatis oleh engine."
      >
        <MessageBox state={state} />

        <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-800">
          {modeDescription}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={applicationMethod === "individual"}
            title="Pengajuan Perorangan"
            description="Untuk satu pemohon. Cocok untuk calon anggota yang mengajukan atas nama pribadi."
            onClick={() => setApplicationMethod("individual")}
          />
          <ChoiceCard
            active={applicationMethod === "group"}
            title="Pengajuan Kelompok"
            description="Untuk kelompok usaha. Sistem membagi nilai pinjaman otomatis ke anggota."
            onClick={() => setApplicationMethod("group")}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={inputMode === "self_service"}
            title="Diisi Pemohon Sendiri"
            description="Pemohon menyatakan data benar dan dokumen dapat dipertanggungjawabkan."
            onClick={() => setInputMode("self_service")}
          />
          <ChoiceCard
            active={inputMode === "assisted_by_officer"}
            title="Dibantu Petugas"
            description="Petugas membantu input berdasarkan permintaan pemohon dan mencatat alasannya."
            onClick={() => setInputMode("assisted_by_officer")}
          />
        </div>

        <div className="mt-4">
          <TextInput
            label="Tanggal Pengajuan"
            name="application_date"
            type="date"
            required
          />
        </div>

        <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            Nomor pengajuan opsional
          </summary>
          <div className="mt-3">
            <TextInput
              label="Nomor Pengajuan"
              name="application_no"
              placeholder="Kosongkan untuk nomor otomatis"
            />
          </div>
        </details>
      </SectionCard>

      {applicationMethod === "individual" ? (
        <SectionCard
          title="Data Pemohon"
          description="Isi data pokok pemohon. Minimal NIK atau nomor HP wajib diisi agar engine bisa mencocokkan anggota."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Nama Lengkap Pemohon"
              name="applicant_full_name"
              required
              placeholder="Nama sesuai identitas"
            />
            <TextInput
              label="NIK / Nomor Identitas"
              name="applicant_identity_number"
              placeholder="Minimal NIK atau HP"
            />
            <TextInput
              label="Nomor HP"
              name="applicant_phone"
              placeholder="Minimal NIK atau HP"
            />
            <TextInput
              label="Alamat"
              name="applicant_address"
              placeholder="Alamat pemohon"
            />
          </div>
        </SectionCard>
      ) : null}

      {applicationMethod === "group" ? (
        <SectionCard
          title="Data Kelompok"
          description="Pilih kelompok existing atau buat kelompok baru langsung dari pengajuan."
        >
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">
                Kelompok Existing
              </span>
              <select
                name="existing_group_id"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Buat kelompok baru dari pengajuan</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.group_no} - {group.group_name}
                  </option>
                ))}
              </select>
            </label>

            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-700">
                Data kelompok baru
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <TextInput
                  label="Nomor Kelompok Baru"
                  name="group_no"
                  placeholder="Kosongkan untuk nomor otomatis"
                />
                <TextInput
                  label="Nama Kelompok Baru"
                  name="group_name"
                  placeholder="Wajib jika tidak memilih existing"
                />
              </div>
              <div className="mt-3">
                <TextInput
                  label="Alamat Kelompok"
                  name="group_address"
                  placeholder="Alamat/wilayah kelompok"
                />
              </div>
            </details>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              Nilai pinjaman akan dibagi rata otomatis ke ketua dan anggota yang diisi.
              Baris ketua dan minimal satu anggota wajib diisi.
            </div>

            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((index) => (
                <GroupMemberFields key={index} index={index} />
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        title="Rencana Pinjaman"
        description="Isi nilai pinjaman, kemampuan angsur, dan tujuan penggunaan dana."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="Nilai Pinjaman Dimohon"
            name="requested_amount"
            required
            inputMode="numeric"
            placeholder="Contoh: 5000000"
          />
          <TextInput
            label="Tenor Bulan"
            name="tenor_months"
            required
            type="number"
            placeholder="Contoh: 12"
          />
          <TextInput
            label="Sumber Penghasilan"
            name="income_source"
            required
            placeholder="Contoh: hasil usaha harian"
          />
          <TextInput
            label="Kemampuan Angsur Per Bulan"
            name="estimated_repayment_capacity"
            required
            inputMode="numeric"
            placeholder="Contoh: 750000"
          />
          <TextInput
            label="Jenis Usaha / Pekerjaan"
            name="business_or_job_type"
            required
            placeholder="Contoh: pedagang kios"
          />
        </div>

        <div className="mt-3">
          <TextArea
            label="Tujuan Pinjaman"
            name="loan_purpose"
            required
            placeholder="Contoh: tambahan modal usaha"
          />
        </div>

        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">
            Catatan tambahan
          </summary>
          <div className="mt-3">
            <TextArea label="Catatan" name="notes" placeholder="Opsional" />
          </div>
        </details>
      </SectionCard>

      <SectionCard
        title="Dokumen dan Pernyataan"
        description="Dokumen pendukung wajib berupa PDF. Pernyataan disesuaikan dengan mode input."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            label="URL Dokumen PDF"
            name="supporting_document_url"
            required
            placeholder="Contoh: https://.../dokumen.pdf"
          />
          <TextInput
            label="Nama Dokumen PDF"
            name="supporting_document_name"
            required
            placeholder="Contoh: pengajuan-pinjaman.pdf"
          />
        </div>

        {inputMode === "assisted_by_officer" ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-bold text-amber-900">
              Pernyataan Dibantu Petugas
            </h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              Engine akan mencatat petugas, alasan bantuan, dan metadata surat
              pernyataan.
            </p>
            <div className="mt-3">
              <TextArea
                label="Alasan Dibantu Petugas"
                name="assisted_reason"
                required
                placeholder="Contoh: pemohon datang ke kantor unit dan meminta bantuan input"
              />
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <label className="flex items-start gap-3">
              <input
                name="declaration_accepted"
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-sm font-semibold leading-6 text-emerald-800">
                Saya menyatakan bahwa data pengajuan ini benar dan dokumen
                pendukung dapat dipertanggungjawabkan.
              </span>
            </label>
          </div>
        )}
      </SectionCard>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SubmitButton />
      </div>
    </form>
  );
}


