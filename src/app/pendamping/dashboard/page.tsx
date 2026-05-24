import { ClipboardCheck, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PendampingDashboardPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Pendamping / Dashboard"
        title="Dashboard Pendamping"
        description="Pantau progres pendampingan BUMDes, status unit usaha, dan tindak lanjut pembinaan sesuai wilayah atau scope akses."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="BUMDes Didampingi"
          value="0"
          description="Menunggu scope pendampingan database."
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Progres Aktif"
          value="0"
          description="Akan dibaca dari data progres BUMDes."
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatCard
          title="Tindak Lanjut"
          value="0"
          description="Catatan pendampingan yang perlu diproses."
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Aktivitas Pendampingan"
          description="Data akan terhubung ke modul pendampingan setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Tanggal",
            "BUMDes",
            "Area Pendampingan",
            "Progres",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada aktivitas pendampingan. Nanti progres BUMDes akan terlihat sesuai scope akses pendamping."
        />
      </Card>
    </div>
  );
}
