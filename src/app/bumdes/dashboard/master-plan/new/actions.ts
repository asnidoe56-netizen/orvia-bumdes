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

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function getPositiveNumber(value: FormDataEntryValue | null, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

export async function createBusinessPlanAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const proposedUnitId = getRequiredString(
    formData,
    "proposed_unit_id",
    "Unit tujuan wajib dipilih."
  );

  const planNo = getRequiredString(
    formData,
    "plan_no",
    "Nomor proposal wajib diisi."
  ).toUpperCase();

  const title = getRequiredString(
    formData,
    "title",
    "Judul proposal wajib diisi."
  );

  const businessType = getRequiredString(
    formData,
    "business_type",
    "Jenis usaha wajib diisi."
  );

  const categories = formData.getAll("budget_category");
  const descriptions = formData.getAll("budget_description");
  const quantities = formData.getAll("budget_quantity");
  const units = formData.getAll("budget_unit_of_measure");
  const costs = formData.getAll("budget_unit_cost");
  const notes = formData.getAll("budget_notes");

  const budgetLines = categories
    .map((categoryValue, index) => {
      const category = String(categoryValue ?? "").trim();
      const description = String(descriptions[index] ?? "").trim();
      const quantity = getPositiveNumber(quantities[index], 0);
      const unitCost = getPositiveNumber(costs[index], 0);
      const unitOfMeasure = String(units[index] ?? "").trim() || "unit";
      const note = String(notes[index] ?? "").trim();

      if (!category && !description && quantity === 0 && unitCost === 0) {
        return null;
      }

      if (!category) {
        throw new Error(`Kategori RAB baris ${index + 1} wajib diisi.`);
      }

      if (!description) {
        throw new Error(`Uraian RAB baris ${index + 1} wajib diisi.`);
      }

      if (quantity <= 0) {
        throw new Error(`Jumlah RAB baris ${index + 1} harus lebih dari 0.`);
      }

      if (unitCost < 0) {
        throw new Error(`Harga satuan RAB baris ${index + 1} tidak boleh negatif.`);
      }

      return {
        category,
        description,
        quantity,
        unit_of_measure: unitOfMeasure,
        unit_cost: unitCost,
        notes: note || null,
      };
    })
    .filter(Boolean);

  if (budgetLines.length === 0) {
    throw new Error("Minimal satu baris RAB wajib diisi.");
  }

  const supabase = await createClient();

  const { data: businessPlanId, error } = await supabase.rpc(
    "create_business_plan",
    {
      p_tenant_id: context.tenant_id,
      p_proposed_unit_id: proposedUnitId,
      p_plan_no: planNo,
      p_title: title,
      p_business_type: businessType,
      p_background: getOptionalString(formData, "background"),
      p_objectives: getOptionalString(formData, "objectives"),
      p_market_analysis: getOptionalString(formData, "market_analysis"),
      p_operational_plan: getOptionalString(formData, "operational_plan"),
      p_risk_analysis: getOptionalString(formData, "risk_analysis"),
      p_expected_benefits: getOptionalString(formData, "expected_benefits"),
      p_budget_lines: budgetLines,
    }
  );

  if (error || !businessPlanId) {
    throw new Error(error?.message || "Proposal Master Plan gagal dibuat.");
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);
  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}
