import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, CheckCircle2, History, Tag } from "lucide-react";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createItemPrice } from "./actions";
import { PriceFormClient } from "./price-form-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

type ItemSummary = {
  id: string;
  item_code: string;
  item_name: string;
  unit_of_measure: string | null;
  current_stock: number | null;
  default_sales_price: number | null;
  active_sales_price?: number | null;
  last_purchase_price: number | null;
  average_unit_cost: number | null;
};

type PriceHistory = {
  id: string;
  price_type: string;
  sales_price: number;
  effective_from: string;
  effective_until: string | null;
  reason: string | null;
  status: string;
  is_active: boolean;
};

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatNumber(value?: number | null) {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getStatusLabel(status: string, isActive: boolean) {
  if (status === "active" && isActive) return "Aktif";
  if (status === "expired") return "Berakhir";
  if (status === "cancelled") return "Dibatalkan";
  if (status === "draft") return "Draft";
  return status;
}

export default async function ItemPricesPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const context = await getLoginContext();

  if (!context?.tenant_id || !context?.unit_id) {
    redirect("/login");
  }

  const { data: item, error: itemError } = await supabase
    .from("v_inventory_item_stock_summary")
    .select("id,item_code,item_name,unit_of_measure,current_stock,default_sales_price,active_sales_price,last_purchase_price,average_unit_cost")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("id", id)
    .maybeSingle<ItemSummary>();

  if (itemError) {
    throw new Error(itemError.message);
  }

  if (!item) {
    redirect("/unit/dashboard/master-data/items");
  }

  const { data: prices, error: pricesError } = await supabase
    .from("inventory_item_prices")
    .select("id,price_type,sales_price,effective_from,effective_until,reason,status,is_active")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("item_id", id)
    .order("effective_from", { ascending: false })
    .returns<PriceHistory[]>();

  if (pricesError) {
    throw new Error(pricesError.message);
  }

  const activePrice = Number(item.active_sales_price ?? item.default_sales_price ?? 0);
  const averageCost = Number(item.average_unit_cost ?? 0);
  const createItemPriceAction = createItemPrice.bind(null, id);

  return (
    <main className="space-y-6">
      <PageBackButton fallbackHref="/unit/dashboard/master-data/items" label="Kembali ke Persediaan Barang" />

      <section className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-600">
          Master Data / Persediaan Barang / Atur Harga
        </p>

        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Atur Harga Barang</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Perubahan harga tidak mengubah transaksi lama. Sistem membuat riwayat harga baru sebagai referensi transaksi penjualan berikutnya.
            </p>
          </div>

          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">{item.item_code}</p>
            <p>{item.item_name}</p>
          </div>
        </div>
      </section>

      <section className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:mx-0 xl:overflow-visible xl:px-0">
        <div className="flex snap-x snap-mandatory gap-3 xl:grid xl:grid-cols-4">
        <div className="w-[calc((100%-0.75rem)/2)] min-w-[calc((100%-0.75rem)/2)] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:w-auto xl:min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
              <Tag className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Harga Aktif</p>
              <p className="mt-1 text-lg font-black text-slate-950">{formatCurrency(activePrice)}</p>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">Harga yang berlaku saat ini</p>
            </div>
          </div>
        </div>

        <div className="w-[calc((100%-0.75rem)/2)] min-w-[calc((100%-0.75rem)/2)] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:w-auto xl:min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-sky-50 p-3 text-sky-600">
              <CalendarDays className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Harga Beli Terakhir</p>
              <p className="mt-1 text-lg font-black text-slate-950">{formatCurrency(item.last_purchase_price)}</p>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">Harga perolehan terakhir</p>
            </div>
          </div>
        </div>

        <div className="w-[calc((100%-0.75rem)/2)] min-w-[calc((100%-0.75rem)/2)] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:w-auto xl:min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-violet-50 p-3 text-violet-600">
              <History className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Rata-rata HPP</p>
              <p className="mt-1 text-lg font-black text-slate-950">{formatCurrency(item.average_unit_cost)}</p>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">Rata-rata harga pokok</p>
            </div>
          </div>
        </div>

        <div className="w-[calc((100%-0.75rem)/2)] min-w-[calc((100%-0.75rem)/2)] snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:w-auto xl:min-w-0">
          <div className="flex items-center gap-3">
            <span className="rounded-2xl bg-orange-50 p-3 text-orange-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">Sisa Stok</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {formatNumber(item.current_stock)} {item.unit_of_measure ?? ""}
              </p>
              <p className="mt-1 hidden text-xs text-slate-400 sm:block">Stok tersedia di gudang</p>
            </div>
          </div>
        </div>
        </div>
      </section>

      <PriceFormClient
        action={createItemPriceAction}
        activePrice={activePrice}
        averageCost={averageCost}
      />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Riwayat Harga</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Riwayat ini menjaga jejak perubahan harga agar transaksi lama tetap valid dan kebijakan harga bisa diaudit.
            </p>
          </div>

          <Link
            href="/unit/dashboard/master-data/items"
            className="inline-flex items-center justify-center rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
          >
            Kembali ke daftar barang
          </Link>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">Jenis</th>
                <th className="px-3 py-3 text-right">Harga</th>
                <th className="px-3 py-3">Alasan</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {(prices ?? []).map((price) => (
                <tr key={price.id} className="align-top">
                  <td className="px-3 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      price.status === "active" && price.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {getStatusLabel(price.status, price.is_active)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    <div>{formatDate(price.effective_from)}</div>
                    <div className="text-xs text-slate-400">s/d {formatDate(price.effective_until)}</div>
                  </td>
                  <td className="px-3 py-3 capitalize text-slate-700">{price.price_type}</td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-700">{formatCurrency(price.sales_price)}</td>
                  <td className="px-3 py-3 text-slate-600">{price.reason || "Oleh Sistem"}</td>
                </tr>
              ))}

              {(prices ?? []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    Belum ada riwayat harga. Buat harga pertama dari form di atas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}