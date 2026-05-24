import { LockKeyhole, ShieldCheck, Workflow } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function PlatformGovernancePage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Governance"
        title="Governance Global"
        description="Pantau aturan global, permission, audit, locking, dan kontrol akses lintas tenant. Governance final nantinya dikendalikan oleh helper permission, RPC, trigger, RLS, dan audit timeline database."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Permission Engine"
          value="Siap"
          description="Akan memakai has_permission dan assert_user_has_permission."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <StatCard
          title="Audit & Koreksi"
          value="Siap"
          description="Perubahan penting dicatat dalam audit timeline."
          icon={<Workflow className="h-5 w-5" />}
        />
        <StatCard
          title="Closing / Locking"
          value="Siap"
          description="Periode terkunci tidak boleh diubah langsung."
          icon={<LockKeyhole className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Kontrol Governance"
          description="Data akan terhubung ke governance engine setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Area",
            "Kontrol",
            "Scope",
            "Status",
            "Catatan",
            "Aksi",
          ]}
          emptyText="Belum ada data governance. Nanti permission, locking, audit, dan koreksi transaksi akan dikendalikan langsung oleh database engine."
        />
      </Card>
    </div>
  );
}
