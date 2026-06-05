"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type BalanceSheetPresentationMode = "contra_asset_detail" | "net_book_value";

function normalizePresentationMode(
  value: FormDataEntryValue | null
): BalanceSheetPresentationMode {
  return value === "net_book_value" ? "net_book_value" : "contra_asset_detail";
}

export async function setNeracaPresentationMode(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    redirect("/unit/dashboard/reports/neraca");
  }

  const presentationMode = normalizePresentationMode(
    formData.get("presentation_mode")
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_balance_sheet_presentation_mode", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_presentation_mode: presentationMode,
  });

  if (error) {
    redirect(
      `/unit/dashboard/reports/neraca?error=${encodeURIComponent(
        error.message || "Mode penyajian neraca gagal diubah."
      )}`
    );
  }

  revalidatePath("/unit/dashboard/reports/neraca");
  redirect("/unit/dashboard/reports/neraca");
}
