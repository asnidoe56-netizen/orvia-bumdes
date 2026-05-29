import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { RevenueReceiptEntryForm } from "./revenue-receipt-entry-form";

export type RevenueAccountOption = {
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

export async function RevenueReceiptEntrySection() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Sesi unit tidak valid. Silakan login ulang sebagai pengguna unit.
      </section>
    );
  }

  const supabase = await createClient();

  const { data: revenueAccounts, error: revenueError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("tipe", "pendapatan")
    .eq("account_type", "PENDAPATAN")
    .eq("normal_balance", "credit")
    .eq("is_active", true)
    .eq("is_postable", true)
    .in("kode", ["4200", "4310", "4400"])
    .order("kode", { ascending: true });

  const { data: cashBankAccounts, error: cashError } = await supabase
    .from("v_cash_bank_balance")
    .select(
      "cash_bank_account_id, account_code, account_name, account_kind, current_balance"
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("account_code", { ascending: true });

  if (revenueError || cashError) {
    return (
      <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        Data form Terima Pendapatan gagal dimuat. Silakan refresh halaman.
      </section>
    );
  }

  const revenueOptions: RevenueAccountOption[] = (revenueAccounts ?? []).map(
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
    <section className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Form Terima Pendapatan
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
          Catat penerimaan pendapatan unit. Engine database akan otomatis
          membuat jurnal, transaksi kas/bank masuk, dan audit log.
        </p>
      </div>

      <RevenueReceiptEntryForm
        revenueAccounts={revenueOptions}
        cashBankAccounts={cashBankOptions}
      />
    </section>
  );
}

