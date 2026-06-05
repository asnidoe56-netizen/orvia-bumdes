export const dynamic = "force-dynamic";

import { CircleDollarSign, PackageCheck, Receipt } from "lucide-react";
import { redirect } from "next/navigation";
import { MobileRecordCard } from "@/components/ui/mobile-record-card";
import { ResponsiveRecordList } from "@/components/ui/responsive-record-list";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type SalesHistoryRow = {
  sales_invoice_id: string;
  invoice_no: string;
  invoice_date: string;
  payment_type: string;
  invoice_status: string;
  customer_code: string | null;
  customer_name: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  total_cogs: number | string | null;
  journal_status: string | null;
  audit_result: string | null;
  created_at: string;
};

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatPaymentType(value: string) {
  if (value === "cash") return "Tunai";
  if (value === "credit") return "Kredit";
  return value;
}

function formatStatus(value: string | null) {
  if (value === "posted") return "Sudah posting";
  if (value === "draft") return "Draft";
  return value ?? "-";
}

function formatAuditResult(value: string | null) {
  if (!value) return "Belum dicek";
  if (value === "PASS") return "Valid";
  if (value === "FAIL") return "Perlu cek";
  return value;
}

export default async function UnitSalesPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_sales_invoice_flow_audit")
    .select(
      "sales_invoice_id, invoice_no, invoice_date, payment_type, invoice_status, customer_code, customer_name, total_amount, paid_amount, total_cogs, journal_status, audit_result, created_at"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const sales = (data ?? []) as SalesHistoryRow[];

  const totalSales = sales.reduce((sum, row) => {
    return sum + Number(row.total_amount ?? 0);
  }, 0);

  const postedCount = sales.filter((row) => row.invoice_status === "posted").length;

  const totalPaid = sales.reduce((sum, row) => {
    return sum + Number(row.paid_amount ?? 0);
  }, 0);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
            Admin Unit / Riwayat Penjualan
          </p>

          <h1 className="mt-2 text-2xl font-bold text-slate-950">
            Riwayat Penjualan
          </h1>

          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Halaman ini menampilkan histori penjualan unit usaha. Pencatatan
            penjualan baru dilakukan melalui menu Catat Transaksi agar
            kas/piutang, stok, HPP, jurnal, dan audit tetap terpusat.
          </p>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Total Penjualan</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {formatRupiah(totalSales)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Akumulasi invoice penjualan unit.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Receipt className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Transaksi</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {sales.length}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Jumlah transaksi penjualan tercatat.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-600">Kas Diterima</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {formatRupiah(totalPaid)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Pembayaran tercatat dari penjualan tunai/kredit.
              </p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <CircleDollarSign className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Histori Transaksi Penjualan
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Data dibaca dari view audit alur penjualan yang terhubung dengan invoice,
              stok keluar, kas/piutang, HPP, dan jurnal.
            </p>
          </div>

          <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            {postedCount} sudah posting
          </span>
        </div>

        <ResponsiveRecordList
          items={sales}
          getKey={(row) => row.sales_invoice_id}
          emptyState={
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm font-semibold text-slate-500">
              Belum ada histori penjualan. Transaksi baru dicatat melalui menu Catat Transaksi.
            </div>
          }
          renderMobileCard={(row) => (
            <MobileRecordCard
              title={row.invoice_no}
              subtitle={`${row.invoice_date} · Penjualan ${formatPaymentType(row.payment_type)}`}
              badge={
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {formatStatus(row.invoice_status)}
                </span>
              }
              rows={[
                {
                  label: "Pelanggan",
                  value: row.customer_name
                    ? `${row.customer_code ?? "-"} - ${row.customer_name}`
                    : "Pelanggan umum",
                  fullWidth: true,
                },
                {
                  label: "Total",
                  value: formatRupiah(row.total_amount),
                },
                {
                  label: "Terbayar",
                  value: formatRupiah(row.paid_amount),
                },
                {
                  label: "Audit",
                  value: (
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      {formatAuditResult(row.audit_result)}
                    </span>
                  ),
                  fullWidth: true,
                },
              ]}
            />
          )}
          renderDesktopTable={() => (
            <div className="max-w-full overflow-x-auto overscroll-x-contain rounded-2xl border border-slate-200">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3">Nomor Transaksi</th>
                    <th className="px-4 py-3">Pelanggan</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Terbayar</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Audit</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {sales.length > 0 ? (
                    sales.map((row) => (
                      <tr key={row.sales_invoice_id}>
                        <td className="px-4 py-3 text-slate-600">
                          {row.invoice_date}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          <div className="font-bold text-slate-800">
                            {row.invoice_no}
                          </div>
                          <div className="text-xs text-slate-500">
                            Penjualan {formatPaymentType(row.payment_type)}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {row.customer_name
                            ? `${row.customer_code ?? "-"} - ${row.customer_name}`
                            : "Pelanggan umum"}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {formatRupiah(row.total_amount)}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-700">
                          {formatRupiah(row.paid_amount)}
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                            {formatStatus(row.invoice_status)}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                            {formatAuditResult(row.audit_result)}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-slate-500"
                      >
                        Belum ada histori penjualan. Transaksi baru dicatat melalui menu Catat Transaksi.
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


