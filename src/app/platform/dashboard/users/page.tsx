import { Shield, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PlatformUsersPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Pengguna"
        title="Pengguna Platform"
        description="Pantau pengguna lintas tenant dan role global. Pengelolaan akses nantinya dikendalikan oleh user_roles, profiles, dan helper permission database."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Pengguna"
          value="0"
          description="Menunggu koneksi profiles."
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Role Aktif"
          value="0"
          description="Akan dibaca dari user_roles."
          icon={<Shield className="h-5 w-5" />}
        />
        <StatCard
          title="Akses Unit"
          value="0"
          description="Akan dibaca dari unit_access_credentials."
          icon={<Shield className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Pengguna"
          description="Data akan terhubung ke profiles, user_roles, dan unit_access_credentials setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Nama",
            "Email/Login",
            "Role",
            "Tenant",
            "Unit",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada data pengguna. Nanti role dan scope akses akan dibaca langsung dari database."
        />
      </Card>
    </div>
  );
}
