import { Plus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function UnitSalesPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Unit / Penjualan"
        title="Penjualan"
        description="Kelola transaksi penjualan unit usaha. Setiap transaksi nantinya wajib membawa tenant_id, unit_id, created_by, role_context, dan source_type."
        action={
          <Button type="button">
            <Plus className="h-4 w-4" />
            Transaksi Penjualan
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Penjualan Hari Ini"
          value="Rp0"
          description="Menunggu koneksi sales engine."
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatCard
          title="Transaksi"
          value="0"
          description="Data akan dibaca dari tabel transaksi penjualan."
          icon={<Receipt className="h-5 w-5" />}
        />
        <StatCard
          title="Status Posting"
          value="Siap"
          description="Posting jurnal akan dikendalikan database RPC."
          icon={<Receipt className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar Transaksi Penjualan"
          description="Data akan terhubung ke sales engine setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Tanggal",
            "Nomor Transaksi",
            "Pelanggan",
            "Total",
            "Status",
            "Aksi",
          ]}
          emptyText="Belum ada transaksi penjualan. Nanti transaksi akan dibuat melalui RPC agar jurnal, stok, kas/piutang, dan audit tercatat konsisten."
        />
      </Card>
    </div>
  );
}
