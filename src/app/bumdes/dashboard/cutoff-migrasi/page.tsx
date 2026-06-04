import { Card } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";
import { postBumdesCutoffMigrationAction } from "./actions";

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
    case "approved":
      return "bg-emerald-50 text-emerald-700";
    case "posted":
      return "bg-indigo-50 text-indigo-700";
    case "rejected":
      return "bg-rose-50 text-rose-700";
    case "under_review":
      return "bg-sky-50 text-sky-700";
    case "submitted":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default async function BumdesCutoffMigrasiPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks login BUMDes tidak valid.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_cutoff_migrations")
    .select(
      "id, cutoff_no, cutoff_date, orvia_start_date, status, total_assets, total_liabilities, total_equity, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Gagal memuat monitoring cut-off migrasi.");
  }

  const rows = (data ?? []) as CutoffRow[];

  return (
    <div className="space-y-6">
      <PageBackButton
        fallbackHref="/bumdes/dashboard"
        label="Kembali ke Dashboard BUMDes"
      />

      <div>
        <p className="text-sm font-medium text-emerald-700">Cut-off Migrasi</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
          Monitoring & Posting Cut-off Migrasi
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Pantau cut-off migrasi seluruh unit dan lakukan posting setelah draft
          disetujui Pengawas. Posting akan membentuk jurnal saldo awal serta
          mengalir ke engine kas-bank, persediaan, aset tetap, dan ekuitas.
        </p>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">
            Daftar Cut-off BUMDes
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Hanya status disetujui yang boleh diposting ke engine ORVIA.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Belum ada cut-off migrasi dari unit usaha.
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
                  <tr key={row.id} className="hover:bg-slate-50">
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
                    <td className="whitespace-nowrap px-5 py-4">
                      {row.status === "approved" ? (
                        <form action={postBumdesCutoffMigrationAction}>
                          <input
                            type="hidden"
                            name="cutoff_migration_id"
                            value={row.id}
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                          >
                            Posting Cut-off
                          </button>
                        </form>
                      ) : null}

                      {row.status === "posted" ? (
                        <p className="text-xs font-medium text-indigo-700">
                          Sudah diposting ke engine ORVIA.
                        </p>
                      ) : null}

                      {row.status !== "approved" && row.status !== "posted" ? (
                        <p className="text-xs text-slate-500">
                          Menunggu status disetujui Pengawas.
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
