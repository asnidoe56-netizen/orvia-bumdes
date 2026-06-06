import { DashboardShell } from "@/components/layouts/dashboard-shell";
import { requireRole } from "@/lib/auth/require-role";
import { createClient } from "@/lib/supabase/server";
import {
  getUnitDashboardNav,
  isSavingsLoanUnit,
} from "@/lib/navigation/unit-dashboard-menu";

export default async function UnitDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireRole(["manager_unit", "operator_unit", "viewer_unit"]);
  const supabase = await createClient();

  let templateCode: string | null = null;
  let jenisUnit: string | null = null;

  if (context?.tenant_id && context.unit_id) {
    const { data: unitData } = await supabase
      .from("business_units")
      .select("jenis_unit, template_id")
      .eq("tenant_id", context.tenant_id)
      .eq("id", context.unit_id)
      .maybeSingle();

    jenisUnit = unitData?.jenis_unit ?? null;

    if (unitData?.template_id) {
      const { data: templateData } = await supabase
        .from("unit_templates")
        .select("kode_template")
        .eq("id", unitData.template_id)
        .maybeSingle();

      templateCode = templateData?.kode_template ?? null;
    }
  }

  const menuContext = { templateCode, jenisUnit };
  const navItems = getUnitDashboardNav(menuContext);
  const isSavingsLoan = isSavingsLoanUnit(menuContext);

  return (
    <DashboardShell
      title={isSavingsLoan ? "Unit Simpan Pinjam" : "Dashboard Unit"}
      subtitle={
        isSavingsLoan
          ? "Operasional simpan pinjam: anggota, kelompok, pengajuan, simpanan, pencairan, angsuran, kas-bank, dan laporan."
          : "Operasional unit: pembelian, penjualan, inventory, kas-bank, dan laporan."
      }
      navItems={navItems}
      loginContext={context}
    >
      {children}
    </DashboardShell>
  );
}

