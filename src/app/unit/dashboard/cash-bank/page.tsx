import { Banknote, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

export default function UnitCashBankPage() {
  return (
    <div>
      <PageHeader
        breadcrumb="Admin Unit / Kas & Bank"
        title="Kas & Bank"
        description="Kelola penerimaan, pengeluaran, mutasi kas-bank, dan saldo unit. Semua transaksi kas-bank nantinya diposting melalui database RPC agar jurnal dan audit tetap konsisten."
        action={
          <Button type="button">
            <Plus className="h-4 w-4" />
            Transaksi Kas-Bank
          </Button>
        }
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Saldo Kas"
          value="Rp0"
          description="Akan dibaca dari view saldo kas."
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          title="Saldo Bank"
          value="Rp0"
          description="Akan dibaca dari view saldo bank."
          icon={<Banknote className="h-5 w-5" />}
        />
        <StatCard
          title="Transaksi Bulan Ini"
          value="0"
          description="Menunggu cash-bank engine."
          icon={<Banknote className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Riwayat Kas & Bank"
          description="Data akan terhubung ke cash-bank engine setelah database foundation siap."
          action={<Badge variant="warning">Menunggu Database</Badge>}
        />

        <DataTable
          columns={[
            "Tanggal",
            "Nomor Transaksi",
            "Jenis",
            "Akun Kas/Bank",
            "Nominal",
            "Aksi",
          ]}
          emptyText="Belum ada transaksi kas-bank. Nanti penerimaan, pengeluaran, dan mutasi akan diproses melalui RPC database."
        />
      </Card>
    </div>
  );
}
