import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { ExpenseEntryForm } from "./expense-entry-form";

export type ExpenseAccountOption = {
  id: string;
  kode: string;
  nama: string;
};

export type CashBankAccountOption = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

export async function ExpenseEntrySection() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Sesi unit tidak valid. Silakan login ulang sebagai pengguna unit.
      </section>
    );
  }

  const supabase = await createClient();

  const { data: expenseAccounts, error: expenseError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("tipe", "beban")
    .eq("account_type", "BEBAN")
    .eq("normal_balance", "debit")
    .eq("is_active", true)
    .eq("is_postable", true)
    .order("kode", { ascending: true });

  const { data: cashBankAccounts, error: cashError } = await supabase
    .from("v_cash_bank_balance")
    .select(
      "cash_bank_account_id, account_code, account_name, account_kind, current_balance"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_code", { ascending: true });

  if (expenseError || cashError) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Data form Beban Operasional gagal dimuat. Silakan refresh halaman.
      </section>
    );
  }

  const expenseOptions: ExpenseAccountOption[] = (expenseAccounts ?? []).map(
    (account) => ({
      id: account.id,
      kode: account.kode,
      nama: account.nama,
    })
  );

  const cashBankOptions: CashBankAccountOption[] = (cashBankAccounts ?? [])
    .filter((account) => Boolean(account.cash_bank_account_id))
    .map((account) => ({
      id: account.cash_bank_account_id as string,
      account_code: account.account_code ?? "",
      account_name: account.account_name ?? "",
      account_kind: account.account_kind ?? "",
      current_balance: Number(account.current_balance ?? 0),
    }));

  return (
    <section className="rounded-2xl border border-slate-900 bg-white p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Form Beban Operasional
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Catat pengeluaran operasional unit seperti gaji pegawai, listrik,
          transportasi, administrasi, pemeliharaan, dan beban usaha lainnya.
        </p>
      </div>

      <ExpenseEntryForm
        expenseAccounts={expenseOptions}
        cashBankAccounts={cashBankOptions}
      />
    </section>
  );
}

