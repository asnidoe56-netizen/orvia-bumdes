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

type AssistantResult = {
    tone: "success" | "warning" | "error";
    message: string;
    warnings?: string[];
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

function CashBankSelect({
    cashBanks,
    value,
    onChange,
}: {
    cashBanks: CashBankBalance[];
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div>
            <label className="text-sm font-bold text-slate-700">
                Kas / Bank Pembayaran
            </label>

            <select
                name="cash_bank_account_id"
                required
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-900 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
            >
                <option value="">Pilih kas/bank</option>

                {cashBanks.map((account) => (
                    <option
                        key={account.cash_bank_account_id}
                        value={account.cash_bank_account_id}
                    >
                        {account.account_code}  -  {account.account_name}  -  Saldo:{" "}
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
    const [cashBankAccountId, setCashBankAccountId] = useState("");
    const [paymentDate, setPaymentDate] = useState(getTodayDate());
    const [notesValue, setNotesValue] = useState("");
    const [amountValue, setAmountValue] = useState("");
    const [assistantPrompt, setAssistantPrompt] = useState("");
    const [assistantResult, setAssistantResult] =
        useState<AssistantResult | null>(null);
    const [isAssistantLoading, setIsAssistantLoading] = useState(false);

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

    async function handleAssistantFill() {
        const prompt = assistantPrompt.trim();

        if (!prompt) {
            setAssistantResult({
                tone: "warning",
                message:
                    "Tulis dulu kalimat pembayaran. Contoh: hari ini bayar hutang belanja modal Indra 500 ribu dari kas.",
            });
            return;
        }

        setIsAssistantLoading(true);
        setAssistantResult(null);

        try {
            const response = await fetch("/api/unit/assistant", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    module: "capital_debt_payment",
                    prompt,
                    client_today: getTodayDate(),
                }),
            });

            const payload = await response.json();

            if (!response.ok || !payload?.success) {
                setAssistantResult({
                    tone: "error",
                    message:
                        payload?.message ||
                        "Assistant belum berhasil membaca pembayaran hutang belanja modal.",
                });
                return;
            }

            const draft = payload.draft ?? {};

            setSelectedPayableId(String(draft.capital_expenditure_id ?? ""));
            setCashBankAccountId(String(draft.cash_bank_account_id ?? ""));
            setPaymentDate(String(draft.payment_date ?? getTodayDate()));
            setAmountValue(String(draft.amount ?? ""));
            setNotesValue(String(draft.notes ?? prompt));

            setAssistantResult({
                tone:
                    Array.isArray(payload.warnings) && payload.warnings.length > 0
                        ? "warning"
                        : "success",
                message:
                    payload.summary ||
                    "Assistant berhasil menyusun draft. Periksa kembali sebelum posting.",
                warnings: payload.warnings ?? [],
            });
        } catch (error) {
            setAssistantResult({
                tone: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Assistant belum berhasil membaca data pembayaran.",
            });
        } finally {
            setIsAssistantLoading(false);
        }
    }

    return (
        <section className="rounded-3xl border border-slate-900 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-950">
                Form Pembayaran Hutang Belanja Modal
            </h2>

            <p className="mt-1 text-sm text-slate-600">
                Pilih hutang Belanja Modal yang masih terbuka. Nominal pembayaran akan
                otomatis mengikuti sisa hutang di database, tetapi masih bisa diubah oleh
                user.
            </p>

            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="mb-3">
                    <p className="text-xs font-bold text-emerald-950">
                        Asisten Isi Pembayaran Hutang Belanja Modal
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-800">
                        Tulis pembayaran dengan bahasa biasa. Asisten hanya membantu isi
                        form. Posting tetap dilakukan petugas lewat tombol resmi.
                    </p>
                </div>

                <textarea
                    value={assistantPrompt}
                    onChange={(event) => setAssistantPrompt(event.target.value)}
                    rows={3}
                    placeholder="Contoh: hari ini bayar hutang belanja modal Indra 500 ribu dari kas"
                    className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />

                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="button"
                        onClick={handleAssistantFill}
                        disabled={isAssistantLoading}
                        className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {isAssistantLoading
                            ? "Assistant membaca database..."
                            : "Gunakan Asisten untuk Isi Form"}
                    </button>

                    <p className="text-xs leading-5 text-emerald-800">
                        Assistant membaca hutang belanja modal terbuka dan saldo kas/bank
                        secara read-only.
                    </p>
                </div>

                {assistantResult ? (
                    <div
                        className={`mt-3 rounded-xl border px-3 py-2 text-xs leading-5 ${
                            assistantResult.tone === "error"
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : assistantResult.tone === "warning"
                                  ? "border-amber-200 bg-amber-50 text-amber-700"
                                  : "border-emerald-200 bg-white text-emerald-800"
                        }`}
                    >
                        <p className="font-semibold">{assistantResult.message}</p>

                        {assistantResult.warnings?.length ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4">
                                {assistantResult.warnings.map((warning) => (
                                    <li key={warning}>{warning}</li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                ) : null}
            </div>

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
                        className="mt-2 w-full rounded-2xl border border-slate-900 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
                    >
                        <option value="">Pilih hutang Belanja Modal</option>

                        {payables.map((item) => (
                            <option
                                key={item.capital_expenditure_id}
                                value={item.capital_expenditure_id}
                            >
                                {item.transaction_no}  -  Hutang Aset/Belanja Modal  -  Supplier:{" "}
                                {item.supplier_name || "-"}  -  Sisa:{" "}
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

                <CashBankSelect
                    cashBanks={cashBanks}
                    value={cashBankAccountId}
                    onChange={setCashBankAccountId}
                />

                <div>
                    <label className="text-sm font-bold text-slate-700">
                        Nomor Pembayaran
                    </label>

                    <input
                        name="payment_no"
                        required
                        defaultValue={generatePaymentNo()}
                        className="mt-2 w-full rounded-2xl border border-slate-900 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
                        value={paymentDate}
                        onChange={(event) => setPaymentDate(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-slate-900 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
                        className="mt-2 w-full rounded-2xl border border-slate-900 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
                        value={notesValue}
                        onChange={(event) => setNotesValue(event.target.value)}
                        placeholder="Opsional"
                        className="mt-2 w-full rounded-2xl border border-slate-900 px-4 py-3 text-sm text-slate-700 outline-none focus:border-emerald-500"
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
