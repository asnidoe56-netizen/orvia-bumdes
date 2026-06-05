import { HandCoins, PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { paySupplierPurchaseInvoice } from "../_actions/supplier-payment-actions";

type PayableInvoice = {
  purchase_invoice_id: string;
  supplier_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number | string;
  payment_amount: number | string;
  outstanding_amount: number | string;
  payable_status: string;
};

type CashBankAccount = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
};

type CashBankBalance = {
  cash_bank_account_id: string;
  current_balance: number | string;
};

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isNaN(numberValue) ? 0 : numberValue);
}

export async function SupplierPaymentEntryForm() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [payableResult, cashBankResult, balanceResult] = await Promise.all([
    supabase
      .from("v_purchase_invoice_payables")
      .select(
        "purchase_invoice_id, supplier_name, invoice_no, invoice_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .gt("outstanding_amount", 0)
      .order("invoice_date", { ascending: true })
      .order("invoice_no", { ascending: true }),

    supabase
      .from("cash_bank_accounts")
      .select("id, account_code, account_name, account_kind")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("account_code", { ascending: true }),

    supabase
      .from("v_cash_bank_balance")
      .select("cash_bank_account_id, current_balance")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id),
  ]);

  if (payableResult.error) throw new Error(payableResult.error.message);
  if (cashBankResult.error) throw new Error(cashBankResult.error.message);
  if (balanceResult.error) throw new Error(balanceResult.error.message);

  const payables = (payableResult.data ?? []) as PayableInvoice[];
  const cashBankAccounts = (cashBankResult.data ?? []) as CashBankAccount[];
  const balances = (balanceResult.data ?? []) as CashBankBalance[];

  const balanceByAccount = new Map(
    balances.map((balance) => [
      balance.cash_bank_account_id,
      Number(balance.current_balance ?? 0),
    ])
  );

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/catat-transaksi" />

      <section className="rounded-3xl border border-slate-900 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Catat Transaksi / Bayar Hutang Supplier
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Bayar Hutang Supplier
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Gunakan form ini untuk membayar hutang dari pembelian kredit.
              Engine database akan mencatat pembayaran, jurnal, kas-bank keluar,
              dan menghitung sisa hutang otomatis.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <HandCoins className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-900 bg-white p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <PlusCircle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Data Pembayaran Hutang
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih invoice pembelian kredit yang masih memiliki sisa hutang,
              lalu pilih kas/bank unit yang digunakan untuk pembayaran.
            </p>
          </div>
        </div>

        {payables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Tidak ada hutang supplier yang masih terbuka untuk unit ini.
          </div>
        ) : (
          <form action={paySupplierPurchaseInvoice} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Invoice Hutang Supplier
                </span>
                <select
                  name="purchase_invoice_id"
                  required
                  className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pilih invoice hutang</option>
                  {payables.map((invoice) => (
                    <option
                      key={invoice.purchase_invoice_id}
                      value={invoice.purchase_invoice_id}
                    >
                      {invoice.invoice_no} - {invoice.supplier_name ?? "Supplier"}
                      {" | Sisa "}
                      {formatRupiah(invoice.outstanding_amount)}
                      {" | "}
                      {invoice.payable_status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Tanggal Pembayaran
                </span>
                <input
                  name="payment_date"
                  type="date"
                  required
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">
                  Nomor Pembayaran
                </span>
                <input
                  name="payment_no"
                  type="text"
                  placeholder="Kosongkan untuk nomor otomatis"
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Bayar Dari Kas/Bank
                </span>
                <select
                  name="cash_bank_account_id"
                  required
                  className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">Pilih kas/bank unit</option>
                  {cashBankAccounts.map((account) => {
                    const balance = balanceByAccount.get(account.id) ?? 0;

                    return (
                      <option key={account.id} value={account.id}>
                        {account.account_code} - {account.account_name}
                        {" | Saldo "}
                        {formatRupiah(balance)}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Nominal Pembayaran
                </span>
                <input
                  name="amount"
                  type="number"
                  min="1"
                  step="1"
                  required
                  placeholder="Contoh: 150000"
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  Catatan
                </span>
                <textarea
                  name="notes"
                  rows={3}
                  placeholder="Catatan pembayaran hutang supplier"
                  className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">
                Engine database akan menolak pembayaran jika nominal melebihi
                sisa hutang atau saldo kas/bank tidak cukup.
              </p>

              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
              >
                Simpan & Posting Pembayaran
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="rounded-3xl border border-slate-900 bg-white p-5">
        <h2 className="text-base font-bold text-slate-950">
          Daftar Hutang Terbuka
        </h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-900">
          <div className="grid grid-cols-1 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid-cols-5">
            <div className="p-3">Invoice</div>
            <div className="p-3">Supplier</div>
            <div className="p-3">Tanggal</div>
            <div className="p-3">Sisa Hutang</div>
            <div className="p-3">Status</div>
          </div>

          {payables.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              Semua hutang supplier sudah lunas.
            </div>
          ) : (
            payables.map((invoice) => (
              <div
                key={invoice.purchase_invoice_id}
                className="grid grid-cols-1 border-t border-slate-200 text-sm text-slate-700 md:grid-cols-5"
              >
                <div className="p-3 font-semibold text-slate-950">
                  {invoice.invoice_no}
                </div>
                <div className="p-3">{invoice.supplier_name ?? "-"}</div>
                <div className="p-3">{invoice.invoice_date}</div>
                <div className="p-3 font-bold text-slate-950">
                  {formatRupiah(invoice.outstanding_amount)}
                </div>
                <div className="p-3">
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    {invoice.payable_status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

