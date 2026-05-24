import { Building2, ShieldCheck, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

export default function PlatformDashboardPage() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total BUMDes"
          value="0"
          description="Menunggu koneksi database tenant."
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Registrasi Pending"
          value="0"
          description="Data akan dibaca dari tenant_registrations."
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          title="Governance"
          value="Siap"
          description="Permission dan role akan dikendalikan database."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Ringkasan Platform"
          description="Dashboard awal untuk monitoring registrasi, tenant, user, dan governance global."
          action={<Badge variant="success">Frontend Ready</Badge>}
        />

        <DataTable
          columns={["BUMDes", "Desa", "Kecamatan", "Status", "Aksi"]}
          emptyText="Belum ada data tenant. Database foundation akan disiapkan pada tahap berikutnya."
        />
      </Card>
    </div>
  );
}
