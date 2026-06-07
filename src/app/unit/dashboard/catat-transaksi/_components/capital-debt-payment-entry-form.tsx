import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
    CapitalDebtPaymentFormClient,
    type CapitalPayable,
    type CashBankBalance,
} from "@/app/unit/dashboard/catat-transaksi/_components/capital-debt-payment-form-client";

function formatRupiah(value: number | string | null | undefined) {
    const numberValue = Number(value || 0);

    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
    }).format(numberValue);
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
            {message}
        </div>
    );
}

function ErrorState({ message }: { message: string }) {
    return (
        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {message}
        </section>
    );
}

function PageHeader() {
    return (
        <section className="rounded-3xl border border-slate-900 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Catat Transaksi / Aset & Belanja Modal
            </p>

            <h1 className="mt-2 text-2xl font-bold text-slate-950">
                Bayar Hutang Belanja Modal
            </h1>

            <p className="mt-1 text-sm leading-6 text-slate-600">
                Bayar hutang dari transaksi Belanja Modal kredit. Sistem otomatis
                mengurangi utang Belanja Modal, mencatat kas/bank keluar, dan membuat
                jurnal.
            </p>
        </section>
    );
}

function PayableList({ payables }: { payables: CapitalPayable[] }) {
    return (
        <section className="rounded-3xl border border-slate-900 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
                Daftar Hutang Belanja Modal Terbuka
            </h2>

            <div className="mt-4 space-y-3">
                {payables.length === 0 ? (
                    <EmptyState message="Tidak ada hutang Belanja Modal yang masih terbuka." />
                ) : (
                    payables.map((item) => (
                        <div
                            key={item.capital_expenditure_id}
                            className="rounded-2xl border border-slate-900 p-4"
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                    <h3 className="font-bold text-slate-950">
                                        {item.transaction_no}
                                    </h3>

                                    <p className="mt-1 text-sm text-slate-600">
                                        Supplier: {item.supplier_name || "-"}  -  Tanggal:{" "}
                                        {item.transaction_date}
                                    </p>
                                </div>

                                <div className="text-left lg:text-right">
                                    <p className="text-sm text-slate-600">Sisa hutang</p>

                                    <p className="text-lg font-bold text-slate-950">
                                        {formatRupiah(item.outstanding_amount)}
                                    </p>

                                    <span className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                        {item.payable_status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

export async function CapitalDebtPaymentEntryForm() {
    const supabase = await createClient();
    const loginContext = await getLoginContext();

    if (!loginContext?.tenant_id || !loginContext?.unit_id) {
        return (
            <div className="space-y-5">
                <PageHeader />

                <ErrorState message="Konteks tenant/unit tidak ditemukan. Silakan login ulang." />
            </div>
        );
    }

    const { data: payables, error: payablesError } = await supabase
        .from("v_capital_expenditure_payables")
        .select(
            "capital_expenditure_id, transaction_no, supplier_name, transaction_date, due_date, total_amount, payment_amount, outstanding_amount, payable_status"
        )
        .eq("tenant_id", loginContext.tenant_id)
        .eq("unit_id", loginContext.unit_id)
        .gt("outstanding_amount", 0)
        .order("transaction_date", { ascending: false });

    const { data: cashBanks, error: cashBanksError } = await supabase
        .from("v_cash_bank_balance")
        .select("cash_bank_account_id, account_code, account_name, current_balance")
        .eq("tenant_id", loginContext.tenant_id)
        .eq("unit_id", loginContext.unit_id)
        .gt("current_balance", 0)
        .order("account_code", { ascending: true });

    const payableRows = (payables || []) as CapitalPayable[];
    const cashBankRows = (cashBanks || []) as CashBankBalance[];

    const errorMessage = payablesError?.message || cashBanksError?.message;

    return (
        <div className="space-y-5">
            <PageHeader />

            {errorMessage && <ErrorState message={errorMessage} />}

            <CapitalDebtPaymentFormClient
                payables={payableRows}
                cashBanks={cashBankRows}
            />

            <PayableList payables={payableRows} />
        </div>
    );
}
