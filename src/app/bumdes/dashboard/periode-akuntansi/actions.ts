"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

const BASE_PATH = "/bumdes/dashboard/periode-akuntansi";

function redirectWithError(unitId: string, message: string): never {
  redirect(`${BASE_PATH}/${unitId}?error=${encodeURIComponent(message)}`);
}

export async function reviewPeriodReopenRequest(formData: FormData) {
  const context = await getLoginContext();
  const tenantId = context?.tenant_id;
  const role = context?.role;

  const unitId = String(formData.get("unit_id") || "").trim();
  const requestId = String(formData.get("request_id") || "").trim();
  const actionType = String(formData.get("action_type") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!unitId) {
    redirect(`${BASE_PATH}?error=${encodeURIComponent("Unit tidak valid.")}`);
  }

  if (!tenantId || !role) {
    redirectWithError(unitId, "Konteks login Direktur tidak valid.");
  }

  if (role !== "direktur_bumdes") {
    redirectWithError(unitId, "Hanya Direktur BUMDes yang dapat menyetujui atau menolak buka periode.");
  }

  if (!requestId) {
    redirectWithError(unitId, "Permintaan buka periode tidak valid.");
  }

  const supabase = await createClient();

  if (actionType === "approve") {
    const { error } = await supabase.rpc("approve_period_reopen_request", {
      p_request_id: requestId,
      p_notes: notes || null,
    });

    if (error) {
      redirectWithError(unitId, error.message || "Gagal menyetujui buka periode.");
    }

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${unitId}`);
    redirect(`${BASE_PATH}/${unitId}?approved=${requestId}`);
  }

  if (actionType === "reject") {
    const { error } = await supabase.rpc("reject_period_reopen_request", {
      p_request_id: requestId,
      p_notes: notes || null,
    });

    if (error) {
      redirectWithError(unitId, error.message || "Gagal menolak buka periode.");
    }

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${unitId}`);
    redirect(`${BASE_PATH}/${unitId}?rejected=${requestId}`);
  }

  if (actionType === "close_again") {
    const { error } = await supabase.rpc("close_reopened_accounting_period", {
      p_request_id: requestId,
      p_notes: notes || null,
    });

    if (error) {
      redirectWithError(unitId, error.message || "Gagal menutup kembali periode.");
    }

    revalidatePath(BASE_PATH);
    revalidatePath(`${BASE_PATH}/${unitId}`);
    redirect(`${BASE_PATH}/${unitId}?closed=${requestId}`);
  }

  redirectWithError(unitId, "Aksi tidak dikenali.");
}
