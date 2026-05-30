"use server";

import { revalidatePath } from "next/cache";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

export type SavingsLoanMemberActionState = {
  success: boolean;
  message: string;
};

export async function createSavingsLoanMember(
  _prevState: SavingsLoanMemberActionState,
  formData: FormData,
): Promise<SavingsLoanMemberActionState> {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return {
      success: false,
      message: "Konteks tenant/unit tidak ditemukan. Silakan login ulang.",
    };
  }

  const memberNo = String(formData.get("member_no") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const identityNumber = String(formData.get("identity_number") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const joinDate = String(formData.get("join_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!memberNo || !fullName || !joinDate) {
    return {
      success: false,
      message: "Nomor anggota, nama lengkap, dan tanggal bergabung wajib diisi.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_savings_loan_member", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_member_no: memberNo,
    p_full_name: fullName,
    p_identity_number: identityNumber || null,
    p_phone: phone || null,
    p_address: address || null,
    p_join_date: joinDate,
    p_notes: notes || null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Anggota gagal disimpan.",
    };
  }

  revalidatePath("/unit/dashboard/simpan-pinjam/anggota");

  return {
    success: true,
    message: "Anggota berhasil disimpan.",
  };
}
