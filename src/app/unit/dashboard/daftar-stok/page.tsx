export const dynamic = "force-dynamic";

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleSlash,
  Package,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { PageBackButton } from "@/components/ui/page-back-button";
import { ResponsiveRecordList } from "@/components/ui/responsive-record-list";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type StockSummary = {
  id: string;
  item_code: string;
  item_name: string;
  description: string | null;
  unit_of_measure: string;
  item_type: string;
  minimum_stock: number;
  default_sales_price: number;
  current_stock: number;
  last_purchase_price: number;
  average_unit_cost: number;
  inventory_value: number;
  stock_status: "safe" | "low" | "empty" | "not_tracked" | string;
  is_active: boolean;
};

function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatItemType(type: string) {
  if (type === "stock") return "Stock";
  if (type === "service") return "Service";
  if (type === "non_stock") return "Non Stock";
  return type;
}

function getStockStatus(item: StockSummary) {
  if (item.item_type !== "stock" || item.stock_status === "not_tracked") {
    return {
      label: "Tidak dihitung",
      className: "bg-slate-100 text-slate-600",
      icon: CircleSlash,
    };
  }

  if (item.stock_status === "empty") {
    return {
      label: "Kosong",
      className: "bg-red-50 text-red-700",
      icon: AlertTriangle,
    };
  }

  if (item.stock_status === "low") {
    return {
      label: "Stok rendah",
      className: "bg-amber-50 text-amber-700",
      icon: AlertTriangle,
    };
  }

  return {
    label: "Aman",
    className: "bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  };
}

export default async function UnitDaftarStokPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_inventory_item_stock_summary")
    .select(
      "id, item_code, item_name, description, unit_of_measure, item_type, minimum_stock, default_sales_price, current_stock, last_purchase_price, average_unit_cost, inventory_value, stock_status, is_active"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("item_type", "stock")
    .eq("is_active", true)
    .order("item_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const stockList = (data ?? []) as StockSummary[];
  const totalStockItems = stockList.length;
  const lowStockItems = stockList.filter(
    (item) => item.stock_status === "low" || item.stock_status === "empty"
  ).length;
  const totalInventoryValue = stockList.reduce(
    (total, item) => total + Number(item.inventory_value ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Unit / Daftar Stok Tersedia
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Daftar Stok Tersedia
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Halaman khusus untuk melihat barang yang tersedia. Jumlah stok
              dihitung otomatis dari pergerakan persediaan, bukan diinput manual.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <Package className="h-4 w-4" />
                Barang Aktif
              </div>
              <div className="mt-1 text-xl font-black">{totalStockItems}</div>
            </div>

            <div className="rounded-2xl bg-amber-50 px-4 py-3 text-amber-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <AlertTriangle className="h-4 w-4" />
                Perlu Cek
              </div>
              <div className="mt-1 text-xl font-black">{lowStockItems}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-slate-800">
              <div className="flex items-center gap-2 text-xs font-bold uppercase">
                <Boxes className="h-4 w-4" />
                Nilai Stok
              </div>
              <div className="mt-1 text-sm font-black">
                {formatCurrency(totalInventoryValue)}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <strong>Catatan:</strong> halaman ini hanya menampilkan barang bertipe
          stock yang aktif. Untuk menambah barang baru, gunakan menu Master Data
          Persediaan Barang. Untuk mengubah jumlah stok, gunakan alur transaksi
          pembelian, penjualan, atau penyesuaian stok.
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Package className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Tabel Stok Barang
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Data bersumber dari view v_inventory_item_stock_summary.
            </p>
          </div>
        </div>

        <ResponsiveRecordList
          items={stockList}
          getKey={(item) => item.id}
          emptyState={
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
              Belum ada barang stock aktif yang dapat ditampilkan.
            </div>
          }
          renderMobileCard={(item) => {
            const stockStatus = getStockStatus(item);
            const StatusIcon = stockStatus.icon;

            return (
              <MobileRecordCard
                title={item.item_name}
                subtitle={`${item.item_code} · Satuan: ${item.unit_of_measure}`}
                badge={
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${stockStatus.className}`}>
                    <StatusIcon className="h-3.5 w-3.5" />
                    {stockStatus.label}
                  </span>
                }
                rows={[
                  {
                    label: "Sisa Stok",
                    value: formatNumber(item.current_stock),
                  },
                  {
                    label: "Batas Min",
                    value: formatNumber(item.minimum_stock),
                  },
                  {
                    label: "Harga Jual",
                    value: formatCurrency(item.default_sales_price),
                  },
                  {
                    label: "Harga Beli Terakhir",
                    value: formatCurrency(item.last_purchase_price),
                  },
                  {
                    label: "Nilai Persediaan",
                    value: formatCurrency(item.inventory_value),
                    fullWidth: true,
                  },
                  {
                    label: "Tipe",
                    value: formatItemType(item.item_type),
                  },
                ]}
                footer={
                  <Link
                    href={`/unit/dashboard/master-data/items/${item.id}/prices`}
                    className="inline-flex rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    Atur Harga
                  </Link>
                }
              />
            );
          }}
          renderDesktopTable={() => (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-[1050px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Kode</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3">Tipe</th>
                    <th className="px-4 py-3 text-right">Sisa Stok</th>
                    <th className="px-4 py-3 text-right">Batas Min</th>
                    <th className="px-4 py-3 text-right">Harga Jual</th>
                    <th className="px-4 py-3 text-right">Harga Beli Terakhir</th>
                    <th className="px-4 py-3 text-right">Nilai Persediaan</th>
                    <th className="px-4 py-3">Status Stok</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {stockList.length > 0 ? (
                    stockList.map((item) => {
                      const stockStatus = getStockStatus(item);
                      const StatusIcon = stockStatus.icon;

                      return (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-bold text-slate-800">
                            {item.item_code}
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div className="font-semibold">{item.item_name}</div>
                            <div className="text-xs text-slate-500">
                              Satuan: {item.unit_of_measure}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {formatItemType(item.item_type)}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">
                            {formatNumber(item.current_stock)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {formatNumber(item.minimum_stock)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatCurrency(item.default_sales_price)}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            {formatCurrency(item.last_purchase_price)}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">
                            {formatCurrency(item.inventory_value)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${stockStatus.className}`}>
                              <StatusIcon className="h-3.5 w-3.5" />
                              {stockStatus.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/unit/dashboard/master-data/items/${item.id}/prices`}
                              className="inline-flex rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                            >
                              Atur Harga
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Belum ada barang stock aktif yang dapat ditampilkan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        />
      </section>
    </div>
  );
}

