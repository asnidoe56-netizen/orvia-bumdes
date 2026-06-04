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

function assertBumdesPostingRole(role: string | null | undefined) {
  if (!["admin_bumdes", "direktur_bumdes"].includes(role ?? "")) {
    throw new Error("Hanya Admin atau Direktur BUMDes yang dapat memproses cut-off migrasi.");
  }
}

export async function prepareBumdesCutoffAccountingPeriodsAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id) {
    throw new Error("Konteks login BUMDes tidak valid.");
  }

  assertBumdesPostingRole(context.role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("prepare_unit_cutoff_migration_accounting_periods", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    throw new Error(error.message || "Gagal menyiapkan periode akuntansi cut-off.");
  }

  revalidatePath("/bumdes/dashboard/cutoff-migrasi");

  redirect(`/bumdes/dashboard/cutoff-migrasi?periods_prepared=${cutoffMigrationId}`);
}

export async function postBumdesCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id) {
    throw new Error("Konteks login BUMDes tidak valid.");
  }

  assertBumdesPostingRole(context.role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error: prepareError } = await supabase.rpc(
    "prepare_unit_cutoff_migration_accounting_periods",
    {
      p_cutoff_migration_id: cutoffMigrationId,
    }
  );

  if (prepareError) {
    throw new Error(
      prepareError.message || "Gagal menyiapkan periode akuntansi cut-off."
    );
  }

  const { error } = await supabase.rpc("post_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    throw new Error(error.message || "Posting cut-off migrasi gagal.");
  }

  revalidatePath("/bumdes/dashboard");
  revalidatePath("/bumdes/dashboard/cutoff-migrasi");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard/reports/laba-rugi");
  revalidatePath("/unit/dashboard/reports/neraca");
  revalidatePath("/unit/dashboard/reports/arus-kas");
  revalidatePath("/unit/dashboard/reports/perubahan-ekuitas");
  revalidatePath("/unit/dashboard/cek-alur-transaksi");
  revalidatePath("/unit/dashboard/cash-bank");
  revalidatePath("/unit/dashboard/inventory");
  revalidatePath("/unit/dashboard/aset-tetap");

  redirect(`/bumdes/dashboard/cutoff-migrasi?posted=${cutoffMigrationId}`);
}

