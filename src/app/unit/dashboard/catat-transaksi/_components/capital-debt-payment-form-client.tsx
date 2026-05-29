"use client";

import { useActionState, useState } from "react";
import {
    CapitalDebtPaymentState,
    payCapitalDebtAction,
} from "@/app/unit/dashboard/catat-transaksi/_actions/capital-debt-payment-actions";

export type CapitalPayable = {
    capital_expenditure_id: string;
    transaction_no: string;
    supplier_name: string | null;
    transaction_date: string;
    due_date: string | null;
    total_amount: number | string;
    payment_amount: number | string;
    outstanding_amount: number | string;
    payable_status: string;
};

export type CashBankBalance = {
    cash_bank_account_id: string;
    account_code: string;
    account_name: string;
    current_balance: number | string;
};

type CapitalDebtPaymentFormClientProps = {
    payables: CapitalPayable[];
    cashBanks: CashBankBalance[];
};

const initialState: CapitalDebtPaymentState = {
    success: false,
    message: "",
};

function formatRupiah(value: number | string | null | undefined) {
    const numberValue = Number(value || 0);

    if (!Number.isFinite(numberValue)) {
        return "Rp 0";
    }

    const hasDecimal = Math.abs(numberValue % 1) > 0;

    const fixedValue = hasDecimal
        ? numberValue.toFixed(2)
        : Math.round(numberValue).toString();

    const [integerPart, decimalPart] = fixedValue.split(".");

    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    if (decimalPart) {
        return `Rp ${formattedInteger},${decimalPart}`;
    }

    return `Rp ${formattedInteger}`;
}

function getTodayDate() {
    return new Date().toISOString().slice(0, 10);
}

function generatePaymentNo() {
    const now = new Date();

    const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
    const timePart = now.toTimeString().slice(0, 8).replaceAll(":", "");

    return `BHBM-${datePart}-${timePart}`;
}

function normalizeNumericInput(value: number | string | null | undefined) {
    return String(value || "0");
}

function AlertMessage({ state }: { state: CapitalDebtPaymentState }) {
    if (!state.message) return null;

    if (state.success) {
        return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                {state.message}
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            {state.message}
        </div>
    );
}

function CashBankSelect({ cashBanks }: { cashBanks: CashBankBalance[] }) {
    return (
        <div>
            <label className="text-sm font-bold text-slate-700">
                Kas / Bank Pembayaran
            </label>

            <select
                name="cash_bank_account_id"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            >
                <option value="">Pilih kas/bank</option>

                {cashBanks.map((account) => (
                    <option
                        key={account.cash_bank_account_id}
                        value={account.cash_bank_account_id}
                    >
                        {account.account_code} — {account.account_name} — Saldo:{" "}
                        {formatRupiah(account.current_balance)}
                    </option>
                ))}
            </select>
        </div>
    );
}

export function CapitalDebtPaymentFormClient({
    payables,
    cashBanks,
}: CapitalDebtPaymentFormClientProps) {
    const [state, formAction, isPending] = useActionState(
        payCapitalDebtAction,
        initialState
    );

    const [selectedPayableId, setSelectedPayableId] = useState("");
    const [amountValue, setAmountValue] = useState("");

    const selectedPayable = payables.find(
        (item) => item.capital_expenditure_id === selectedPayableId
    );

    function handlePayableChange(value: string) {
        setSelectedPayableId(value);

        const payable = payables.find(
            (item) => item.capital_expenditure_id === value
        );

        if (!payable) {
            setAmountValue("");
            return;
        }

        setAmountValue(normalizeNumericInput(payable.outstanding_amount));
    }

    return (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
                Form Pembayaran Hutang Belanja Modal
            </h2>

            <p className="mt-1 text-sm text-slate-600">
                Pilih hutang Belanja Modal yang masih terbuka. Nominal pembayaran akan
                otomatis mengikuti sisa hutang di database, tetapi masih bisa diubah oleh
                user.
            </p>

            <div className="mt-5">
                <AlertMessage state={state} />
            </div>

            <form action={formAction} className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="lg:col-span-2">
                    <label className="text-sm font-bold text-slate-700">
                        Hutang Belanja Modal / Aset
                    </label>

                    <select
                        name="capital_expenditure_id"
                        required
                        value={selectedPayableId}
                        onChange={(event) => handlePayableChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    >
                        <option value="">Pilih hutang Belanja Modal</option>

                        {payables.map((item) => (
                            <option
                                key={item.capital_expenditure_id}
                                value={item.capital_expenditure_id}
                            >
                                {item.transaction_no} — Hutang Aset/Belanja Modal — Supplier:{" "}
                                {item.supplier_name || "-"} — Sisa:{" "}
                                {formatRupiah(item.outstanding_amount)}
                            </option>
                        ))}
                    </select>

                    {selectedPayable && (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                            Sisa hutang database:{" "}
                            {formatRupiah(selectedPayable.outstanding_amount)}
                        </p>
                    )}
                </div>

                <CashBankSelect cashBanks={cashBanks} />

                <div>
                    <label className="text-sm font-bold text-slate-700">
                        Nomor Pembayaran
                    </label>

                    <input
                        name="payment_no"
                        required
                        defaultValue={generatePaymentNo()}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                </div>

                <div>
                    <label className="text-sm font-bold text-slate-700">
                        Tanggal Pembayaran
                    </label>

                    <input
                        type="date"
                        name="payment_date"
                        required
                        defaultValue={getTodayDate()}
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                </div>

                <div>
                    <label className="text-sm font-bold text-slate-700">
                        Nominal Pembayaran
                    </label>

                    <input
                        type="number"
                        name="amount"
                        min="0.01"
                        step="0.01"
                        required
                        value={amountValue}
                        onChange={(event) => setAmountValue(event.target.value)}
                        placeholder="Otomatis terisi dari sisa hutang"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />

                    <p className="mt-2 text-xs text-slate-500">
                        Nominal otomatis mengikuti sisa hutang database. User tetap bisa
                        mengubah nominal untuk pembayaran sebagian.
                    </p>
                </div>

                <div className="lg:col-span-2">
                    <label className="text-sm font-bold text-slate-700">Catatan</label>

                    <textarea
                        name="notes"
                        rows={3}
                        placeholder="Opsional"
                        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    />
                </div>

                <div className="lg:col-span-2">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isPending ? "Memposting..." : "Posting Pembayaran"}
                    </button>
                </div>
            </form>
        </section>
    );
}