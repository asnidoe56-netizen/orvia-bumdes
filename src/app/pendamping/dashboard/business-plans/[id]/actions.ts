"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

const allowedReviewResults = [
  "ready_for_village_submission",
  "needs_revision",
  "not_feasible",
] as const;

type ReviewResult = (typeof allowedReviewResults)[number];

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function isReviewResult(value: string): value is ReviewResult {
  return allowedReviewResults.includes(value as ReviewResult);
}

export async function reviewBusinessPlanAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id) {
    throw new Error("Sesi pengguna tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal tidak ditemukan."
  );

  const reviewResult = getRequiredString(
    formData,
    "review_result",
    "Hasil review wajib dipilih."
  );

  if (!isReviewResult(reviewResult)) {
    throw new Error("Hasil review tidak valid.");
  }

  const feasibilityNotes = getRequiredString(
    formData,
    "feasibility_notes",
    "Catatan kelayakan wajib diisi."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("review_business_plan", {
    p_business_plan_id: businessPlanId,
    p_review_result: reviewResult,
    p_feasibility_notes: feasibilityNotes,
    p_budget_notes: getOptionalString(formData, "budget_notes"),
    p_risk_notes: getOptionalString(formData, "risk_notes"),
    p_recommendation_notes: getOptionalString(
      formData,
      "recommendation_notes"
    ),
  });

  if (error) {
    throw new Error(error.message || "Review proposal gagal disimpan.");
  }

  revalidatePath("/pendamping/dashboard/business-plans");
  revalidatePath(`/pendamping/dashboard/business-plans/${businessPlanId}`);
  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/pendamping/dashboard/business-plans/${businessPlanId}`);
}
