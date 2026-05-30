"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import {
  submitPublicLoanApplication,
  type PublicLoanApplicationActionState,
} from "../actions";

type PublicFormMetadata = {
  public_slug: string;
  title: string;
  description: string | null;
  nama_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
  nama_unit: string;
  kode_unit: string;
  allow_individual: boolean;
  allow_group: boolean;
  require_pdf: boolean;
  max_requested_amount: number | null;
  min_tenor_months: number | null;
  max_tenor_months: number | null;
};

type PublicLoanApplicationFormProps = {
  metadata: PublicFormMetadata;
  token: string;
};

const initialState: PublicLoanApplicationActionState = {
  success: false,
  message: "",
};

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel";
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <input
        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  required = false,
  placeholder,
}: {
  label: string;
  name: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-slate-700">
      {label}
      <textarea
        className="min-h-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
        name={name}
        required={required}
        placeholder={placeholder}
      />
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-950">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function GroupMemberFields({ index }: { index: number }) {
  const isLeader = index === 0;

  return (
    <details
      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
      open={index < 2}
    >
      <summary className="cursor-pointer text-sm font-bold text-slate-800">
        {isLeader ? "Ketua Kelompok" : `Anggota ${index + 1}`}
      </summary>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field
          label="Nama Lengkap"
          name={`group_member_${index}_full_name`}
          required={index < 2}
          placeholder="Nama anggota"
        />
        <Field
          label="NIK / Identitas"
          name={`group_member_${index}_identity_number`}
          placeholder="Nomor identitas"
        />
        <Field
          label="Nomor HP"
          name={`group_member_${index}_phone`}
          required={index < 2}
          inputMode="tel"
          placeholder="08..."
        />
        <Field
          label="Alamat"
          name={`group_member_${index}_address`}
          placeholder="Alamat anggota"
        />
        <input
          type="hidden"
          name={`group_member_${index}_role_in_group`}
          value={isLeader ? "leader" : "member"}
        />
      </div>
    </details>
  );
}

export function PublicLoanApplicationForm({
  metadata,
  token,
}: PublicLoanApplicationFormProps) {
  const [method, setMethod] = useState(
    metadata.allow_individual ? "individual" : "group",
  );

  const [state, formAction, isPending] = useActionState(
    submitPublicLoanApplication,
    initialState,
  );

  const amountHelp = useMemo(() => {
    if (!metadata.max_requested_amount) {
      return "Isi sesuai kebutuhan pinjaman.";
    }

    return `Maksimal pengajuan Rp ${Number(
      metadata.max_requested_amount,
    ).toLocaleString("id-ID")}.`;
  }, [metadata.max_requested_amount]);

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="public_slug" value={metadata.public_slug} />
      <input type="hidden" name="public_token" value={token} />
      <input type="hidden" name="application_method" value={method} />

      <Section
        title="Pilih Jenis Pengajuan"
        description="Form ini dapat diisi tanpa login. Setelah dikirim, petugas unit akan memverifikasi data terlebih dahulu."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {metadata.allow_individual ? (
            <button
              className={`rounded-2xl border p-4 text-left transition ${
                method === "individual"
                  ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
                  : "border-slate-200 bg-white hover:border-emerald-300"
              }`}
              type="button"
              onClick={() => setMethod("individual")}
            >
              <p className="font-bold text-slate-950">Perorangan</p>
              <p className="mt-1 text-sm text-slate-600">
                Pengajuan atas nama satu pemohon.
              </p>
            </button>
          ) : null}

          {metadata.allow_group ? (
            <button
              className={`rounded-2xl border p-4 text-left transition ${
                method === "group"
                  ? "border-emerald-500 bg-emerald-50 ring-4 ring-emerald-100"
                  : "border-slate-200 bg-white hover:border-emerald-300"
              }`}
              type="button"
              onClick={() => setMethod("group")}
            >
              <p className="font-bold text-slate-950">Kelompok</p>
              <p className="mt-1 text-sm text-slate-600">
                Nilai pinjaman dibagi rata otomatis oleh sistem.
              </p>
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="Tanggal Pengajuan">
        <Field label="Tanggal" name="application_date" type="date" required />
      </Section>

      {method === "individual" ? (
        <Section title="Data Pemohon">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Lengkap" name="applicant_full_name" required />
            <Field label="NIK / Identitas" name="applicant_identity_number" />
            <Field
              label="Nomor HP"
              name="applicant_phone"
              required
              inputMode="tel"
            />
            <Field label="Alamat" name="applicant_address" />
          </div>
        </Section>
      ) : (
        <Section
          title="Data Kelompok"
          description="Isi ketua dan minimal satu anggota. Sistem akan membagi nilai pinjaman secara otomatis."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Kelompok" name="group_name" required />
            <Field label="Alamat Kelompok" name="group_address" />
          </div>

          <div className="grid gap-3">
            <GroupMemberFields index={0} />
            <GroupMemberFields index={1} />
            <GroupMemberFields index={2} />
            <GroupMemberFields index={3} />
            <GroupMemberFields index={4} />
          </div>
        </Section>
      )}

      <Section title="Rencana Pinjaman" description={amountHelp}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nilai Pinjaman Dimohon"
            name="requested_amount"
            required
            inputMode="numeric"
            placeholder="Contoh: 20000000"
          />
          <Field
            label="Tenor Bulan"
            name="tenor_months"
            required
            inputMode="numeric"
            placeholder="Contoh: 12"
          />
          <Field label="Sumber Penghasilan" name="income_source" required />
          <Field
            label="Kemampuan Angsur Per Bulan"
            name="estimated_repayment_capacity"
            required
            inputMode="numeric"
            placeholder="Contoh: 700000"
          />
          <Field
            label="Jenis Usaha / Pekerjaan"
            name="business_or_job_type"
            required
          />
        </div>

        <TextArea label="Tujuan Pinjaman" name="loan_purpose" required />
        <TextArea label="Catatan Tambahan" name="notes" />
      </Section>

      <Section
        title="Dokumen Pendukung"
        description="Untuk tahap awal, masukkan URL dokumen PDF. Integrasi upload file langsung bisa ditambahkan setelah storage policy disiapkan."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="URL Dokumen PDF"
            name="supporting_document_url"
            required
            placeholder="https://..."
          />
          <Field
            label="Nama Dokumen PDF"
            name="supporting_document_name"
            required
            placeholder="dokumen-pengajuan.pdf"
          />
        </div>

        <label className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-slate-700">
          <input
            className="mt-1 size-4 rounded border-emerald-300"
            name="declaration_accepted"
            type="checkbox"
            required
          />
          <span>
            Saya menyatakan bahwa data pengajuan ini benar dan dokumen yang
            disampaikan dapat dipertanggungjawabkan.
          </span>
        </label>
      </Section>

      {state.message ? (
        <div
          className={`rounded-2xl border p-4 text-sm font-semibold ${
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {state.message}
          {state.applicationNo ? (
            <p className="mt-1 text-xs">Nomor pengajuan: {state.applicationNo}</p>
          ) : null}
        </div>
      ) : null}

      <button
        className="rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-200 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Mengirim Pengajuan..." : "Kirim Pengajuan"}
      </button>
    </form>
  );
}