"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterBumdesState = {
  success: boolean;
  message: string;
  registrationId?: string;
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function submitBumdesRegistration(
  _prevState: RegisterBumdesState,
  formData: FormData
): Promise<RegisterBumdesState> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const requesterEmail = clean(formData.get("requester_email")).toLowerCase();
  const requesterName = clean(formData.get("requester_name"));
  const requesterPhone = clean(formData.get("requester_phone"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!requesterEmail) {
    return {
      success: false,
      message: "Email pemohon wajib diisi karena akan digunakan untuk login direktur.",
    };
  }

  if (!requesterName) {
    return {
      success: false,
      message: "Nama pemohon wajib diisi.",
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "Password minimal 8 karakter.",
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      message: "Konfirmasi password tidak sama.",
    };
  }

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: requesterEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: requesterName,
        phone: requesterPhone || null,
        source: "tenant_registration_form",
      },
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message:
        createUserError?.message ||
        "Akun login pemohon gagal dibuat. Pastikan email belum pernah dipakai.",
    };
  }

  const submittedBy = createdUser.user.id;

  const payload = {
    p_nama_bumdes: clean(formData.get("nama_bumdes")),
    p_kode_bumdes: clean(formData.get("kode_bumdes")),
    p_nama_desa: clean(formData.get("nama_desa")),
    p_nama_kecamatan: clean(formData.get("nama_kecamatan")),
    p_alamat: clean(formData.get("alamat")),
    p_nomor_whatsapp: clean(formData.get("nomor_whatsapp")),
    p_email: clean(formData.get("email")),
    p_requester_name: requesterName,
    p_requester_phone: requesterPhone,
    p_requester_email: requesterEmail,
    p_submitted_by: submittedBy,
  };

  const { data, error } = await supabase.rpc(
    "submit_tenant_registration",
    payload
  );

  if (error) {
    await admin.auth.admin.deleteUser(submittedBy);

    return {
      success: false,
      message: error.message || "Pendaftaran BUMDes gagal dikirim.",
    };
  }

  revalidatePath("/register");
  revalidatePath("/platform/dashboard/registrations");

  return {
    success: true,
    message:
      "Pendaftaran BUMDes berhasil dikirim. Setelah disetujui platform, Anda dapat login memakai email dan password yang diisi di form ini.",
    registrationId: data,
  };
}
