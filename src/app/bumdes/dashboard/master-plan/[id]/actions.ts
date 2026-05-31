"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type CapitalAllocationOption = {
  option_type: string;
  id: string;
  code: string | null;
  name: string | null;
  kind: string | null;
  unit_id: string | null;
  current_balance: number | null;
};

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

function getNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) return 0;

  const normalizedValue = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalizedValue);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function submitBusinessPlanToFacilitatorAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal tidak ditemukan."
  );

  const notes = getOptionalString(formData, "notes");

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_business_plan_to_facilitator", {
    p_business_plan_id: businessPlanId,
    p_notes: notes,
  });

  if (error) {
    throw new Error(
      error.message || "Proposal gagal diajukan ke Pendamping Kecamatan."
    );
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}
export async function submitBusinessPlanToVillageAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal tidak ditemukan."
  );

  const notes = getOptionalString(formData, "notes");

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_business_plan_to_village", {
    p_business_plan_id: businessPlanId,
    p_notes: notes,
  });

  if (error) {
    throw new Error(error.message || "Proposal gagal diajukan ke desa.");
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}

export async function recordVillageDecisionAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal tidak ditemukan."
  );

  const decision = getRequiredString(
    formData,
    "decision",
    "Keputusan desa wajib dipilih."
  );

  const isApproved = decision === "approved";

  if (decision !== "approved" && decision !== "rejected") {
    throw new Error("Keputusan desa tidak valid.");
  }

  const approvedCapitalAmount = isApproved
    ? getNumber(formData, "approved_capital_amount")
    : 0;

  const decisionNotes = getRequiredString(
    formData,
    "decision_notes",
    "Catatan keputusan desa wajib diisi."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("record_business_plan_village_decision", {
    p_business_plan_id: businessPlanId,
    p_is_approved: isApproved,
    p_approved_capital_amount: approvedCapitalAmount,
    p_decision_notes: decisionNotes,
  });

  if (error) {
    throw new Error(error.message || "Keputusan desa gagal dicatat.");
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}


export async function postCapitalDisbursementAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal tidak ditemukan."
  );

  const cashBankAccountId = getRequiredString(
    formData,
    "cash_bank_account_id",
    "Akun kas/bank tujuan wajib dipilih."
  );

  const equityAccountId = getRequiredString(
    formData,
    "equity_account_id",
    "Akun modal wajib dipilih."
  );

  const disbursementNo = getRequiredString(
    formData,
    "disbursement_no",
    "Nomor pencairan wajib diisi."
  );

  const disbursementDate = getRequiredString(
    formData,
    "disbursement_date",
    "Tanggal pencairan wajib diisi."
  );

  const amount = getNumber(formData, "amount");

  if (amount <= 0) {
    throw new Error("Nilai pencairan harus lebih dari 0.");
  }

  const sourceDocumentNo = getOptionalString(formData, "source_document_no");
  const sourceDocumentDate = getOptionalString(formData, "source_document_date");
  const description = getOptionalString(formData, "description");

  const supabase = await createClient();

  const { error } = await supabase.rpc("post_capital_disbursement", {
    p_business_plan_id: businessPlanId,
    p_cash_bank_account_id: cashBankAccountId,
    p_equity_account_id: equityAccountId,
    p_disbursement_no: disbursementNo,
    p_disbursement_date: disbursementDate,
    p_amount: amount,
    p_source_document_no: sourceDocumentNo,
    p_source_document_date: sourceDocumentDate,
    p_description: description,
  });

  if (error) {
    throw new Error(error.message || "Pencairan modal gagal diposting.");
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}

