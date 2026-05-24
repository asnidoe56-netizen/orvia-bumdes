import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function UnitReportsPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Unit / Laporan"
        title="Laporan Unit"
        description="Pantau laporan operasional dan keuangan unit usaha. Data laporan nantinya bersumber dari reporting views database agar konsisten dengan jurnal, stok, kas-bank, dan closing."
        action={
          <Button type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Ekspor
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Laporan Tersedia"
          value="0"
          description="Menunggu reporting views."
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Periode Aktif"
          value="-"
          description="Akan dibaca dari accounting periods."
          icon={<FileText className="h-5 w-5" />}
        />
        <StatCard
          title="Status Closing"
          value="Terbuka"
          description="Closing akan dikendalikan database."
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Laporan Unit"
          description="Laporan akan terhubung ke view database setelah accounting, inventory, sales, purchasing, dan cash-bank engine siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Periode",
            "Jenis Laporan",
            "Status Data",
            "Status Closing",
            "Aksi",
          ]}
          emptyText="Belum ada laporan unit. Nanti laporan akan dibaca dari view database, bukan dihitung manual di frontend."
        />
      </Card>
    </div>
  );
}
