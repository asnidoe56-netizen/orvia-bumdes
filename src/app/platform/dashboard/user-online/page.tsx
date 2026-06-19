export const dynamic = "force-dynamic";

import { Clock, MonitorDot, Users, Wifi, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

type OnlineUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: string | null;
  tenant_id: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  unit_id: string | null;
  nama_unit: string | null;
  current_path: string | null;
  page_title: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  seconds_since_seen: number | null;
  is_online: boolean | null;
};

const roleLabels: Record<string, string> = {
  super_admin_platform: "Super Admin Platform",
  direktur_bumdes: "Direktur BUMDes",
  admin_bumdes: "Admin BUMDes",
  manager_unit: "Manager Unit",
  operator_unit: "Operator Unit",
  viewer_unit: "Viewer Unit",
  pengawas: "Pengawas",
  pendamping_kecamatan: "Pendamping Kecamatan",
  pendamping: "Pendamping",
  dinas_pmd: "Dinas PMD",
  inspektorat: "Inspektorat",
  bupati: "Bupati",
};

function getRoleLabel(role: string | null) {
  if (!role) return "-";
  return roleLabels[role] ?? role.replace(/_/g, " ");
}

function getDisplayName(user: OnlineUser) {
  return user.full_name?.trim() || user.email || "Pengguna";
}

function getScopeLabel(user: OnlineUser) {
  if (user.nama_unit) {
    return user.nama_bumdes
      ? `${user.nama_bumdes} / ${user.nama_unit}`
      : user.nama_unit;
  }

  if (user.nama_bumdes) {
    return user.nama_bumdes;
  }

  if (user.nama_kecamatan) {
    return user.nama_desa
      ? `${user.nama_desa}, ${user.nama_kecamatan}`
      : user.nama_kecamatan;
  }

  return "Platform";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLastSeen(seconds: number | null) {
  if (seconds === null || seconds === undefined) return "-";

  if (seconds < 60) {
    return `${seconds} detik lalu`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} menit lalu`;
  }

  const hours = Math.floor(minutes / 60);
  return `${hours} jam lalu`;
}

function StatusBadge({ online }: { online: boolean | null }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
        <Wifi className="h-3.5 w-3.5" />
        Online
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
      <WifiOff className="h-3.5 w-3.5" />
      Offline
    </span>
  );
}

export default async function PlatformUserOnlinePage() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_platform_online_users", {
    p_online_window_minutes: 5,
  });

  const users = (data ?? []) as OnlineUser[];
  const onlineUsers = users.filter((user) => user.is_online);
  const offlineUsers = users.filter((user) => !user.is_online);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Admin Platform / User Online
        </p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          User Online
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Pantau pengguna yang sedang aktif berdasarkan aktivitas terakhir dalam 5 menit.
        </p>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          Gagal membaca data user online: {error.message}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Sedang Online</p>
            <Wifi className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-950">{onlineUsers.length}</p>
          <p className="mt-2 text-sm text-slate-500">Aktif dalam 5 menit terakhir.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Pernah Terpantau</p>
            <Users className="h-5 w-5 text-slate-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-950">{users.length}</p>
          <p className="mt-2 text-sm text-slate-500">User yang pernah mengirim heartbeat.</p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-500">Tidak Aktif</p>
            <WifiOff className="h-5 w-5 text-slate-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-950">{offlineUsers.length}</p>
          <p className="mt-2 text-sm text-slate-500">Last seen lebih dari 5 menit.</p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Aktivitas Pengguna
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Data dibaca dari engine presence database.
            </p>
          </div>

          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            <MonitorDot className="h-3.5 w-3.5" />
            Auto heartbeat 60 detik
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Pengguna</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Scope</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Halaman</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Terakhir Aktif</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {users.length > 0 ? (
                  users.map((user) => (
                    <tr key={user.user_id} className="hover:bg-slate-50">
                      <td className="px-4 py-4">
                        <div className="font-bold text-slate-950">
                          {getDisplayName(user)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {user.email || user.phone || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {getRoleLabel(user.role)}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {getScopeLabel(user)}
                      </td>

                      <td className="px-4 py-4">
                        <div className="max-w-xs truncate font-medium text-slate-800">
                          {user.page_title || "-"}
                        </div>
                        <div className="max-w-xs truncate text-xs text-slate-500">
                          {user.current_path || "-"}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-1 font-medium text-slate-800">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatLastSeen(user.seconds_since_seen)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {formatDateTime(user.last_seen_at)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge online={user.is_online} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                      Belum ada aktivitas user. Data akan muncul setelah user membuka dashboard.
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
