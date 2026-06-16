"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

const PAGE_PATH = "/unit/dashboard/buka-periode";

function redirectWithError(message: string): never {
  redirect(`${PAGE_PATH}?error=${encodeURIComponent(message)}`);
}

export async function requestAccountingPeriodReopen(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id || !context.role) {
    redirectWithError("Konteks login unit tidak valid.");
  }

  if (!["manager_unit", "operator_unit"].includes(context.role)) {
    redirectWithError("Hanya Manager Unit dan Operator Unit yang dapat mengajukan buka periode.");
  }

  const periodId = String(formData.get("period_id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();

  if (!periodId) {
    redirectWithError("Periode belum dipilih.");
  }

  if (reason.length < 10) {
    redirectWithError("Alasan buka periode wajib diisi minimal 10 karakter.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("request_reopen_accounting_period", {
    p_period_id: periodId,
    p_reason: reason,
    p_reopen_until: null,
  });

  if (error) {
    redirectWithError(error.message || "Gagal mengajukan buka periode.");
  }

  revalidatePath(PAGE_PATH);
  revalidatePath("/bumdes/dashboard/periode-akuntansi");

  redirect(`${PAGE_PATH}?requested=${periodId}`);
}

