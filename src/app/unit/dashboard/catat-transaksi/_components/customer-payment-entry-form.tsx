import { HandCoins, PlusCircle } from "lucide-react";
import { redirect } from "next/navigation";

import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

import { CustomerPaymentFormClient } from "./customer-payment-form-client";

type ReceivableInvoice = {
  sales_invoice_id: string;
  customer_name: string | null;
  invoice_no: string;
  invoice_date: string;
  due_date: string | null;
  total_amount: number | string;
  paid_amount: number | string;
  outstanding_amount: number | string;
  receivable_status: string;
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

type CustomerPaymentEntryFormProps = {
  errorMessage?: string | null;
};

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isNaN(numberValue) ? 0 : numberValue);
}

export async function CustomerPaymentEntryForm({
  errorMessage,
}: CustomerPaymentEntryFormProps) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [receivableResult, cashBankResult, balanceResult] = await Promise.all([
    supabase
      .from("v_sales_invoice_receivables")
      .select(
        "sales_invoice_id, customer_name, invoice_no, invoice_date, due_date, total_amount, paid_amount, outstanding_amount, receivable_status"
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

  if (receivableResult.error) throw new Error(receivableResult.error.message);
  if (cashBankResult.error) throw new Error(cashBankResult.error.message);
  if (balanceResult.error) throw new Error(balanceResult.error.message);

  const receivables = (receivableResult.data ?? []) as ReceivableInvoice[];
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
            <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
              Catat Transaksi / Terima Bayar Pelanggan
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              Terima Bayar Pelanggan
            </h1>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Gunakan form ini saat pelanggan membayar piutang dari penjualan kredit.
              Engine database akan mencatat kas/bank masuk, mengurangi piutang,
              memperbarui invoice, dan membuat jurnal otomatis.
            </p>
          </div>

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <HandCoins className="h-6 w-6" />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-900 bg-white p-5">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <PlusCircle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Data Pembayaran Piutang
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Pilih invoice penjualan kredit yang masih memiliki sisa piutang,
              lalu pilih kas/bank tujuan penerimaan.
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        {receivables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm leading-6 text-slate-600">
            Tidak ada piutang pelanggan yang masih terbuka untuk unit ini.
          </div>
        ) : (
          <CustomerPaymentFormClient
            receivables={receivables}
            cashBankAccounts={cashBankAccounts.map((account) => ({
              ...account,
              current_balance: balanceByAccount.get(account.id) ?? 0,
            }))}
          />
        )}
      </section>

      <section className="rounded-3xl border border-slate-900 bg-white p-5">
        <h2 className="text-base font-bold text-slate-950">
          Daftar Piutang Terbuka
        </h2>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-900">
          <div className="grid grid-cols-1 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid-cols-5">
            <div className="p-3">Invoice</div>
            <div className="p-3">Pelanggan</div>
            <div className="p-3">Tanggal</div>
            <div className="p-3">Sisa Piutang</div>
            <div className="p-3">Status</div>
          </div>

          {receivables.length === 0 ? (
            <div className="p-4 text-sm text-slate-600">
              Semua piutang pelanggan sudah lunas.
            </div>
          ) : (
            receivables.map((invoice) => (
              <div
                key={invoice.sales_invoice_id}
                className="grid grid-cols-1 border-t border-slate-200 text-sm text-slate-700 md:grid-cols-5"
              >
                <div className="p-3 font-semibold text-slate-950">
                  {invoice.invoice_no}
                </div>
                <div className="p-3">{invoice.customer_name ?? "-"}</div>
                <div className="p-3">{invoice.invoice_date}</div>
                <div className="p-3 font-bold text-slate-950">
                  {formatRupiah(invoice.outstanding_amount)}
                </div>
                <div className="p-3">
                  <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">
                    {invoice.receivable_status}
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
