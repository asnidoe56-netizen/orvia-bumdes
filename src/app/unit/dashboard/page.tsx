import {
  Activity,
  BadgeCheck,
  Building2,
  Coins,
  Package,
  ShieldCheck,
  Store,
  WalletCards,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type BusinessUnit = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
  tenant_id: string;
};

type Tenant = {
  id: string;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
  status: string;
};

function StatCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  description: string;
  icon: typeof Store;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default async function UnitDashboardPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: unit, error: unitError } = await supabase
    .from("business_units")
    .select("id, tenant_id, kode_unit, nama_unit, jenis_unit, status")
    .eq("id", context.unit_id)
    .eq("tenant_id", context.tenant_id)
    .single();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan, status")
    .eq("id", context.tenant_id)
    .single();

  const { count: coaCount } = await supabase
    .from("chart_of_accounts")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id);

  const { count: itemCount } = await supabase
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id);

  const { count: salesCount } = await supabase
    .from("sales_invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id);

  const { count: purchaseCount } = await supabase
    .from("purchase_invoices")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id);

  if (unitError || !unit) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
        Data unit tidak ditemukan atau akses unit tidak valid.
      </div>
    );
  }

  const unitData = unit as BusinessUnit;
  const tenantData = tenant as Tenant | null;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Dashboard Operasional Unit
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {unitData.nama_unit}
            </h1>

            <p className="mt-1 text-sm text-slate-600">
              {tenantData?.nama_bumdes ?? "BUMDes"} · Desa{" "}
              {tenantData?.nama_desa ?? "-"} · Kecamatan{" "}
              {tenantData?.nama_kecamatan ?? "-"}
            </p>
          </div>

          <div className="grid gap-2 text-sm lg:text-right">
            <div>
              <span className="font-semibold text-slate-500">Role Login</span>
              <p className="font-bold text-slate-950">{context.role}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-500">Kode Unit</span>
              <p className="font-bold text-slate-950">{unitData.kode_unit}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Status Unit"
          value={unitData.status}
          description={`Jenis unit: ${unitData.jenis_unit}`}
          icon={BadgeCheck}
        />

        <StatCard
          title="COA Unit"
          value={coaCount ?? 0}
          description="Akun akuntansi aktif untuk unit ini."
          icon={Coins}
        />

        <StatCard
          title="Item Persediaan"
          value={itemCount ?? 0}
          description="Data dibaca dari inventory_items."
          icon={Package}
        />

        <StatCard
          title="Transaksi"
          value={(salesCount ?? 0) + (purchaseCount ?? 0)}
          description="Total invoice penjualan dan pembelian."
          icon={Activity}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Identitas Unit
              </h2>
              <p className="text-sm text-slate-600">
                Scope kerja transaksi unit.
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-slate-500">Nama Unit</span>
              <span className="font-bold text-slate-950">
                {unitData.nama_unit}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="font-semibold text-slate-500">Kode Unit</span>
              <span className="font-bold text-slate-950">
                {unitData.kode_unit}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="font-semibold text-slate-500">Jenis Unit</span>
              <span className="font-bold text-slate-950">
                {unitData.jenis_unit}
              </span>
            </div>

            <div className="flex justify-between gap-4">
              <span className="font-semibold text-slate-500">Status</span>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {unitData.status}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Status Engine Unit
              </h2>
              <p className="text-sm text-slate-600">
                Dashboard ini sudah membaca tenant_id dan unit_id dari login context.
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Modul</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Catatan</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    Accounting Scope
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Aktif
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    COA unit: {coaCount ?? 0} akun.
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    Inventory
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Siap Diisi
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Item saat ini: {itemCount ?? 0}.
                  </td>
                </tr>

                <tr>
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    Kas & Bank
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      Menunggu Akun
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    Modul akan aktif setelah akun kas/bank dibuat.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
