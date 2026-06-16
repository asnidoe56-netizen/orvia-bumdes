"use client";

import { useMemo, useState } from "react";

import { payCustomerSalesInvoice } from "../_actions/customer-payment-actions";

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

type CashBankAccountWithBalance = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

type CustomerPaymentFormClientProps = {
  receivables: ReceivableInvoice[];
  cashBankAccounts: CashBankAccountWithBalance[];
};

function formatRupiah(value: number | string | null | undefined) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isNaN(numberValue) ? 0 : numberValue);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function CustomerPaymentFormClient({
  receivables,
  cashBankAccounts,
}: CustomerPaymentFormClientProps) {
  const today = formatDateInput(new Date());

  const [salesInvoiceId, setSalesInvoiceId] = useState("");
  const [paymentDate, setPaymentDate] = useState(today);
  const [cashBankAccountId, setCashBankAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [notesInput, setNotesInput] = useState("");

  const selectedInvoice = useMemo(
    () =>
      receivables.find(
        (invoice) => invoice.sales_invoice_id === salesInvoiceId
      ) ?? null,
    [receivables, salesInvoiceId]
  );

  const selectedOutstanding = Number(selectedInvoice?.outstanding_amount ?? 0);
  const amountNumber = Number(amountInput || 0);
  const isOverOutstanding =
    selectedInvoice !== null && amountNumber > selectedOutstanding;

  function handleInvoiceChange(value: string) {
    setSalesInvoiceId(value);

    const invoice = receivables.find(
      (item) => item.sales_invoice_id === value
    );

    if (invoice) {
      setAmountInput(String(Math.round(Number(invoice.outstanding_amount ?? 0))));
    } else {
      setAmountInput("");
    }
  }

  return (
    <form action={payCustomerSalesInvoice} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Invoice Piutang Pelanggan
          </span>
          <select
            name="sales_invoice_id"
            value={salesInvoiceId}
            onChange={(event) => handleInvoiceChange(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">Pilih invoice piutang</option>
            {receivables.map((invoice) => (
              <option
                key={invoice.sales_invoice_id}
                value={invoice.sales_invoice_id}
              >
                {invoice.invoice_no} - {invoice.customer_name ?? "Pelanggan"}
                {" | Sisa "}
                {formatRupiah(invoice.outstanding_amount)}
                {" | "}
                {invoice.receivable_status}
              </option>
            ))}
          </select>
        </label>

        {selectedInvoice ? (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm leading-6 text-sky-900 md:col-span-2">
            <p className="font-bold">Ringkasan invoice terpilih</p>
            <p className="mt-1">
              {selectedInvoice.invoice_no} · {selectedInvoice.customer_name ?? "Pelanggan"} · Sisa piutang{" "}
              <span className="font-bold">
                {formatRupiah(selectedInvoice.outstanding_amount)}
              </span>
            </p>
          </div>
        ) : null}

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Tanggal Penerimaan
          </span>
          <input
            name="payment_date"
            type="date"
            value={paymentDate}
            onChange={(event) => setPaymentDate(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-semibold text-slate-700">
            Nomor Penerimaan
          </span>
          <input
            name="payment_no"
            type="text"
            placeholder="Kosongkan untuk nomor otomatis"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm uppercase outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Terima Ke Kas/Bank
          </span>
          <select
            name="cash_bank_account_id"
            value={cashBankAccountId}
            onChange={(event) => setCashBankAccountId(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-900 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          >
            <option value="">Pilih kas/bank tujuan</option>
            {cashBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code} - {account.account_name}
                {" | Saldo "}
                {formatRupiah(account.current_balance)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">
            Nominal Diterima
          </span>
          <input
            name="amount"
            type="number"
            min="1"
            max={selectedInvoice ? Math.round(selectedOutstanding) : undefined}
            step="1"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            required
            placeholder="Contoh: 150000"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />

          {isOverOutstanding ? (
            <p className="text-xs font-semibold text-red-700">
              Nominal melebihi sisa piutang. Engine database juga akan menolak posting ini.
            </p>
          ) : null}
        </label>

        <label className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-slate-700">Catatan</span>
          <textarea
            name="notes"
            rows={3}
            value={notesInput}
            onChange={(event) => setNotesInput(event.target.value)}
            placeholder="Catatan penerimaan pembayaran pelanggan"
            className="w-full rounded-xl border border-slate-900 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-slate-500">
          Engine database akan menolak pembayaran jika nominal melebihi sisa piutang
          atau periode tanggal penerimaan sedang tertutup.
        </p>

        <button
          type="submit"
          disabled={isOverOutstanding}
          className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Simpan & Posting Penerimaan
        </button>
      </div>
    </form>
  );
}
