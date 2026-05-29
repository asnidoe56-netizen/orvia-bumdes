"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

export type RevenueReceiptActionState = {
  success: boolean;
  message: string;
};

function generateRevenueReceiptNo() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `TP-${datePart}-${timePart}-${randomPart}`;
}

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function getRupiahAmount(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue || Number.isNaN(value) || value <= 0) {
    throw new Error("Nominal Terima Pendapatan harus lebih dari 0.");
  }

  return Math.round(value);
}

export async function createAndPostRevenueReceipt(
  _prevState: RevenueReceiptActionState,
  formData: FormData
): Promise<RevenueReceiptActionState> {
  try {
    const context = await getLoginContext();

    if (!context?.tenant_id || !context.unit_id) {
      throw new Error("Sesi unit tidak valid.");
    }

    const requestedReceiptNo = String(formData.get("receipt_no") ?? "").trim();
    const receiptNo = (
      requestedReceiptNo || generateRevenueReceiptNo()
    ).toUpperCase();

    const receiptDate = getRequiredString(
      formData,
      "receipt_date",
      "Tanggal Terima Pendapatan wajib diisi."
    );

    const revenueAccountId = getRequiredString(
      formData,
      "revenue_account_id",
      "Jenis pendapatan wajib dipilih."
    );

    const cashBankAccountId = getRequiredString(
      formData,
      "cash_bank_account_id",
      "Akun kas/bank penerimaan wajib dipilih."
    );

    const totalAmount = getRupiahAmount(formData, "total_amount");
    const description = getOptionalString(formData, "description");

    const supabase = await createClient();

    const { error } = await supabase.rpc("create_and_post_revenue_receipt", {
      p_tenant_id: context.tenant_id,
      p_unit_id: context.unit_id,
      p_receipt_no: receiptNo,
      p_receipt_date: receiptDate,
      p_revenue_account_id: revenueAccountId,
      p_cash_bank_account_id: cashBankAccountId,
      p_total_amount: totalAmount,
      p_description: description,
    });

    if (error) {
      throw new Error(
        error.message || "Terima Pendapatan gagal disimpan dan diposting."
      );
    }

    revalidatePath("/unit/dashboard/catat-transaksi");
    revalidatePath("/unit/dashboard/catat-transaksi/terima-pendapatan");
    revalidatePath("/unit/dashboard/cash-bank");
    revalidatePath("/unit/dashboard/reports");
    revalidatePath("/unit/dashboard");

    return {
      success: true,
      message: "Terima Pendapatan berhasil disimpan dan diposting.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Terima Pendapatan gagal disimpan dan diposting.",
    };
  }
}
