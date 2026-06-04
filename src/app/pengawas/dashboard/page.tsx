import Link from "next/link";
import { ClipboardList, FileSearch, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PengawasDashboardPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Pengawas / Dashboard"
        title="Dashboard Pengawas"
        description="Pantau aktivitas audit, laporan, dan kepatuhan BUMDes sesuai scope pengawasan. Data final nantinya bersumber dari audit timeline, report views, dan governance engine database."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Laporan Ditinjau"
          value="0"
          description="Menunggu reporting views."
          icon={<FileSearch className="h-5 w-5" />}
        />
        <StatCard
          title="Temuan Audit"
          value="0"
          description="Akan terhubung ke audit findings."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Status Pengawasan"
          value="Siap"
          description="Scope akses akan dikendalikan database."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <div className="mb-5 grid gap-5 md:grid-cols-2">
        <Link
          href="/pengawas/dashboard/transparansi-transaksi"
          className="group rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Modul Baru
              </p>
              <h2 className="mt-2 text-lg font-bold text-slate-950">
                Transparansi Transaksi
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Pantau catatan tanggal transaksi berbeda dari tanggal input, transaksi pada
                periode dibuka ulang, dan status review pengawasan.
              </p>
            </div>

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-100">
              <ClipboardList className="h-5 w-5" />
            </div>
          </div>

          <p className="mt-4 text-sm font-bold text-emerald-700">
            Buka Transparansi Transaksi →
          </p>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Aktivitas Pengawasan"
          description="Data akan terhubung ke audit timeline dan laporan setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Tanggal",
            "BUMDes",
            "Area",
            "Aktivitas",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada aktivitas pengawasan. Nanti pengawas dapat melihat laporan dan audit sesuai scope akses."
        />
      </Card>
    </div>
  );
}

