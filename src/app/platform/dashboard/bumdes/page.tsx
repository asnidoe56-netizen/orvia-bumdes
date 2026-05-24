import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PlatformBumdesPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / BUMDes"
        title="BUMDes / Tenant"
        description="Pantau seluruh BUMDes yang sudah menjadi tenant aktif dalam sistem. Setiap BUMDes adalah satu tenant dan memiliki unit usaha, pengguna, role, serta scope data sendiri."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Tenant Aktif"
          value="0"
          description="Menunggu koneksi tabel tenants."
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Wilayah Desa"
          value="0"
          description="Akan dihitung dari data desa tenant."
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          title="BUMDes Nonaktif"
          value="0"
          description="Tenant dengan status tidak aktif."
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar BUMDes"
          description="Data akan terhubung ke tabel tenants setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Kode BUMDes",
            "Nama BUMDes",
            "Desa",
            "Kecamatan",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada data BUMDes. Tenant akan terbentuk setelah registrasi disetujui melalui database RPC."
        />
      </Card>
    </div>
  );
}
