import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  approveTenantRegistration,
  rejectTenantRegistration,
} from "./actions";

type TenantRegistration = {
  id: string;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_email: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

function StatusBadge({ status }: { status: TenantRegistration["status"] }) {
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

export default async function PlatformRegistrationsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tenant_registrations")
    .select(
      "id, nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan, requester_name, requester_phone, requester_email, status, created_at"
    )
    .order("created_at", { ascending: false });

  const registrations = (data ?? []) as TenantRegistration[];

  const pendingCount = registrations.filter((item) => item.status === "pending").length;
  const approvedCount = registrations.filter((item) => item.status === "approved").length;
  const rejectedCount = registrations.filter((item) => item.status === "rejected").length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Admin Platform / Registrasi
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Registrasi BUMDes
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review pengajuan BUMDes, lalu setujui menjadi tenant aktif atau tolak dengan alasan.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          Gagal membaca data registrasi: {error.message}
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
          <p className="mt-2 text-sm text-slate-500">BUMDes sudah menjadi tenant.</p>
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
              Daftar Pengajuan Registrasi
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Total data: {registrations.length} pengajuan.
            </p>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Database Connected
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">BUMDes</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Desa</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Kecamatan</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Pemohon</th>
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
                        <div className="font-bold text-slate-950">{item.nama_bumdes}</div>
                        <div className="text-xs font-medium text-slate-500">{item.kode_bumdes}</div>
                      </td>

                      <td className="px-4 py-4 text-slate-700">{item.nama_desa}</td>
                      <td className="px-4 py-4 text-slate-700">{item.nama_kecamatan}</td>

                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-800">{item.requester_name || "-"}</div>
                        <div className="text-xs text-slate-500">
                          {item.requester_phone || item.requester_email || "-"}
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
                            <form action={approveTenantRegistration}>
                              <input type="hidden" name="registration_id" value={item.id} />
                              <button
                                type="submit"
                                className="w-full rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                              >
                                Setujui
                              </button>
                            </form>

                            <form action={rejectTenantRegistration} className="flex gap-2">
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
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada pengajuan registrasi.
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
