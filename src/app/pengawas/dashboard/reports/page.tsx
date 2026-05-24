import { Download, FileSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PengawasReportsPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Pengawas / Laporan"
        title="Laporan Pengawas"
        description="Tinjau laporan BUMDes dan unit usaha sesuai scope pengawasan. Data laporan nantinya berasal dari reporting views dan status closing database."
        action={
          <Button type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Ekspor
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Laporan Masuk"
          value="0"
          description="Menunggu reporting views."
          icon={<FileSearch className="h-5 w-5" />}
        />
        <StatCard
          title="Perlu Review"
          value="0"
          description="Laporan yang perlu ditinjau pengawas."
          icon={<FileSearch className="h-5 w-5" />}
        />
        <StatCard
          title="Sudah Ditinjau"
          value="0"
          description="Laporan yang sudah selesai ditinjau."
          icon={<FileSearch className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Laporan"
          description="Data akan terhubung ke reporting views setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Periode",
            "BUMDes",
            "Jenis Laporan",
            "Status Closing",
            "Status Review",
            "Aksi",
          ]}
          emptyText="Belum ada laporan untuk ditinjau. Nanti pengawas dapat melihat laporan sesuai scope akses database."
        />
      </Card>
    </div>
  );
}
