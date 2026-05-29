export const dynamic = "force-dynamic";

import { CheckCircle2, Clock, Landmark, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  approveBupatiRegistration,
  rejectBupatiRegistration,
} from "./actions";

type BupatiRegistration = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  jabatan: string | null;
  instansi: string | null;
  wilayah_kabupaten: string | null;
  notes: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
};

function StatusBadge({ status }: { status: BupatiRegistration["status"] }) {
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

export default async function PlatformBupatiRegistrationsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bupati_registrations")
    .select(
      "id, full_name, email, phone, jabatan, instansi, wilayah_kabupaten, notes, status, rejection_reason, created_at"
    )
    .order("created_at", { ascending: false });

  const registrations = (data ?? []) as BupatiRegistration[];

  const pendingCount = registrations.filter((item) => item.status === "pending").length;
  const approvedCount = registrations.filter((item) => item.status === "approved").length;
  const rejectedCount = registrations.filter((item) => item.status === "rejected").length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Admin Platform / Registrasi Bupati
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Registrasi Akses Bupati
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review pengajuan akses Bupati. Saat disetujui, sistem otomatis memberi role
          bupati dan mengarahkan akun ke Dashboard Bupati.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          Gagal membaca data registrasi Bupati: {error.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Menunggu Review</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{pendingCount}</p>
          <p className="mt-2 text-sm text-slate-500">Registrasi belum diproses.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Disetujui</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{approvedCount}</p>
          <p className="mt-2 text-sm text-slate-500">Akun Bupati sudah aktif.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Ditolak</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{rejectedCount}</p>
          <p className="mt-2 text-sm text-slate-500">Pengajuan tidak lolos validasi.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Daftar Pengajuan Bupati
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Total data: {registrations.length} pengajuan.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <Landmark className="h-3.5 w-3.5" />
            Executive Monitoring
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Pejabat</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Jabatan</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Instansi/Wilayah</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {registrations.length > 0 ? (
                  registrations.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-950">{item.full_name}</div>
                        <div className="text-xs font-medium text-slate-500">{item.email}</div>
                        <div className="text-xs text-slate-400">{item.phone || "-"}</div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase text-slate-700">
                          {item.jabatan || "-"}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        <div className="font-medium">{item.instansi || "-"}</div>
                        <div className="mt-1 max-w-xs text-xs text-slate-500">
                          {item.wilayah_kabupaten || item.notes || item.rejection_reason || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-4 py-4 text-slate-600">
                        {new Date(item.created_at).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      <td className="px-4 py-4">
                        {item.status === "pending" ? (
                          <div className="flex min-w-72 flex-col gap-2">
                            <form action={approveBupatiRegistration}>
                              <input type="hidden" name="registration_id" value={item.id} />
                              <button
                                type="submit"
                                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                              >
                                Setujui
                              </button>
                            </form>

                            <form action={rejectBupatiRegistration} className="flex gap-2">
                              <input type="hidden" name="registration_id" value={item.id} />
                              <input
                                name="rejection_reason"
                                placeholder="Alasan tolak"
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                              />
                              <button
                                type="submit"
                                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                              >
                                Tolak
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">
                            Sudah diproses
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada pengajuan registrasi Bupati.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
