import Link from "next/link";
import { PageBackButton } from "@/components/ui/page-back-button";
import { Package, Truck, UsersRound, ArrowRight, Database, BookOpen } from "lucide-react";

const masterDataMenus = [
  {
    title: "Daftar Akun",
    description:
      "Lihat daftar akun unit usaha yang menjadi dasar kas-bank, transaksi, jurnal, dan laporan.",
    href: "/unit/dashboard/master-data/daftar-akun",
    icon: BookOpen,
  },{
    title: "Persediaan Barang",
    description:
      "Kelola master barang, jasa, satuan, tipe item, dan referensi akun persediaan.",
    href: "/unit/dashboard/master-data/items",
    icon: Package,
  },
  {
    title: "Supplier",
    description:
      "Kelola data pemasok sebagai referensi transaksi pembelian unit usaha.",
    href: "/unit/dashboard/master-data/suppliers",
    icon: Truck,
  },
  {
    title: "Customer",
    description:
      "Kelola data pelanggan sebagai referensi transaksi penjualan unit usaha.",
    href: "/unit/dashboard/master-data/customers",
    icon: UsersRound,
  },
];

export default function UnitMasterDataPage() {
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
              Pusat pengelolaan data referensi unit usaha. Data ini akan
              digunakan oleh transaksi pembelian, penjualan, persediaan,
              kas-bank, jurnal, dan laporan.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Database className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {masterDataMenus.map((menu) => {
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



