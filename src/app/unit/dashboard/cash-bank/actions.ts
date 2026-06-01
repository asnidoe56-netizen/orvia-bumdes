"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type CashBankTransferActionState = {
  ok: boolean;
  message: string;
};

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function normalizeAmount(value: string) {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const numeric = Number(cleaned);

  return Number.isFinite(numeric) ? numeric : 0;
}

export async function createCashBankInternalTransfer(
  _previousState: CashBankTransferActionState,
  formData: FormData,
): Promise<CashBankTransferActionState> {
  const sourceCashBankAccountId = readText(formData, "source_cash_bank_account_id");
  const targetCashBankAccountId = readText(formData, "target_cash_bank_account_id");
  const transferNo = readText(formData, "transfer_no").toUpperCase();
  const transferDate = readText(formData, "transfer_date");
  const amount = normalizeAmount(readText(formData, "amount"));
  const description = readText(formData, "description");

  if (!sourceCashBankAccountId) {
    return {
      ok: false,
      message: "Akun sumber kas/bank wajib dipilih.",
    };
  }

  if (!targetCashBankAccountId) {
    return {
      ok: false,
      message: "Akun tujuan kas/bank wajib dipilih.",
    };
  }

  if (sourceCashBankAccountId === targetCashBankAccountId) {
    return {
      ok: false,
      message: "Akun sumber dan akun tujuan tidak boleh sama.",
    };
  }

  if (!transferNo) {
    return {
      ok: false,
      message: "Nomor transfer wajib diisi.",
    };
  }

  if (!transferDate) {
    return {
      ok: false,
      message: "Tanggal transfer wajib diisi.",
    };
  }

  if (amount <= 0) {
    return {
      ok: false,
      message: "Nominal transfer harus lebih dari Rp0.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_and_post_cash_bank_internal_transfer", {
    p_source_cash_bank_account_id: sourceCashBankAccountId,
    p_target_cash_bank_account_id: targetCashBankAccountId,
    p_transfer_no: transferNo,
    p_transfer_date: transferDate,
    p_amount: amount,
    p_description: description || null,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  revalidatePath("/unit/dashboard/cash-bank");

  return {
    ok: true,
    message: "Transfer antar kas/bank berhasil diposting.",
  };
}
