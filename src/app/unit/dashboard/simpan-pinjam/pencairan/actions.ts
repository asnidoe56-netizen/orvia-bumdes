"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type DisbursementActionState = {
  success: boolean;
  message: string;
};

export async function createSavingsLoanDisbursement(
  _prevState: DisbursementActionState,
  formData: FormData,
): Promise<DisbursementActionState> {
  const applicationId = String(formData.get("application_id") ?? "").trim();
  const cashBankAccountId = String(
    formData.get("cash_bank_account_id") ?? "",
  ).trim();
  const disbursementDate = String(
    formData.get("disbursement_date") ?? "",
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!applicationId) {
    return {
      success: false,
      message: "ID pengajuan tidak ditemukan.",
    };
  }

  if (!cashBankAccountId) {
    return {
      success: false,
      message: "Akun kas/bank pencairan wajib dipilih.",
    };
  }

  if (!disbursementDate) {
    return {
      success: false,
      message: "Tanggal pencairan wajib diisi.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "create_and_post_savings_loan_disbursement",
    {
      p_application_id: applicationId,
      p_cash_bank_account_id: cashBankAccountId,
      p_disbursement_date: disbursementDate,
      p_notes: notes || null,
    },
  );

  if (error) {
    return {
      success: false,
      message: error.message || "Pencairan pinjaman gagal diproses.",
    };
  }

  revalidatePath("/unit/dashboard/simpan-pinjam/pencairan");
  revalidatePath("/unit/dashboard/simpan-pinjam/pengajuan");

  return {
    success: true,
    message: "Pencairan pinjaman berhasil diposting.",
  };
}
