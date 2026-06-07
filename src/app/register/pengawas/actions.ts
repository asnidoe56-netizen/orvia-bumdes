"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterPengawasState = {
  success: boolean;
  message: string;
  registrationId?: string;
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function submitPengawasRegistration(
  _prevState: RegisterPengawasState,
  formData: FormData
): Promise<RegisterPengawasState> {
  const admin = createAdminClient();

  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone"));
  const tenantId = clean(formData.get("tenant_id"));
  const notes = clean(formData.get("notes"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!fullName) return { success: false, message: "Nama lengkap Pengawas wajib diisi." };
  if (!email) return { success: false, message: "Email login Pengawas wajib diisi." };
  if (!tenantId) return { success: false, message: "BUMDes yang diawasi wajib dipilih." };
  if (password.length < 8) return { success: false, message: "Password minimal 8 karakter." };
  if (password !== confirmPassword) return { success: false, message: "Konfirmasi password tidak sama." };

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        tenant_id: tenantId,
        role: "pengawas",
        source: "pengawas_registration_form_pending",
      },
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message:
        createUserError?.message ||
        "Akun login Pengawas gagal dibuat. Pastikan email belum pernah dipakai.",
    };
  }

  const userId = createdUser.user.id;

  const { data, error } = await admin.rpc("submit_pengawas_registration", {
    p_full_name: fullName,
    p_email: email,
    p_phone: phone || null,
    p_tenant_id: tenantId,
    p_notes: notes || null,
    p_submitted_by: userId,
  });

  if (error) {
    await admin.auth.admin.deleteUser(userId);

    return {
      success: false,
      message: error.message || "Pendaftaran Pengawas gagal dikirim.",
    };
  }

  revalidatePath("/register/pengawas");
  revalidatePath("/platform/dashboard/pengawas-registrations");

  return {
    success: true,
    message:
      "Pendaftaran Pengawas berhasil dikirim. Setelah disetujui Platform, akun dapat login sebagai Pengawas BUMDes.",
    registrationId: data,
  };
}
