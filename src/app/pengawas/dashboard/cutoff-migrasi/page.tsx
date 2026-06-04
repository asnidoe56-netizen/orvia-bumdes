import { Card } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";
import {
  approveCutoffMigrationAction,
  rejectCutoffMigrationAction,
  startReviewCutoffMigrationAction,
} from "./actions";

type CutoffRow = {
  id: string;
  cutoff_no: string | null;
  cutoff_date: string | null;
  orvia_start_date: string | null;
  status: string | null;
  total_assets: number | null;
  total_liabilities: number | null;
  total_equity: number | null;
  created_at: string | null;
};

function formatRupiah(value: number | null) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(status: string | null) {
  const value = status ?? "draft";

  const labels: Record<string, string> = {
    draft: "Draft",
    validated: "Tervalidasi",
    submitted: "Diajukan",
    under_review: "Dalam Review",
    approved: "Disetujui",
    rejected: "Ditolak",
    posted: "Posted",
    cancelled: "Dibatalkan",
  };

  return labels[value] ?? value;
}

function statusClass(status: string | null) {
  switch (status) {
    case "submitted":
      return "bg-amber-50 text-amber-700";
    case "under_review":
      return "bg-sky-50 text-sky-700";
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function PengawasCutoffMigrasiPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks login Pengawas tidak valid.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_cutoff_migrations")
    .select(
      "id, cutoff_no, cutoff_date, orvia_start_date, status, total_assets, total_liabilities, total_equity, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .in("status", ["submitted", "under_review", "approved", "rejected"])
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Gagal memuat review cut-off migrasi.");
  }

  const rows = (data ?? []) as CutoffRow[];

  return (
    <div className="space-y-6">
      <PageBackButton
        fallbackHref="/pengawas/dashboard"
        label="Kembali ke Dashboard Pengawas"
      />

      <div>
        <p className="text-sm font-medium text-emerald-700">Cut-off Migrasi</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Review Cut-off Migrasi
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Tinjau draft cut-off migrasi yang sudah diajukan unit. Pengawas dapat
          memulai review, menyetujui, atau menolak draft berdasarkan kesesuaian
          neraca, komponen laporan, dan dokumen pendukung.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Daftar Review Cut-off
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Draft yang tampil di sini adalah draft yang sudah diajukan atau sedang
            direview.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Belum ada cut-off migrasi yang perlu direview.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Nomor</th>
                  <th className="px-5 py-3">Cut-off</th>
                  <th className="px-5 py-3">Mulai ORVIA</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Aset</th>
                  <th className="px-5 py-3 text-right">Kewajiban</th>
                  <th className="px-5 py-3 text-right">Ekuitas</th>
                  <th className="px-5 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                      {row.cutoff_no ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(row.cutoff_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(row.orvia_start_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                          row.status
                        )}`}
                      >
                        {statusLabel(row.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {formatRupiah(row.total_assets)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {formatRupiah(row.total_liabilities)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-right text-slate-700">
                      {formatRupiah(row.total_equity)}
                    </td>
                    <td className="min-w-[280px] px-5 py-4">
                      {row.status === "submitted" ? (
                        <form action={startReviewCutoffMigrationAction}>
                          <input
                            type="hidden"
                            name="cutoff_migration_id"
                            value={row.id}
                          />
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-lg border border-sky-600 bg-white px-3 py-2 text-xs font-semibold text-sky-700 shadow-sm hover:bg-sky-50"
                          >
                            Mulai Review
                          </button>
                        </form>
                      ) : null}

                      {row.status === "under_review" ? (
                        <div className="flex flex-col gap-2">
                          <form action={approveCutoffMigrationAction}>
                            <input
                              type="hidden"
                              name="cutoff_migration_id"
                              value={row.id}
                            />
                            <input
                              type="hidden"
                              name="governance_notes"
                              value="Disetujui oleh Pengawas."
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                            >
                              Setujui
                            </button>
                          </form>

                          <form
                            action={rejectCutoffMigrationAction}
                            className="flex min-w-[260px] gap-2"
                          >
                            <input
                              type="hidden"
                              name="cutoff_migration_id"
                              value={row.id}
                            />
                            <input
                              type="text"
                              name="rejection_reason"
                              placeholder="Alasan tolak"
                              required
                              className="w-36 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-rose-500"
                            />
                            <button
                              type="submit"
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
                            >
                              Tolak
                            </button>
                          </form>
                        </div>
                      ) : null}

                      {row.status === "approved" ? (
                        <p className="text-xs text-emerald-700">
                          Sudah disetujui. Menunggu proses posting BUMDes.
                        </p>
                      ) : null}

                      {row.status === "rejected" ? (
                        <p className="text-xs text-rose-700">
                          Sudah ditolak. Unit perlu memperbaiki cut-off migrasi.
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}


