import Link from "next/link";
import {
  ClipboardCheck,
  PackageCheck,
  Plus,
  ShoppingBag,
} from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { postPurchaseInvoice } from "./actions";
import { PurchaseActionMessage } from "./purchase-action-message";

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
  if (value === "cash") return "Cash";
  if (value === "credit") return "Credit";
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

  const draftCount = invoices.filter((invoice) => invoice.status === "draft").length;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Admin Unit / Pembelian
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Pembelian
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Kelola transaksi pembelian unit usaha. Draft pembelian belum
              menambah stok dan belum membuat jurnal sampai diposting oleh
              engine database.
            </p>
          </div>

          <Link
            href="/unit/dashboard/purchasing/new"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" />
            Transaksi Pembelian
          </Link>
        </div>
      </section>

      <PurchaseActionMessage />

<section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Total Pembelian</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {formatRupiah(totalPurchase)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Total dari draft/invoice pembelian unit.
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
                Jumlah invoice pembelian tercatat.
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
              <p className="text-sm text-slate-600">Status Posting</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {draftCount > 0 ? `${draftCount} Draft` : "Siap"}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Posting stok dan jurnal dikendalikan database RPC.
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
              Daftar Transaksi Pembelian
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Data draft/invoice pembelian yang sudah dibuat dari unit ini.
            </p>
          </div>

          <span className="w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
            Draft belum posting
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Nomor Transaksi</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Aksi</th>
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
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
  <div className="flex items-center gap-2">
    <span className="text-sm font-bold text-emerald-700">Detail</span>

    {invoice.status === "draft" ? (
      <form action={postPurchaseInvoice}>
        <input type="hidden" name="purchase_invoice_id" value={invoice.id} />
        <button
          type="submit"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
        >
          Posting
        </button>
      </form>
    ) : (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
        Sudah posting
      </span>
    )}
  </div>
</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Belum ada transaksi pembelian. Klik tombol Transaksi Pembelian
                    untuk membuat draft pertama.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}




