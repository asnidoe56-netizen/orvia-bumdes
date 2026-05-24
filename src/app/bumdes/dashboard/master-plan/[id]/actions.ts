"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

export async function submitBusinessPlanToFacilitatorAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = String(formData.get("business_plan_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!businessPlanId) {
    throw new Error("ID proposal tidak ditemukan.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_business_plan_to_facilitator", {
    p_business_plan_id: businessPlanId,
    p_notes: notes || null,
  });

  if (error) {
    throw new Error(error.message || "Proposal gagal diajukan ke Pendamping Kecamatan.");
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}
