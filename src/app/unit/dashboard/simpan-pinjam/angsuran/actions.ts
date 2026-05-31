"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type RepaymentActionState = {
  success: boolean;
  message: string;
};

const ANGSURAN_PATH = "/unit/dashboard/simpan-pinjam/angsuran";

function parseAmount(value: FormDataEntryValue | null): number {
  const raw = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  if (!raw) return 0;

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export async function generateSavingsLoanRepaymentSchedule(
  _prevState: RepaymentActionState,
  formData: FormData,
): Promise<RepaymentActionState> {
  const applicationId = String(formData.get("application_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  const firstDueDate = String(formData.get("first_due_date") ?? "").trim();

  if (!applicationId) {
    return {
      success: false,
      message: "ID pengajuan tidak ditemukan.",
    };
  }

  if (!productId) {
    return {
      success: false,
      message: "Produk/skema pinjaman wajib dipilih.",
    };
  }

  if (!firstDueDate) {
    return {
      success: false,
      message: "Tanggal jatuh tempo pertama wajib diisi.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "generate_savings_loan_repayment_schedule",
    {
      p_application_id: applicationId,
      p_product_id: productId,
      p_first_due_date: firstDueDate,
    },
  );

  if (error) {
    return {
      success: false,
      message: error.message || "Jadwal angsuran gagal dibuat.",
    };
  }

  const { error: syncError } = await supabase.rpc(
    "sync_savings_loan_repayment_schedule_payments",
    {
      p_application_id: applicationId,
    },
  );

  revalidatePath(ANGSURAN_PATH);

  if (syncError) {
    return {
      success: true,
      message:
        "Jadwal berhasil dibuat, tetapi sinkronisasi pembayaran perlu dicek: " +
        syncError.message,
    };
  }

  return {
    success: true,
    message: "Jadwal angsuran berhasil dibuat dan disinkronkan.",
  };
}

export async function createSavingsLoanRepayment(
  _prevState: RepaymentActionState,
  formData: FormData,
): Promise<RepaymentActionState> {
  const applicationId = String(formData.get("application_id") ?? "").trim();
  const cashBankAccountId = String(
    formData.get("cash_bank_account_id") ?? "",
  ).trim();
  const repaymentDate = String(formData.get("repayment_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const principalAmount = parseAmount(formData.get("principal_amount"));
  const serviceAmount = parseAmount(formData.get("service_amount"));
  const adminAmount = parseAmount(formData.get("admin_amount"));
  const penaltyAmount = parseAmount(formData.get("penalty_amount"));

  if (!applicationId) {
    return {
      success: false,
      message: "ID pengajuan tidak ditemukan.",
    };
  }

  if (!cashBankAccountId) {
    return {
      success: false,
      message: "Akun kas/bank penerimaan wajib dipilih.",
    };
  }

  if (!repaymentDate) {
    return {
      success: false,
      message: "Tanggal angsuran wajib diisi.",
    };
  }

  const amounts = [
    principalAmount,
    serviceAmount,
    adminAmount,
    penaltyAmount,
  ];

  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0)) {
    return {
      success: false,
      message: "Nominal angsuran tidak valid.",
    };
  }

  const totalAmount =
    principalAmount + serviceAmount + adminAmount + penaltyAmount;

  if (totalAmount <= 0) {
    return {
      success: false,
      message: "Minimal salah satu komponen angsuran harus lebih dari 0.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_and_post_savings_loan_repayment", {
    p_application_id: applicationId,
    p_cash_bank_account_id: cashBankAccountId,
    p_repayment_date: repaymentDate,
    p_principal_amount: principalAmount,
    p_service_amount: serviceAmount,
    p_admin_amount: adminAmount,
    p_penalty_amount: penaltyAmount,
    p_notes: notes || null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Angsuran pinjaman gagal diposting.",
    };
  }

  const { error: syncError } = await supabase.rpc(
    "sync_savings_loan_repayment_schedule_payments",
    {
      p_application_id: applicationId,
    },
  );

  revalidatePath(ANGSURAN_PATH);

  if (syncError) {
    return {
      success: true,
      message:
        "Angsuran berhasil diposting, tetapi sinkronisasi jadwal perlu dicek: " +
        syncError.message,
    };
  }

  return {
    success: true,
    message: "Angsuran pinjaman berhasil diposting dan jadwal disinkronkan.",
  };
}
