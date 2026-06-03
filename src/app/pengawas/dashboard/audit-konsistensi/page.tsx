export const dynamic = "force-dynamic";

import { AlertTriangle, CheckCircle2, FileSearch, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type ReconciliationRow = {
  tenant_id: string;
  unit_id: string;
  neraca_total_aset: number | string | null;
  ledger_total_aset: number | string | null;
  diff_aset: number | string | null;
  neraca_total_kewajiban: number | string | null;
  ledger_total_kewajiban: number | string | null;
  diff_kewajiban: number | string | null;
  neraca_total_ekuitas: number | string | null;
  ledger_total_ekuitas_formal: number | string | null;
  ledger_laba_rugi_berjalan: number | string | null;
  ledger_total_ekuitas_dengan_laba_berjalan: number | string | null;
  diff_ekuitas: number | string | null;
  neraca_total_kewajiban_ekuitas: number | string | null;
  neraca_selisih: number | string | null;
  status_neraca: string | null;
  reconciliation_status: string | null;
  checked_at: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "MATCH") {
    return <Badge variant="success">MATCH</Badge>;
  }

  if (status === "DIFFERENCE") {
    return <Badge variant="danger">DIFFERENCE</Badge>;
  }

  return <Badge variant="neutral">{status ?? "-"}</Badge>;
}

export default async function PengawasAuditKonsistensiPage() {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_neraca_ledger_reconciliation")
    .select(
      [
        "tenant_id",
        "unit_id",
        "neraca_total_aset",
        "ledger_total_aset",
        "diff_aset",
        "neraca_total_kewajiban",
        "ledger_total_kewajiban",
        "diff_kewajiban",
        "neraca_total_ekuitas",
        "ledger_total_ekuitas_formal",
        "ledger_laba_rugi_berjalan",
        "ledger_total_ekuitas_dengan_laba_berjalan",
        "diff_ekuitas",
        "neraca_total_kewajiban_ekuitas",
        "neraca_selisih",
        "status_neraca",
        "reconciliation_status",
        "checked_at",
      ].join(", ")
    )
    .eq("tenant_id", context.tenant_id)
    .order("reconciliation_status", { ascending: true });

  const rows = ((data ?? []) as unknown) as ReconciliationRow[];
  const matchCount = rows.filter((row) => row.reconciliation_status === "MATCH").length;
  const differenceCount = rows.filter(
    (row) => row.reconciliation_status === "DIFFERENCE"
  ).length;
  const totalDiff =
    rows.reduce((sum, row) => {
      return (
        sum +
        Math.abs(toNumber(row.diff_aset)) +
        Math.abs(toNumber(row.diff_kewajiban)) +
        Math.abs(toNumber(row.diff_ekuitas)) +
        Math.abs(toNumber(row.neraca_selisih))
      );
    }, 0);

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca audit konsistensi laporan: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumb="Pengawas / Audit Konsistensi"
        title="Audit Konsistensi Neraca"
        description="Membandingkan Neraca dengan Buku Besar berdasarkan jurnal posted. Halaman ini membantu pengawas memastikan laporan keuangan seimbang, dapat diverifikasi, dan konsisten dengan audit trail database."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Unit Diaudit"
          value={String(rows.length)}
          description="Unit dalam scope tenant pengawas."
          icon={<FileSearch className="h-5 w-5" />}
        />

        <StatCard
          title="MATCH"
          value={String(matchCount)}
          description="Neraca cocok dengan Buku Besar."
          icon={<CheckCircle2 className="h-5 w-5" />}
        />

        <StatCard
          title="DIFFERENCE"
          value={String(differenceCount)}
          description="Ada selisih yang perlu ditelusuri."
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        <StatCard
          title="Total Selisih"
          value={formatRupiah(totalDiff)}
          description="Akumulasi nilai selisih audit."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </section>

      <Card>
        <CardHeader
          title="Rekonsiliasi Neraca vs Buku Besar"
          description="Data bersumber dari v_neraca_ledger_reconciliation dan dibatasi sesuai tenant pengawas."
          action={
            differenceCount > 0 ? (
              <Badge variant="danger">Perlu Tindak Lanjut</Badge>
            ) : (
              <Badge variant="success">Konsisten</Badge>
            )
          }
        />

        <DataTable
          columns={[
            "Unit",
            "Aset Neraca",
            "Aset Buku Besar",
            "Selisih Aset",
            "Kewajiban Neraca",
            "Kewajiban Buku Besar",
            "Selisih Kewajiban",
            "Ekuitas Neraca",
            "Ekuitas Buku Besar",
            "Laba/Rugi Berjalan",
            "Selisih Ekuitas",
            "Status",
            "Dicek",
          ]}
          emptyText="Belum ada data rekonsiliasi neraca dalam scope pengawas."
        >
          {rows.length > 0
            ? rows.map((row) => (
                <tr key={row.unit_id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div className="font-bold text-slate-950">{row.unit_id}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Tenant: {row.tenant_id}
                    </div>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-800">
                    {formatRupiah(row.neraca_total_aset)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.ledger_total_aset)}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900">
                    {formatRupiah(row.diff_aset)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.neraca_total_kewajiban)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.ledger_total_kewajiban)}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900">
                    {formatRupiah(row.diff_kewajiban)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.neraca_total_ekuitas)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.ledger_total_ekuitas_formal)}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {formatRupiah(row.ledger_laba_rugi_berjalan)}
                  </td>
                  <td className="px-4 py-4 font-bold text-slate-900">
                    {formatRupiah(row.diff_ekuitas)}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={row.reconciliation_status} />
                    <div className="mt-2 text-xs font-semibold text-slate-500">
                      Neraca: {row.status_neraca ?? "-"}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium text-slate-500">
                    {formatDateTime(row.checked_at)}
                  </td>
                </tr>
              ))
            : null}
        </DataTable>
      </Card>
    </div>
  );
}