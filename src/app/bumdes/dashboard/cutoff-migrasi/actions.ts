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
  const role = context?.role ?? "";
  const cutoffMigrationId = String(formData.get("cutoff_migration_id") ?? "").trim();

  if (!context?.user_id) {
    redirect("/login");
  }

  if (!["admin_bumdes", "direktur_bumdes"].includes(role)) {
    redirect("/bumdes/dashboard/cutoff-migrasi?notice=posting_role");
  }

  if (!cutoffMigrationId) {
    redirect("/bumdes/dashboard/cutoff-migrasi?notice=cutoff_missing");
  }

  const supabase = await createClient();

  const { error: prepareError } = await supabase.rpc(
    "prepare_unit_cutoff_migration_accounting_periods",
    {
      p_cutoff_migration_id: cutoffMigrationId,
    }
  );

  if (prepareError) {
    const message = prepareError.message || "";

    console.error("prepare_unit_cutoff_migration_accounting_periods failed", {
      cutoffMigrationId,
      role,
      message,
    });

    const normalizedMessage = message.toLowerCase();
    const notice =
      normalizedMessage.includes("orvia start date period is not open") ||
      normalizedMessage.includes("period is not open")
        ? "period_not_open"
        : "prepare_failed";

    redirect(
      `/bumdes/dashboard/cutoff-migrasi?notice=${notice}&cutoff=${cutoffMigrationId}`
    );
  }

  const { error } = await supabase.rpc("post_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    console.error("post_unit_cutoff_migration failed", {
      cutoffMigrationId,
      role,
      message: error.message,
    });

    redirect(
      `/bumdes/dashboard/cutoff-migrasi?notice=posting_failed&cutoff=${cutoffMigrationId}`
    );
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