export async function postUnitCapitalAllocationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi tenant tidak valid.");
  }

  const businessPlanId = getRequiredString(
    formData,
    "business_plan_id",
    "ID proposal wajib diisi."
  );

  const capitalDisbursementId = getRequiredString(
    formData,
    "capital_disbursement_id",
    "ID pencairan modal wajib diisi."
  );

  const unitId = getRequiredString(
    formData,
    "unit_id",
    "Unit tujuan alokasi wajib diisi."
  );

  const sourceCashBankAccountId = getRequiredString(
    formData,
    "source_cash_bank_account_id",
    "Akun kas/bank sumber pusat wajib dipilih."
  );

  const targetCashBankAccountId = getRequiredString(
    formData,
    "target_cash_bank_account_id",
    "Akun kas/bank tujuan unit wajib dipilih."
  );

  const sourceEquityAccountId = getRequiredString(
    formData,
    "source_equity_account_id",
    "Akun modal sumber pusat wajib dipilih."
  );

  const targetEquityAccountId = getRequiredString(
    formData,
    "target_equity_account_id",
    "Akun modal tujuan unit wajib dipilih."
  );

  const allocationNo = getRequiredString(
    formData,
    "allocation_no",
    "Nomor alokasi modal wajib diisi."
  );

  const allocationDate = getRequiredString(
    formData,
    "allocation_date",
    "Tanggal alokasi modal wajib diisi."
  );

  const amountRaw = getRequiredString(
    formData,
    "amount",
    "Nilai alokasi modal wajib diisi."
  );

  const amount = Number(amountRaw);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Nilai alokasi modal tidak valid.");
  }

  const description = String(formData.get("description") ?? "").trim();

  const supabase = await createClient();

  const allocationErrorRedirect = (message: string) => {
    return redirect(
      `/bumdes/dashboard/master-plan/${businessPlanId}?allocationError=${encodeURIComponent(
        message
      )}`
    );
  };

  const { data: allocationOptions, error: allocationOptionsError } =
    await supabase.rpc("get_unit_capital_allocation_options", {
      p_business_plan_id: businessPlanId,
    });

  if (allocationOptionsError) {
    return allocationErrorRedirect(
      "Opsi alokasi modal belum dapat divalidasi. Silakan muat ulang halaman dan coba kembali."
    );
  }

  const sourceEquity = allocationOptions?.find((option: CapitalAllocationOption) =>
      option.option_type === "source_equity" &&
      option.id === sourceEquityAccountId
  );

  const targetEquity = allocationOptions?.find((option: CapitalAllocationOption) =>
      option.option_type === "target_equity" &&
      option.id === targetEquityAccountId
  );

  const sourceEquityType = sourceEquity?.kind ?? null;
  const targetEquityType = targetEquity?.kind ?? null;

  if (!sourceEquityType || !targetEquityType) {
    return allocationErrorRedirect(
      "Akun modal sumber atau tujuan tidak valid untuk proposal ini. Silakan pilih ulang akun modal dari daftar yang tersedia."
    );
  }

  if (sourceEquityType !== targetEquityType) {
    return allocationErrorRedirect(
      "Akun modal sumber dan tujuan belum sejenis. Gunakan pasangan yang sama: Modal Awal Desa ke Modal Awal Unit, atau Modal Tambahan Desa ke Modal Tambahan Unit."
    );
  }

  const { error } = await supabase.rpc("post_unit_capital_allocation", {
    p_business_plan_id: businessPlanId,
    p_capital_disbursement_id: capitalDisbursementId,
    p_unit_id: unitId,
    p_source_cash_bank_account_id: sourceCashBankAccountId,
    p_target_cash_bank_account_id: targetCashBankAccountId,
    p_source_equity_account_id: sourceEquityAccountId,
    p_target_equity_account_id: targetEquityAccountId,
    p_allocation_no: allocationNo,
    p_allocation_date: allocationDate,
    p_amount: amount,
    p_description: description || null,
  });

  if (error) {
    const message =
      error.message === "Jenis ekuitas sumber dan tujuan harus sama"
        ? "Akun modal sumber dan tujuan belum sejenis. Gunakan pasangan yang sama: Modal Awal Desa ke Modal Awal Unit, atau Modal Tambahan Desa ke Modal Tambahan Unit."
        : error.message;

    return allocationErrorRedirect(message);
  }

  revalidatePath("/bumdes/dashboard/master-plan");
  revalidatePath(`/bumdes/dashboard/master-plan/${businessPlanId}`);

  redirect(`/bumdes/dashboard/master-plan/${businessPlanId}`);
}






