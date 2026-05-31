import Link from "next/link";
import { ArrowRight, Database, Package, Truck, UsersRound } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type MasterDataMenu = {
  title: string;
  description: string;
  href: string;
  icon: typeof Package;
  templateOnly?: "PERDAGANGAN";
};

const masterDataMenus: MasterDataMenu[] = [
  {
    title: "Persediaan Barang",
    description:
      "Kelola master barang, jasa, satuan, tipe item, dan referensi akun persediaan.",
    href: "/unit/dashboard/master-data/items",
    icon: Package,
    templateOnly: "PERDAGANGAN",
  },
  {
    title: "Supplier / Pemasok",
    description:
      "Kelola data pemasok atau penyedia barang/jasa sebagai referensi transaksi unit, termasuk Belanja Modal.",
    href: "/unit/dashboard/master-data/suppliers",
    icon: Truck,
  },
  {
    title: "Customer / Pelanggan",
    description:
      "Kelola data pelanggan, penerima layanan, atau pihak yang berhubungan dengan transaksi pendapatan unit.",
    href: "/unit/dashboard/master-data/customers",
    icon: UsersRound,
  },
];

function normalize(value?: string | null) {
  return value?.trim().toUpperCase().replace(/\s+/g, "_") ?? "";
}

export default async function UnitMasterDataPage() {
  const context = await getLoginContext();
  const supabase = await createClient();

  let templateCode: string | null = null;

  if (context?.tenant_id && context.unit_id) {
    const { data: unitData } = await supabase
      .from("business_units")
      .select("template_id")
      .eq("tenant_id", context.tenant_id)
      .eq("id", context.unit_id)
      .maybeSingle();

    if (unitData?.template_id) {
      const { data: templateData } = await supabase
        .from("unit_templates")
        .select("kode_template")
        .eq("id", unitData.template_id)
        .maybeSingle();

      templateCode = templateData?.kode_template ?? null;
    }
  }

  const normalizedTemplateCode = normalize(templateCode);

  const visibleMenus = masterDataMenus.filter((menu) => {
    if (!menu.templateOnly) return true;

    return menu.templateOnly === normalizedTemplateCode;
  });

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Master Data
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Master Data
            </h1>

            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Pusat pengelolaan data referensi unit usaha. Supplier dan customer
              tersedia sebagai master data global untuk semua jenis unit,
              sedangkan persediaan barang hanya ditampilkan untuk unit
              perdagangan.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Database className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visibleMenus.map((menu) => {
          const Icon = menu.icon;

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white">
                  <Icon className="h-6 w-6" />
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-emerald-50 group-hover:text-emerald-700">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>

              <h2 className="mt-5 text-lg font-bold text-slate-950">
                {menu.title}
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {menu.description}
              </p>

              <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
                Buka menu
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
