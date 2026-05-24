import { Activity, AlertTriangle, BarChart3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function BumdesMonitoringPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Monitoring"
        title="Monitoring BUMDes"
        description="Pantau aktivitas, status operasional, dan kondisi unit usaha dalam satu tenant BUMDes. Data monitoring final nantinya bersumber dari view dan audit timeline database."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Aktivitas Unit"
          value="0"
          description="Menunggu data audit timeline."
          icon={<Activity className="h-5 w-5" />}
        />
        <StatCard
          title="Indikator Kinerja"
          value="Siap"
          description="Akan dibaca dari reporting views."
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <StatCard
          title="Perlu Perhatian"
          value="0"
          description="Akan menampilkan anomali atau status bermasalah."
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Aktivitas Monitoring"
          description="Riwayat aktivitas akan terhubung ke audit timeline dan view monitoring setelah database engine siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Waktu",
            "Unit",
            "Aktivitas",
            "Status",
            "Catatan",
            "Aksi",
          ]}
          emptyText="Belum ada aktivitas monitoring. Setelah audit engine aktif, aktivitas penting akan muncul di sini."
        />
      </Card>
    </div>
  );
}
