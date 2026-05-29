"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

export async function approveJournalCorrectionAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "pengawas") {
    throw new Error("Akses pengawas tidak valid.");
  }

  const correctionId = getRequiredString(
    formData,
    "correction_id",
    "ID koreksi transaksi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_journal_correction", {
    p_correction_id: correctionId,
  });

  if (error) {
    throw new Error(error.message || "Koreksi transaksi gagal disetujui.");
  }

  revalidatePath("/pengawas/dashboard");
  revalidatePath("/pengawas/dashboard/koreksi-transaksi");
  revalidatePath(`/pengawas/dashboard/koreksi-transaksi/${correctionId}`);

  redirect(`/pengawas/dashboard/koreksi-transaksi/${correctionId}`);
}

export async function rejectJournalCorrectionAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "pengawas") {
    throw new Error("Akses pengawas tidak valid.");
  }

  const correctionId = getRequiredString(
    formData,
    "correction_id",
    "ID koreksi transaksi tidak ditemukan."
  );

  const rejectionReason = getRequiredString(
    formData,
    "rejection_reason",
    "Alasan penolakan wajib diisi."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_journal_correction", {
    p_correction_id: correctionId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    throw new Error(error.message || "Koreksi transaksi gagal ditolak.");
  }

  revalidatePath("/pengawas/dashboard");
  revalidatePath("/pengawas/dashboard/koreksi-transaksi");
  revalidatePath(`/pengawas/dashboard/koreksi-transaksi/${correctionId}`);

  redirect(`/pengawas/dashboard/koreksi-transaksi/${correctionId}`);
}