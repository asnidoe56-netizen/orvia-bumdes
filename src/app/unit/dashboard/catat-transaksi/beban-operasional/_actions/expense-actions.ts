"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

export type OperationalExpenseActionState = {
  success: boolean;
  message: string;
};

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function generateOperationalExpenseNo() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BO-${datePart}-${timePart}-${randomPart}`;
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
    throw new Error("Nominal Beban Operasional harus lebih dari 0.");
  }

  return Math.round(value);
}

export async function createAndPostOperationalExpense(
  _prevState: OperationalExpenseActionState,
  formData: FormData
): Promise<OperationalExpenseActionState> {
  try {
    const context = await getLoginContext();

    if (!context?.tenant_id || !context.unit_id) {
      throw new Error("Sesi unit tidak valid.");
    }

    const requestedExpenseNo = String(formData.get("expense_no") ?? "").trim();
    const expenseNo = (
      requestedExpenseNo || generateOperationalExpenseNo()
    ).toUpperCase();

    const expenseDate = getRequiredString(
      formData,
      "expense_date",
      "Tanggal Beban Operasional wajib diisi."
    );

    const expenseAccountId = getRequiredString(
      formData,
      "expense_account_id",
      "Jenis beban wajib dipilih."
    );

    const cashBankAccountId = getRequiredString(
      formData,
      "cash_bank_account_id",
      "Akun kas/bank pembayaran wajib dipilih."
    );

    const totalAmount = getRupiahAmount(formData, "total_amount");
    const description = getOptionalString(formData, "description");
    const operatorReason = getOptionalString(formData, "operator_reason");

    const today = formatDateInput(new Date());

    if (expenseDate !== today && !operatorReason) {
      throw new Error(
        "Alasan tanggal input berbeda wajib diisi jika tanggal transaksi bukan tanggal hari ini."
      );
    }
    const supabase = await createClient();

    const { error } = await supabase.rpc("create_and_post_operational_expense_v2", {
      p_tenant_id: context.tenant_id,
      p_unit_id: context.unit_id,
      p_expense_no: expenseNo,
      p_expense_date: expenseDate,
      p_expense_account_id: expenseAccountId,
      p_cash_bank_account_id: cashBankAccountId,
      p_total_amount: totalAmount,
      p_description: description,
      p_operator_reason: operatorReason,
    });

    if (error) {
      throw new Error(
        error.message || "Beban Operasional gagal disimpan dan diposting."
      );
    }

    revalidatePath("/unit/dashboard/catat-transaksi");
    revalidatePath("/unit/dashboard/catat-transaksi/beban-operasional");
    revalidatePath("/unit/dashboard/cash-bank");
    revalidatePath("/unit/dashboard/reports");
    revalidatePath("/unit/dashboard");

    return {
      success: true,
      message: "Beban Operasional berhasil disimpan dan diposting.",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Beban Operasional gagal disimpan dan diposting.",
    };
  }
}





