import { ArrowDownLeft, ArrowUpRight, Banknote, Landmark, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { CashBankTransferForm } from "./cash-bank-transfer-form";

type CashBankBalanceRow = {
  cash_bank_account_id: string | null;
  account_code: string | null;
  account_name: string | null;
  account_kind: "cash" | "bank" | string | null;
  current_balance: number | string | null;
};

type CashBankTransactionRow = {
  id: string;
  transaction_no: string;
  transaction_date: string;
  transaction_type: string;
  source_type: string | null;
  description: string | null;
  amount: number | string;
  status: string;
  cash_bank_account_id: string;
  cash_bank_accounts:
    | {
        account_code: string | null;
        account_name: string | null;
        account_kind: string | null;
      }
    | {
        account_code: string | null;
        account_name: string | null;
        account_kind: string | null;
      }[]
    | null;
};

function asNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(asNumber(value));
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getTransactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    receipt: "Kas/Bank Masuk",
    payment: "Kas/Bank Keluar",
    transfer_in: "Transfer Masuk",
    transfer_out: "Transfer Keluar",
    adjustment_in: "Penyesuaian Masuk",
    adjustment_out: "Penyesuaian Keluar",
    opening_balance: "Saldo Awal",
  };

  return labels[type] ?? type;
}

function getStatusVariant(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "posted") {
    return "success";
  }

  if (status === "draft") {
    return "warning";
  }

  if (["cancelled", "reversed"].includes(status)) {
    return "danger";
  }

  return "neutral";
}

function getCashBankAccount(row: CashBankTransactionRow) {
  if (Array.isArray(row.cash_bank_accounts)) {
    return row.cash_bank_accounts[0] ?? null;
  }

  return row.cash_bank_accounts;
}

function getSignedAmount(row: CashBankTransactionRow) {
  const amount = asNumber(row.amount);

  if (["payment", "transfer_out", "adjustment_out"].includes(row.transaction_type)) {
    return -amount;
  }

  return amount;
}

export default async function UnitCashBankPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div>
        <PageHeader
          breadcrumb="Admin Unit / Kas & Bank"
          title="Kas & Bank"
          description="Sesi unit tidak valid. Silakan login ulang sebagai pengguna unit."
        />
      </div>
    );
  }

  const supabase = await createClient();

  const { data: balanceData, error: balanceError } = await supabase
    .from("v_cash_bank_balance")
    .select("cash_bank_account_id, account_code, account_name, account_kind, current_balance")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_kind", { ascending: true })
    .order("account_code", { ascending: true });

  const balanceRows = ((balanceData ?? []) as CashBankBalanceRow[]).filter(
    (account) =>
      Boolean(account.cash_bank_account_id) &&
      (account.account_kind === "cash" || account.account_kind === "bank")
  );

  const accounts = balanceRows.map((account) => ({
    id: account.cash_bank_account_id as string,
    account_code: account.account_code ?? "-",
    account_name: account.account_name ?? "-",
    account_kind: account.account_kind as "cash" | "bank",
    current_balance: asNumber(account.current_balance),
  }));

  const totalCashBalance = accounts
    .filter((account) => account.account_kind === "cash")
    .reduce((sum, account) => sum + account.current_balance, 0);

  const totalBankBalance = accounts
    .filter((account) => account.account_kind === "bank")
    .reduce((sum, account) => sum + account.current_balance, 0);

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartText = monthStart.toISOString().slice(0, 10);

  const { data: transactionData, error: transactionError } = await supabase
    .from("cash_bank_transactions")
    .select(
      "id, transaction_no, transaction_date, transaction_type, source_type, description, amount, status, cash_bank_account_id, cash_bank_accounts(account_code, account_name, account_kind)"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const transactions = (transactionData ?? []) as CashBankTransactionRow[];

  const transactionThisMonth = transactions.filter(
    (row) => row.transaction_date >= monthStartText
  ).length;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Unit / Kas & Bank"
        title="Kas & Bank"
        description="Kelola saldo kas tunai, saldo bank, tarik tunai dari bank ke kas, setor tunai dari kas ke bank, dan riwayat mutasi kas-bank unit."
      />

      {balanceError ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Gagal membaca saldo kas-bank: {balanceError.message}
        </div>
      ) : null}

      {transactionError ? (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          Gagal membaca riwayat kas-bank: {transactionError.message}
        </div>
      ) : null}

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Saldo Kas"
          value={formatRupiah(totalCashBalance)}
          description={`${accounts.filter((account) => account.account_kind === "cash").length} akun kas tunai aktif.`}
          icon={<Banknote className="h-5 w-5" />}
        />

        <StatCard
          title="Saldo Bank"
          value={formatRupiah(totalBankBalance)}
          description={`${accounts.filter((account) => account.account_kind === "bank").length} akun bank aktif.`}
          icon={<Landmark className="h-5 w-5" />}
        />

        <StatCard
          title="Transaksi Bulan Ini"
          value={String(transactionThisMonth)}
          description="Dihitung dari 30 transaksi kas-bank terbaru."
          icon={<WalletCards className="h-5 w-5" />}
        />
      </div>

      <CashBankTransferForm accounts={accounts} />

      <Card>
        <CardHeader
          title="Riwayat Kas & Bank"
          description="Menampilkan 30 transaksi kas-bank terbaru. Transfer internal akan muncul sebagai transfer keluar dan transfer masuk."
          action={<Badge variant={transactions.length > 0 ? "success" : "warning"}>{transactions.length > 0 ? "Terhubung" : "Belum Ada Data"}</Badge>}
        />

        <DataTable
          columns={[
            "Tanggal",
            "Nomor Transaksi",
            "Jenis",
            "Akun Kas/Bank",
            "Nominal",
            "Status",
            "Keterangan",
          ]}
          minWidthClassName="min-w-[980px]"
          emptyText="Belum ada transaksi kas-bank."
        >
          {transactions.length > 0
            ? transactions.map((row) => {
                const account = getCashBankAccount(row);
                const signedAmount = getSignedAmount(row);

                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 align-top text-sm font-medium text-slate-700">
                      {formatDate(row.transaction_date)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {row.transaction_no}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {row.source_type ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {signedAmount < 0 ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        )}
                        {getTransactionTypeLabel(row.transaction_type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-slate-900">
                        {account?.account_code ?? "-"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {account?.account_name ?? "-"}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className={[
                          "font-bold",
                          signedAmount < 0 ? "text-red-700" : "text-emerald-700",
                        ].join(" ")}
                      >
                        {signedAmount < 0 ? "-" : "+"}
                        {formatRupiah(Math.abs(signedAmount))}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Badge variant={getStatusVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 align-top text-sm text-slate-600">
                      {row.description ?? "-"}
                    </td>
                  </tr>
                );
              })
            : null}
        </DataTable>
      </Card>
    </div>
  );
}
