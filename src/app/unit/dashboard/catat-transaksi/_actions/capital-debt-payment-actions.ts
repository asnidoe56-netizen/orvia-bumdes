"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CapitalDebtPaymentState = {
    success: boolean;
    message: string;
};

export async function payCapitalDebtAction(
    _prevState: CapitalDebtPaymentState,
    formData: FormData
): Promise<CapitalDebtPaymentState> {
    const supabase = await createClient();

    const capitalExpenditureId = String(
        formData.get("capital_expenditure_id") || ""
    );
    const cashBankAccountId = String(formData.get("cash_bank_account_id") || "");
    const paymentNo = String(formData.get("payment_no") || "");
    const paymentDate = String(formData.get("payment_date") || "");
    const amount = Number(formData.get("amount") || 0);
    const notes = String(formData.get("notes") || "");

    if (!capitalExpenditureId) {
        return { success: false, message: "Hutang Belanja Modal wajib dipilih." };
    }

    if (!cashBankAccountId) {
        return { success: false, message: "Akun kas/bank wajib dipilih." };
    }

    if (!paymentNo) {
        return { success: false, message: "Nomor pembayaran wajib diisi." };
    }

    if (!paymentDate) {
        return { success: false, message: "Tanggal pembayaran wajib diisi." };
    }

    if (!amount || amount <= 0) {
        return { success: false, message: "Nominal pembayaran harus lebih dari 0." };
    }

    const { error } = await supabase.rpc("pay_capital_expenditure_debt", {
        p_capital_expenditure_id: capitalExpenditureId,
        p_cash_bank_account_id: cashBankAccountId,
        p_payment_no: paymentNo,
        p_payment_date: paymentDate,
        p_amount: amount,
        p_notes: notes || null,
    });

    if (error) {
        return {
            success: false,
            message: error.message,
        };
    }

    revalidatePath("/unit/dashboard/catat-transaksi/bayar-hutang-belanja-modal");
    revalidatePath("/unit/dashboard/catat-transaksi");
    revalidatePath("/unit/dashboard/reports/neraca");

    return {
        success: true,
        message: "Pembayaran hutang Belanja Modal berhasil diposting.",
    };
}