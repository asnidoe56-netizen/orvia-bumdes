"use server";

import { revalidatePath } from "next/cache";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

export type ApplicationActionState = {
  success: boolean;
  message: string;
};

function toNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(/\./g, "").replace(/,/g, ".").trim();
  const numberValue = Number(raw);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function generateApplicationNo(method: string, inputMode: string) {
  const now = new Date();
  const methodPrefix = method === "group" ? "PJM-GRP" : "PJM-IND";
  const modePrefix = inputMode === "assisted_by_officer" ? "ASST" : "SELF";
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `${methodPrefix}-${modePrefix}-${datePart}-${timePart}`;
}

function generateGroupNo() {
  const now = new Date();
  const datePart = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const timePart = [
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `KLP-AUTO-${datePart}-${timePart}`;
}

function parseGroupMembers(formData: FormData) {
  const rows = [0, 1, 2, 3, 4];

  return rows
    .map((index) => {
      const fullName = String(
        formData.get(`group_member_${index}_full_name`) ?? "",
      ).trim();
      const identityNumber = String(
        formData.get(`group_member_${index}_identity_number`) ?? "",
      ).trim();
      const phone = String(formData.get(`group_member_${index}_phone`) ?? "").trim();
      const address = String(
        formData.get(`group_member_${index}_address`) ?? "",
      ).trim();
      const roleInGroup = String(
        formData.get(`group_member_${index}_role_in_group`) ?? "member",
      ).trim();
const notes = String(formData.get(`group_member_${index}_notes`) ?? "").trim();

      if (!fullName && !identityNumber && !phone) {
        return null;
      }

      return {
        full_name: fullName,
        identity_number: identityNumber || null,
        phone: phone || null,
        address: address || null,
        is_leader: index === 0,
        role_in_group: index === 0 ? "leader" : roleInGroup || "member",
notes: notes || null,
      };
    })
    .filter(Boolean);
}

export async function createApplicantFirstLoanApplication(
  _prevState: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return {
      success: false,
      message: "Konteks tenant/unit tidak ditemukan. Silakan login ulang.",
    };
  }

  const applicationMethod = String(formData.get("application_method") ?? "individual").trim();
  const inputMode = String(formData.get("input_mode") ?? "self_service").trim();
  const rawApplicationNo = String(formData.get("application_no") ?? "").trim();
  const applicationNo =
    rawApplicationNo || generateApplicationNo(applicationMethod, inputMode);
  const applicationDate = String(formData.get("application_date") ?? "").trim();

  const requestedAmount = toNumber(formData.get("requested_amount"));
  const tenorMonths = Number(formData.get("tenor_months") ?? 0);
  const loanPurpose = String(formData.get("loan_purpose") ?? "").trim();
  const incomeSource = String(formData.get("income_source") ?? "").trim();
  const estimatedRepaymentCapacity = toNumber(
    formData.get("estimated_repayment_capacity"),
  );
  const businessOrJobType = String(
    formData.get("business_or_job_type") ?? "",
  ).trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supportingDocumentUrl = String(
    formData.get("supporting_document_url") ?? "",
  ).trim();
  const supportingDocumentName = String(
    formData.get("supporting_document_name") ?? "",
  ).trim();

  const declarationAccepted =
    String(formData.get("declaration_accepted") ?? "") === "on";
  const assistedReason = String(formData.get("assisted_reason") ?? "").trim();

  if (
    !applicationDate ||
    !applicationMethod ||
    !inputMode ||
    !requestedAmount ||
    !tenorMonths ||
    !loanPurpose ||
    !incomeSource ||
    !estimatedRepaymentCapacity ||
    !businessOrJobType ||
    !supportingDocumentUrl ||
    !supportingDocumentName
  ) {
    return {
      success: false,
      message:
        "Tanggal, metode, mode input, nilai pinjaman, tenor, tujuan, sumber penghasilan, kemampuan angsur, jenis usaha/pekerjaan, dan dokumen PDF wajib diisi.",
    };
  }

  if (!supportingDocumentName.toLowerCase().endsWith(".pdf")) {
    return {
      success: false,
      message: "Dokumen pendukung wajib berupa file PDF.",
    };
  }

  if (inputMode === "self_service" && !declarationAccepted) {
    return {
      success: false,
      message: "Pemohon wajib menyetujui pernyataan kebenaran data.",
    };
  }

  if (inputMode === "assisted_by_officer" && !assistedReason) {
    return {
      success: false,
      message: "Alasan input dibantu petugas wajib diisi.",
    };
  }

  const supabase = await createClient();

  if (applicationMethod === "individual") {
    const applicantFullName = String(
      formData.get("applicant_full_name") ?? "",
    ).trim();
    const applicantIdentityNumber = String(
      formData.get("applicant_identity_number") ?? "",
    ).trim();
    const applicantPhone = String(formData.get("applicant_phone") ?? "").trim();
    const applicantAddress = String(
      formData.get("applicant_address") ?? "",
    ).trim();

    if (!applicantFullName || (!applicantIdentityNumber && !applicantPhone)) {
      return {
        success: false,
        message: "Nama pemohon dan minimal salah satu dari NIK/HP wajib diisi.",
      };
    }

    const { error } = await supabase.rpc(
      "create_savings_loan_applicant_intake_individual",
      {
        p_tenant_id: context.tenant_id,
        p_unit_id: context.unit_id,
        p_application_no: applicationNo,
        p_application_date: applicationDate,
        p_input_mode: inputMode,
        p_applicant_full_name: applicantFullName,
        p_applicant_identity_number: applicantIdentityNumber || null,
        p_applicant_phone: applicantPhone || null,
        p_applicant_address: applicantAddress || null,
        p_requested_amount: requestedAmount,
        p_tenor_months: tenorMonths,
        p_loan_purpose: loanPurpose,
        p_income_source: incomeSource,
        p_estimated_repayment_capacity: estimatedRepaymentCapacity,
        p_business_or_job_type: businessOrJobType,
        p_notes: notes || null,
        p_supporting_document_url: supportingDocumentUrl,
        p_supporting_document_name: supportingDocumentName,
        p_supporting_document_mime_type: "application/pdf",
        p_declaration_accepted: declarationAccepted,
        p_assisted_by: inputMode === "assisted_by_officer" ? context.user_id : null,
        p_assisted_reason:
          inputMode === "assisted_by_officer" ? assistedReason : null,
      },
    );

    if (error) {
      return {
        success: false,
        message: error.message || "Pengajuan perorangan gagal disimpan.",
      };
    }
  } else if (applicationMethod === "group") {
    const groupId = String(formData.get("existing_group_id") ?? "").trim();
    const rawGroupNo = String(formData.get("group_no") ?? "").trim();
    const groupNo = rawGroupNo || generateGroupNo();
    const groupName = String(formData.get("group_name") ?? "").trim();
    const groupAddress = String(formData.get("group_address") ?? "").trim();
    const groupMembers = parseGroupMembers(formData);

    if (!groupId && !groupName) {
      return {
        success: false,
        message: "Nama kelompok wajib diisi jika tidak memilih kelompok existing.",
      };
    }

    if (groupMembers.length < 2) {
      return {
        success: false,
        message: "Pengajuan kelompok minimal berisi 2 anggota.",
      };
    }


    const { error } = await supabase.rpc(
      "create_savings_loan_applicant_intake_group",
      {
        p_tenant_id: context.tenant_id,
        p_unit_id: context.unit_id,
        p_application_no: applicationNo,
        p_application_date: applicationDate,
        p_input_mode: inputMode,
        p_group_id: groupId || null,
        p_group_no: groupId ? null : groupNo,
        p_group_name: groupId ? null : groupName,
        p_group_address: groupId ? null : groupAddress || null,
        p_group_members: groupMembers,
        p_requested_amount: requestedAmount,
        p_tenor_months: tenorMonths,
        p_loan_purpose: loanPurpose,
        p_income_source: incomeSource,
        p_estimated_repayment_capacity: estimatedRepaymentCapacity,
        p_business_or_job_type: businessOrJobType,
        p_notes: notes || null,
        p_supporting_document_url: supportingDocumentUrl,
        p_supporting_document_name: supportingDocumentName,
        p_supporting_document_mime_type: "application/pdf",
        p_declaration_accepted: declarationAccepted,
        p_assisted_by: inputMode === "assisted_by_officer" ? context.user_id : null,
        p_assisted_reason:
          inputMode === "assisted_by_officer" ? assistedReason : null,
      },
    );

    if (error) {
      return {
        success: false,
        message: error.message || "Pengajuan kelompok gagal disimpan.",
      };
    }
  } else {
    return {
      success: false,
      message: "Metode pengajuan tidak valid.",
    };
  }

  revalidatePath("/unit/dashboard/simpan-pinjam/pengajuan");

  return {
    success: true,
    message:
      "Pengajuan berhasil dikirim. Data anggota/kelompok akan dibuat atau dicocokkan otomatis oleh engine.",
  };
}

