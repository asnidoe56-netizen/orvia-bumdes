import Link from "next/link";
import { Card } from "@/components/ui/card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

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

export default async function UnitCutoffMigrasiPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_cutoff_migrations")
    .select(
      "id, cutoff_no, cutoff_date, orvia_start_date, status, total_assets, total_liabilities, total_equity, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Gagal memuat cut-off migrasi unit.");
  }

  const rows = (data ?? []) as CutoffRow[];

  return (
    <div className="space-y-6">
      <PageBackButton fallbackHref="/unit/dashboard" label="Kembali ke Dashboard Unit" />

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-emerald-700">Cut-off Migrasi</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            Draft Cut-off Migrasi Unit
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Siapkan saldo awal unit dari aplikasi lama sebelum masuk ke engine ORVIA.
            Draft belum mempengaruhi jurnal, kas-bank, persediaan, aset tetap, maupun laporan
            sampai disetujui dan diposting.
          </p>
        </div>

        <Link
          href="/unit/dashboard/cutoff-migrasi/new"
          className="inline-flex items-center justify-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800"
        >
          Buat Draft Cut-off
        </Link>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-200 p-5">
          <h2 className="text-lg font-semibold text-slate-950">Daftar Cut-off Unit</h2>
          <p className="mt-1 text-sm text-slate-600">
            Validasi neraca wajib seimbang sebelum draft diajukan ke Pengawas.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="p-5 text-sm text-slate-600">
            Belum ada draft cut-off migrasi untuk unit ini.
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-900">
                      <Link
                        href={`/unit/dashboard/cutoff-migrasi/${row.id}`}
                        className="font-bold text-emerald-700 hover:text-emerald-900 hover:underline"
                      >
                        {row.cutoff_no ?? "-"}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(row.cutoff_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-700">
                      {formatDate(row.orvia_start_date)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
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


