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

export async function startReviewCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "pengawas") {
    throw new Error("Akses pengawas tidak valid.");
  }

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("start_unit_cutoff_migration_review", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    throw new Error(error.message || "Gagal memulai review cut-off migrasi.");
  }

  revalidatePath("/pengawas/dashboard/cutoff-migrasi");
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/pengawas/dashboard/cutoff-migrasi?review=${cutoffMigrationId}`);
}

export async function approveCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "pengawas") {
    throw new Error("Akses pengawas tidak valid.");
  }

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const governanceNotes = String(formData.get("governance_notes") ?? "").trim();

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
    p_governance_notes: governanceNotes || null,
  });

  if (error) {
    throw new Error(error.message || "Cut-off migrasi gagal disetujui.");
  }

  revalidatePath("/pengawas/dashboard/cutoff-migrasi");
  revalidatePath("/bumdes/dashboard/cutoff-migrasi");
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/pengawas/dashboard/cutoff-migrasi?approved=${cutoffMigrationId}`);
}

export async function rejectCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || context.role !== "pengawas") {
    throw new Error("Akses pengawas tidak valid.");
  }

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const rejectionReason = getRequiredString(
    formData,
    "rejection_reason",
    "Alasan penolakan wajib diisi."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    throw new Error(error.message || "Cut-off migrasi gagal ditolak.");
  }

  revalidatePath("/pengawas/dashboard/cutoff-migrasi");
  revalidatePath("/unit/dashboard/cutoff-migrasi");
  revalidatePath("/bumdes/dashboard/cutoff-migrasi");

  redirect(`/pengawas/dashboard/cutoff-migrasi?rejected=${cutoffMigrationId}`);
}
