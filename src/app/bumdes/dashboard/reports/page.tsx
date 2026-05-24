import { Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export default function BumdesReportsPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Laporan"
        title="Laporan BUMDes"
        description="Pantau laporan konsolidasi BUMDes dari seluruh unit usaha. Data final nantinya bersumber dari view reporting database, bukan perhitungan manual frontend."
        action={
          <Button type="button" variant="secondary">
            <Download className="h-4 w-4" />
            Ekspor
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Laporan Tersedia</p>
              <p className="text-2xl font-bold text-slate-950">0</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Daftar Laporan Konsolidasi"
          description="Laporan akan terhubung ke report views setelah database engine siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Periode",
            "Jenis Laporan",
            "Unit Sumber",
            "Status Closing",
            "Aksi",
          ]}
          emptyText="Belum ada laporan. Setelah accounting engine aktif, laporan akan dibaca dari view database yang sudah tervalidasi."
        />
      </Card>
    </div>
  );
}
