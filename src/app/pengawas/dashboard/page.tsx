import { FileSearch, ShieldCheck } from "lucide-react";
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
