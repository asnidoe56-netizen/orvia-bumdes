"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function getOptionalDate(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (value) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
}

export async function postMonthlyFixedAssetDepreciation(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect(
      `/unit/dashboard/aset-tetap?error=${encodeURIComponent(
        "Sesi unit tidak valid. Silakan login ulang."
      )}`
    );
  }

  const canManageFixedAssets =
    context.role === "manager_unit" ||
    context.role === "super_admin_platform";

  if (!canManageFixedAssets) {
    redirect(
      `/unit/dashboard/aset-tetap?error=${encodeURIComponent(
        "Penyusutan aset tetap hanya dapat diproses oleh Manager Unit."
      )}`
    );
  }

  const depreciationDate = getOptionalDate(formData, "depreciation_date");
  const supabase = await createClient();

  const { error } = await supabase.rpc("post_monthly_fixed_asset_depreciation", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_depreciation_date: depreciationDate,
  });

  if (error) {
    const message = error.message?.includes("fixed_asset.manage")
      ? "Penyusutan aset tetap hanya dapat diproses oleh Manager Unit."
      : error.message || "Penyusutan aset tetap gagal diproses.";

    redirect(
      `/unit/dashboard/aset-tetap?error=${encodeURIComponent(message)}`
    );
  }

  revalidatePath("/unit/dashboard/aset-tetap");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard");
  revalidatePath("/unit/dashboard/cek-alur-transaksi");

  redirect("/unit/dashboard/aset-tetap");
}
