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

export async function postJournalCorrectionAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "admin_bumdes") {
    throw new Error("Hanya Admin BUMDes yang dapat memposting koreksi transaksi.");
  }

  const correctionId = getRequiredString(
    formData,
    "correction_id",
    "ID koreksi transaksi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("post_journal_correction", {
    p_correction_id: correctionId,
  });

  if (error) {
    throw new Error(error.message || "Posting koreksi transaksi gagal.");
  }

  revalidatePath("/bumdes/dashboard");
  revalidatePath("/bumdes/dashboard/koreksi-transaksi");
  revalidatePath(`/bumdes/dashboard/koreksi-transaksi/${correctionId}`);
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard/cek-alur-transaksi");

  redirect(`/bumdes/dashboard/koreksi-transaksi/${correctionId}`);
}