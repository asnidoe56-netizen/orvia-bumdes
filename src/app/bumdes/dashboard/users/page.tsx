import { Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";

export default function BumdesUsersPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Pengguna"
        title="Pengguna BUMDes"
        description="Kelola pengguna dalam tenant BUMDes, termasuk direktur, admin BUMDes, manager unit, operator unit, dan viewer unit."
        action={
          <Button type="button">
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-slate-500">Total Pengguna</p>
              <p className="text-2xl font-bold text-slate-950">0</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Daftar Pengguna Tenant"
          description="Data akan terhubung ke profiles, user_roles, dan unit_access_credentials setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Nama",
            "Email/Login",
            "Role",
            "Unit",
            "Status Akses",
            "Aksi",
          ]}
          emptyText="Belum ada pengguna tenant. Nanti tambah pengguna akan membuat profile, role, dan akses unit melalui database RPC."
        />
      </Card>
    </div>
  );
}
