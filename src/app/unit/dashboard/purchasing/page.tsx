export const dynamic = "force-dynamic";

import {
  ClipboardCheck,
  PackageCheck,
  ShoppingBag,
} from "lucide-react";
import { redirect } from "next/navigation";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { ResponsiveRecordList } from "@/components/ui/responsive-record-list";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type Supplier = {
  id: string;
  supplier_code: string;
  supplier_name: string;
};

type PurchaseInvoice = {
  id: string;
  supplier_id: string | null;
  invoice_no: string;
  invoice_date: string;
  payment_type: string;
  status: string;
  total_amount: number;
  paid_amount: number;
};

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPaymentType(value: string) {
  if (value === "cash") return "Tunai";
  if (value === "credit") return "Kredit";
  return value;
}

function formatStatus(value: string) {
  if (value === "posted") return "Sudah posting";
  if (value === "draft") return "Draft lama";
  return value;
}

export default async function UnitPurchasingPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [supplierResult, invoiceResult] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id, supplier_code, supplier_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("supplier_name", { ascending: true }),

    supabase
      .from("purchase_invoices")
      .select("id, supplier_id, invoice_no, invoice_date, payment_type, status, total_amount, paid_amount")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false }),
  ]);

  if (supplierResult.error) throw new Error(supplierResult.error.message);
  if (invoiceResult.error) throw new Error(invoiceResult.error.message);

  const suppliers = (supplierResult.data ?? []) as Supplier[];
  const invoices = (invoiceResult.data ?? []) as PurchaseInvoice[];

  const supplierNameById = new Map(
    suppliers.map((supplier) => [
      supplier.id,
      `${supplier.supplier_code} - ${supplier.supplier_name}`,
    ])
  );

  const totalPurchase = invoices.reduce((sum, invoice) => {
    return sum + Number(invoice.total_amount ?? 0);
  }, 0);

  const postedCount = invoices.filter((invoice) => invoice.status === "posted").length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Admin Unit / Riwayat Pembelian
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Riwayat Pembelian
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Halaman ini menampilkan histori pembelian unit usaha. Pencatatan
            pembelian baru dilakukan melalui menu Catat Transaksi agar alur
            stok, kas/utang, jurnal, dan audit tetap terpusat.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Total Pembelian</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {formatRupiah(totalPurchase)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Akumulasi invoice pembelian unit.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ShoppingBag className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Transaksi</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {invoices.length}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Jumlah transaksi pembelian tercatat.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <ClipboardCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Sudah Posting</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {postedCount}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Transaksi yang sudah diproses engine database.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Histori Transaksi Pembelian
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Data dibaca dari invoice pembelian yang sudah tercatat untuk unit ini.
            </p>
          </div>

          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Histori Pembelian
          </span>
        </div>

        <ResponsiveRecordList
          items={invoices}
          getKey={(invoice) => invoice.id}
          emptyState={
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
              Belum ada histori pembelian. Transaksi baru dicatat melalui menu Catat Transaksi.
            </div>
          }
          renderMobileCard={(invoice) => (
            <MobileRecordCard
              title={invoice.invoice_no}
              subtitle={`${invoice.invoice_date} · ${formatPaymentType(invoice.payment_type)}`}
              badge={
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {formatStatus(invoice.status)}
                </span>
              }
              rows={[
                {
                  label: "Supplier",
                  value: invoice.supplier_id
                    ? supplierNameById.get(invoice.supplier_id) ?? "-"
                    : "-",
                  fullWidth: true,
                },
                {
                  label: "Total",
                  value: formatRupiah(Number(invoice.total_amount ?? 0)),
                },
                {
                  label: "Terbayar",
                  value: formatRupiah(Number(invoice.paid_amount ?? 0)),
                },
              ]}
            />
          )}
          renderDesktopTable={() => (
            <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Nomor Transaksi</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-4 py-3 text-slate-600">
                          {invoice.invoice_date}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-bold text-slate-800">
                            {invoice.invoice_no}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatPaymentType(invoice.payment_type)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {invoice.supplier_id
                            ? supplierNameById.get(invoice.supplier_id) ?? "-"
                            : "-"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {formatRupiah(Number(invoice.total_amount ?? 0))}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {formatStatus(invoice.status)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Belum ada histori pembelian. Transaksi baru dicatat melalui menu Catat Transaksi.
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


