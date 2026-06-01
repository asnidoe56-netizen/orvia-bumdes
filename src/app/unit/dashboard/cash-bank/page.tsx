export const dynamic = "force-dynamic";

import { ArrowDownCircle, ArrowUpCircle, Banknote, Landmark, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { PageBackButton } from "@/components/ui/page-back-button";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { CashBankTransferForm } from "./_components/cash-bank-transfer-form";

type CashBankBalance = {
  tenant_id: string;
  unit_id: string | null;
  cash_bank_account_id: string;
  account_code: string;
  account_name: string;
  account_kind: "cash" | "bank";
  opening_balance: number | string | null;
  current_balance: number | string | null;
};

type CashBankTransaction = {
  id: string;
  tenant_id: string;
  unit_id: string | null;
  cash_bank_account_id: string;
  transaction_no: string;
  transaction_date: string;
  transaction_type:
    | "receipt"
    | "payment"
    | "transfer_in"
    | "transfer_out"
    | "adjustment_in"
    | "adjustment_out"
    | "opening_balance";
  source_type: string | null;
  description: string | null;
  amount: number | string;
  status: "draft" | "posted" | "cancelled" | "reversed";
  created_at: string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getTransactionLabel(type: CashBankTransaction["transaction_type"]) {
  const labels: Record<CashBankTransaction["transaction_type"], string> = {
    receipt: "Penerimaan",
    payment: "Pengeluaran",
    transfer_in: "Transfer Masuk",
    transfer_out: "Transfer Keluar",
    adjustment_in: "Penyesuaian Masuk",
    adjustment_out: "Penyesuaian Keluar",
    opening_balance: "Saldo Awal",
  };

  return labels[type] ?? type;
}

function getSignedAmount(transaction: CashBankTransaction) {
  const amount = toNumber(transaction.amount);

  if (
    transaction.transaction_type === "payment" ||
    transaction.transaction_type === "transfer_out" ||
    transaction.transaction_type === "adjustment_out"
  ) {
    return amount * -1;
  }

  return amount;
}

function getStatusClass(status: CashBankTransaction["status"]) {
  if (status === "posted") {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }

  if (status === "draft") {
    return "bg-amber-50 text-amber-700 ring-amber-100";
  }

  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function getTransactionTone(type: CashBankTransaction["transaction_type"]) {
  if (
    type === "receipt" ||
    type === "transfer_in" ||
    type === "adjustment_in" ||
    type === "opening_balance"
  ) {
    return {
      icon: <ArrowDownCircle className="h-4 w-4" />,
      className: "text-emerald-700",
    };
  }

  return {
    icon: <ArrowUpCircle className="h-4 w-4" />,
    className: "text-rose-700",
  };
}

export default async function UnitCashBankPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [{ data: balanceRows, error: balanceError }, { data: transactionRows, error: transactionError }] =
    await Promise.all([
      supabase
        .from("v_cash_bank_balance")
        .select(
          "tenant_id, unit_id, cash_bank_account_id, account_code, account_name, account_kind, opening_balance, current_balance",
        )
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .order("account_kind", { ascending: true })
        .order("account_code", { ascending: true }),

      supabase
        .from("cash_bank_transactions")
        .select(
          "id, tenant_id, unit_id, cash_bank_account_id, transaction_no, transaction_date, transaction_type, source_type, description, amount, status, created_at",
        )
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (balanceError) {
    throw new Error(balanceError.message);
  }

  if (transactionError) {
    throw new Error(transactionError.message);
  }

  const balances = (balanceRows ?? []) as CashBankBalance[];
  const transactions = (transactionRows ?? []) as CashBankTransaction[];

  const accountNameById = new Map(
    balances.map((account) => [account.cash_bank_account_id, account.account_name]),
  );

  const cashBalance = balances
    .filter((account) => account.account_kind === "cash")
    .reduce((total, account) => total + toNumber(account.current_balance), 0);

  const bankBalance = balances
    .filter((account) => account.account_kind === "bank")
    .reduce((total, account) => total + toNumber(account.current_balance), 0);

  const postedThisMonth = transactions.filter((transaction) => {
    const date = new Date(transaction.transaction_date);
    const now = new Date();

    return (
      transaction.status === "posted" &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }).length;

  return (
    <div className="space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard" />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Admin Unit / Kas & Bank
        </p>

        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              Kas & Bank
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Pantau saldo kas, saldo bank, dan riwayat mutasi kas-bank unit berdasarkan engine database.
              Saldo dihitung dari view <span className="font-semibold text-slate-800">v_cash_bank_balance</span>.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
            <WalletCards className="h-4 w-4" />
            {balances.length} Akun
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      <CashBankTransferForm accounts={balances} />

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Saldo Kas
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatCurrency(cashBalance)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total akun dengan jenis kas.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Banknote className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Saldo Bank
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {formatCurrency(bankBalance)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Total akun dengan jenis bank.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Landmark className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Transaksi Bulan Ini
              </p>
              <p className="mt-2 text-2xl font-bold text-slate-950">
                {postedThisMonth}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Transaksi posted pada bulan berjalan.
              </p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <WalletCards className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">
              Daftar Akun Kas & Bank
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Akun aktif yang tersedia untuk transaksi unit.
            </p>
          </div>

          <div className="space-y-3">
            {balances.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                Belum ada akun kas-bank untuk unit ini. Akun default biasanya dibuat saat provisioning unit.
              </div>
            ) : (
              balances.map((account) => (
                <div
                  key={account.cash_bank_account_id}
                  className="rounded-2xl border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-950">
                        {account.account_code} — {account.account_name}
                      </p>
                      <p className="mt-1 text-xs capitalize text-slate-500">
                        {account.account_kind === "cash" ? "Kas" : "Bank"}
                      </p>
                    </div>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                      {account.account_kind === "cash" ? "Kas" : "Bank"}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500">Saldo Awal</p>
                      <p className="font-semibold text-slate-800">
                        {formatCurrency(account.opening_balance)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Saldo Saat Ini</p>
                      <p className="font-bold text-emerald-700">
                        {formatCurrency(account.current_balance)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-bold text-slate-950">
              Riwayat Mutasi Terakhir
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Menampilkan 20 transaksi kas-bank terbaru dari ledger database.
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            {transactions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
                Belum ada transaksi kas-bank.
              </div>
            ) : (
              transactions.map((transaction) => {
                const tone = getTransactionTone(transaction.transaction_type);
                const signedAmount = getSignedAmount(transaction);

                return (
                  <div
                    key={transaction.id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-950">
                          {transaction.transaction_no}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDate(transaction.transaction_date)}
                        </p>
                      </div>

                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getStatusClass(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className={`inline-flex items-center gap-2 text-sm font-semibold ${tone.className}`}>
                        {tone.icon}
                        {getTransactionLabel(transaction.transaction_type)}
                      </div>

                      <p className={`text-sm font-bold ${signedAmount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatCurrency(signedAmount)}
                      </p>
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      {accountNameById.get(transaction.cash_bank_account_id) ?? "Akun kas-bank"}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[860px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3">Tanggal</th>
                  <th className="px-3 py-3">Nomor</th>
                  <th className="px-3 py-3">Jenis</th>
                  <th className="px-3 py-3">Akun</th>
                  <th className="px-3 py-3 text-right">Nominal</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>

              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      Belum ada transaksi kas-bank.
                    </td>
                  </tr>
                ) : (
                  transactions.map((transaction) => {
                    const tone = getTransactionTone(transaction.transaction_type);
                    const signedAmount = getSignedAmount(transaction);

                    return (
                      <tr key={transaction.id} className="border-b border-slate-100">
                        <td className="px-3 py-3 text-slate-600">
                          {formatDate(transaction.transaction_date)}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-900">
                          {transaction.transaction_no}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-2 font-semibold ${tone.className}`}>
                            {tone.icon}
                            {getTransactionLabel(transaction.transaction_type)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {accountNameById.get(transaction.cash_bank_account_id) ?? "-"}
                        </td>
                        <td className={`px-3 py-3 text-right font-bold ${signedAmount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {formatCurrency(signedAmount)}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${getStatusClass(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}


