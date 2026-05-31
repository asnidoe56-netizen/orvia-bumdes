"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type PublicLoanApplicationActionState = {
  success: boolean;
  message: string;
  applicationNo?: string;
};

function toNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").replace(/\./g, "").replace(/,/g, ".").trim();
  const numberValue = Number(raw);

  return Number.isFinite(numberValue) ? numberValue : 0;
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
      const phone = String(
        formData.get(`group_member_${index}_phone`) ?? "",
      ).trim();
      const address = String(
        formData.get(`group_member_${index}_address`) ?? "",
      ).trim();
      const roleInGroup = String(
        formData.get(`group_member_${index}_role_in_group`) ?? "member",
      ).trim();
      const notes = String(
        formData.get(`group_member_${index}_notes`) ?? "",
      ).trim();

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

export async function submitPublicLoanApplication(
  _prevState: PublicLoanApplicationActionState,
  formData: FormData,
): Promise<PublicLoanApplicationActionState> {
  const supabase = await createClient();

  const slug = String(formData.get("public_slug") ?? "").trim();
  const token = String(formData.get("public_token") ?? "").trim();
  const method = String(formData.get("application_method") ?? "individual").trim();
  const declarationAccepted = formData.get("declaration_accepted") === "on";

  const applicationDate = String(formData.get("application_date") ?? "").trim();
  const requestedAmount = toNumber(formData.get("requested_amount"));
  const tenorMonths = toNumber(formData.get("tenor_months"));
  const repaymentCapacity = toNumber(
    formData.get("estimated_repayment_capacity"),
  );

  const supportingDocumentUrl = String(
    formData.get("supporting_document_url") ?? "",
  ).trim();
  const supportingDocumentName = String(
    formData.get("supporting_document_name") ?? "",
  ).trim();

  if (!slug || !token) {
    return {
      success: false,
      message: "Link pengajuan publik tidak valid.",
    };
  }

  if (!["individual", "group"].includes(method)) {
    return {
      success: false,
      message: "Metode pengajuan tidak valid.",
    };
  }

  if (!applicationDate) {
    return {
      success: false,
      message: "Tanggal pengajuan wajib diisi.",
    };
  }

  if (requestedAmount <= 0) {
    return {
      success: false,
      message: "Nilai pinjaman wajib lebih besar dari nol.",
    };
  }

  if (tenorMonths <= 0) {
    return {
      success: false,
      message: "Tenor pinjaman wajib lebih besar dari nol.",
    };
  }

  if (repaymentCapacity <= 0) {
    return {
      success: false,
      message: "Kemampuan angsur wajib lebih besar dari nol.",
    };
  }

  if (!supportingDocumentUrl) {
    return {
      success: false,
      message:
        "URL Dokumen PDF wajib diisi. Gunakan URL yang berakhir .pdf, contoh: https://example.com/dokumen-pengajuan.pdf.",
    };
  }

  if (
    !supportingDocumentUrl.toLowerCase().endsWith(".pdf") ||
    !supportingDocumentName.toLowerCase().endsWith(".pdf")
  ) {
    return {
      success: false,
      message:
        "Dokumen pendukung wajib berupa PDF. Pastikan URL dan nama dokumen sama-sama berakhir .pdf.",
    };
  }

  if (!declarationAccepted) {
    return {
      success: false,
      message: "Pernyataan kebenaran data wajib disetujui.",
    };
  }

  const groupMembers = parseGroupMembers(formData);

  if (method === "group" && groupMembers.length < 2) {
    return {
      success: false,
      message: "Pengajuan kelompok minimal berisi ketua dan satu anggota.",
    };
  }

  const { data, error } = await supabase.rpc(
    "submit_public_savings_loan_application",
    {
      p_public_slug: slug,
      p_public_token: token,
      p_application_method: method,
      p_application_date: applicationDate,
      p_applicant_full_name:
        String(formData.get("applicant_full_name") ?? "").trim() || null,
      p_applicant_identity_number:
        String(formData.get("applicant_identity_number") ?? "").trim() || null,
      p_applicant_phone:
        String(formData.get("applicant_phone") ?? "").trim() || null,
      p_applicant_address:
        String(formData.get("applicant_address") ?? "").trim() || null,
      p_group_name: String(formData.get("group_name") ?? "").trim() || null,
      p_group_address:
        String(formData.get("group_address") ?? "").trim() || null,
      p_group_members: groupMembers,
      p_requested_amount: requestedAmount,
      p_tenor_months: tenorMonths,
      p_loan_purpose: String(formData.get("loan_purpose") ?? "").trim(),
      p_income_source: String(formData.get("income_source") ?? "").trim(),
      p_estimated_repayment_capacity: repaymentCapacity,
      p_business_or_job_type: String(
        formData.get("business_or_job_type") ?? "",
      ).trim(),
      p_notes: String(formData.get("notes") ?? "").trim() || null,
      p_supporting_document_url: supportingDocumentUrl,
      p_supporting_document_name: supportingDocumentName,
      p_supporting_document_mime_type: "application/pdf",
      p_declaration_accepted: declarationAccepted,
      p_submitted_user_agent: "public web form",
      p_submitted_referrer: null,
    },
  );

  if (error) {
    return {
      success: false,
      message: error.message,
    };
  }

  const result = Array.isArray(data) ? data[0] : null;

  revalidatePath(`/ajukan-pinjaman/${slug}/${token}`);

  return {
    success: true,
    message:
      result?.message ??
      "Pengajuan berhasil dikirim dan menunggu verifikasi petugas.",
    applicationNo: result?.application_no,
  };
}
