"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

export type CashBankTransferActionState = {
  success: boolean;
  message: string;
};

function generateCashBankTransferNo() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `KB-TRF-${datePart}-${timePart}-${randomPart}`;
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
    throw new Error("Nominal transaksi kas-bank harus lebih dari 0.");
  }

  return Math.round(value);
}

export async function createAndPostCashBankTransfer(
  _prevState: CashBankTransferActionState,
  formData: FormData
): Promise<CashBankTransferActionState> {
  try {
    const context = await getLoginContext();

    if (!context?.tenant_id || !context.unit_id) {
      throw new Error("Sesi unit tidak valid. Silakan login ulang sebagai pengguna unit.");
    }

    const transferMode = getRequiredString(
      formData,
      "transfer_mode",
      "Jenis transaksi kas-bank wajib dipilih."
    );

    if (!["bank_to_cash", "cash_to_bank"].includes(transferMode)) {
      throw new Error("Jenis transaksi kas-bank tidak valid.");
    }

    const requestedTransferNo = String(formData.get("transfer_no") ?? "").trim();
    const transferNo = (
      requestedTransferNo || generateCashBankTransferNo()
    ).toUpperCase();

    const transferDate = getRequiredString(
      formData,
      "transfer_date",
      "Tanggal transaksi kas-bank wajib diisi."
    );

    const sourceCashBankAccountId = getRequiredString(
      formData,
      "source_cash_bank_account_id",
      "Akun sumber wajib dipilih."
    );

    const targetCashBankAccountId = getRequiredString(
      formData,
      "target_cash_bank_account_id",
      "Akun tujuan wajib dipilih."
    );

    if (sourceCashBankAccountId === targetCashBankAccountId) {
      throw new Error("Akun sumber dan akun tujuan tidak boleh sama.");
    }

    const amount = getRupiahAmount(formData, "amount");
    const description = getOptionalString(formData, "description");

    const supabase = await createClient();

    const { error } = await supabase.rpc(
      "create_and_post_cash_bank_internal_transfer",
      {
        p_source_cash_bank_account_id: sourceCashBankAccountId,
        p_target_cash_bank_account_id: targetCashBankAccountId,
        p_transfer_no: transferNo,
        p_transfer_date: transferDate,
        p_amount: amount,
        p_description: description,
      }
    );

    if (error) {
      throw new Error(
        error.message || "Transaksi kas-bank gagal disimpan dan diposting."
      );
    }

    revalidatePath("/unit/dashboard/cash-bank");
    revalidatePath("/unit/dashboard/reports");
    revalidatePath("/unit/dashboard");

    const successLabel =
      transferMode === "bank_to_cash"
        ? "Tarik Tunai dari Bank ke Kas berhasil diposting."
        : "Setor Tunai dari Kas ke Bank berhasil diposting.";

    return {
      success: true,
      message: successLabel,
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Transaksi kas-bank gagal disimpan dan diposting.",
    };
  }
}
