export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  approveTenantRegistration,
  rejectTenantRegistration,
} from "../actions";

type RegistrationStatus = "pending" | "approved" | "rejected";

type TenantRegistrationDetail = {
  [key: string]: string | number | boolean | null | undefined;
  id: string;
  nama_bumdes?: string | null;
  kode_bumdes?: string | null;
  nama_desa?: string | null;
  nama_kecamatan?: string | null;
  requester_name?: string | null;
  requester_phone?: string | null;
  requester_email?: string | null;
  status?: RegistrationStatus | string | null;
  created_at?: string | null;
  rejection_reason?: string | null;
};

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: string | null | undefined }) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Disetujui
      </span>
    );
  }

  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
        <XCircle className="h-3.5 w-3.5" />
        Ditolak
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
      <Clock className="h-3.5 w-3.5" />
      Pending
    </span>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | null | undefined;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value === null || value === undefined || value === "" ? "-" : String(value)}
      </p>
    </div>
  );
}

export default async function RegistrationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_registrations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const registration = data as TenantRegistrationDetail;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link
          href="/platform/dashboard/registrations"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar registrasi
        </Link>

        <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Detail Pengajuan Registrasi
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {registration.nama_bumdes || "Registrasi BUMDes"}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Periksa data pengajuan sebelum menyetujui atau menolak registrasi.
            </p>
          </div>

          <StatusBadge status={registration.status} />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Informasi BUMDes
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailItem label="Nama BUMDes" value={registration.nama_bumdes} />
              <DetailItem label="Kode BUMDes" value={registration.kode_bumdes} />
              <DetailItem label="Desa" value={registration.nama_desa} />
              <DetailItem label="Kecamatan" value={registration.nama_kecamatan} />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Informasi Pemohon
            </h2>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <DetailItem label="Nama Pemohon" value={registration.requester_name} />
              <DetailItem label="Nomor HP" value={registration.requester_phone} />
              <DetailItem label="Email" value={registration.requester_email} />
              <DetailItem label="Tanggal Pengajuan" value={formatDate(registration.created_at)} />
            </div>
          </div>

          {registration.rejection_reason ? (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-red-800">
                Alasan Penolakan
              </h2>
              <p className="mt-2 text-sm font-medium text-red-700">
                {registration.rejection_reason}
              </p>
            </div>
          ) : null}
        </div>

        <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Keputusan Review
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Pastikan data sudah sesuai sebelum diproses.
          </p>

          {registration.status === "pending" ? (
            <div className="mt-5 space-y-3">
              <form action={approveTenantRegistration}>
                <input type="hidden" name="registration_id" value={registration.id} />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
                >
                  Setujui Registrasi
                </button>
              </form>

              <form action={rejectTenantRegistration} className="space-y-2">
                <input type="hidden" name="registration_id" value={registration.id} />
                <textarea
                  name="rejection_reason"
                  rows={4}
                  placeholder="Tulis alasan penolakan"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100"
                >
                  Tolak Registrasi
                </button>
              </form>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Pengajuan ini sudah diproses.
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}