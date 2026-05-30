"use server";

import { revalidatePath } from "next/cache";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

export type GroupActionState = {
  success: boolean;
  message: string;
};

export async function createSavingsLoanGroup(
  _prevState: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return {
      success: false,
      message: "Konteks tenant/unit tidak ditemukan. Silakan login ulang.",
    };
  }

  const groupNo = String(formData.get("group_no") ?? "").trim();
  const groupName = String(formData.get("group_name") ?? "").trim();
  const leaderMemberId = String(formData.get("leader_member_id") ?? "").trim();
  const formationDate = String(formData.get("formation_date") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!groupNo || !groupName || !leaderMemberId || !formationDate) {
    return {
      success: false,
      message: "Nomor kelompok, nama kelompok, ketua, dan tanggal pembentukan wajib diisi.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_savings_loan_group", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_group_no: groupNo,
    p_group_name: groupName,
    p_leader_member_id: leaderMemberId,
    p_formation_date: formationDate,
    p_address: address || null,
    p_notes: notes || null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Kelompok gagal disimpan.",
    };
  }

  revalidatePath("/unit/dashboard/simpan-pinjam/kelompok");

  return {
    success: true,
    message: "Kelompok berhasil disimpan.",
  };
}

export async function addSavingsLoanGroupMember(
  _prevState: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const groupId = String(formData.get("group_id") ?? "").trim();
  const memberId = String(formData.get("member_id") ?? "").trim();
  const roleInGroup = String(formData.get("role_in_group") ?? "member").trim();
  const joinedAt = String(formData.get("joined_at") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!groupId || !memberId || !roleInGroup || !joinedAt) {
    return {
      success: false,
      message: "Kelompok, anggota, peran, dan tanggal bergabung wajib diisi.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("add_savings_loan_group_member", {
    p_group_id: groupId,
    p_member_id: memberId,
    p_role_in_group: roleInGroup,
    p_joined_at: joinedAt,
    p_notes: notes || null,
  });

  if (error) {
    return {
      success: false,
      message: error.message || "Anggota kelompok gagal ditambahkan.",
    };
  }

  revalidatePath("/unit/dashboard/simpan-pinjam/kelompok");

  return {
    success: true,
    message: "Anggota kelompok berhasil ditambahkan.",
  };
}
