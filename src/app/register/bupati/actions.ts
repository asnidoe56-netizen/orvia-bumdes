"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterBupatiState = {
  success: boolean;
  message: string;
  registrationId?: string;
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function submitBupatiRegistration(
  _prevState: RegisterBupatiState,
  formData: FormData
): Promise<RegisterBupatiState> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone"));
  const jabatan = clean(formData.get("jabatan"));
  const instansi = clean(formData.get("instansi"));
  const wilayahKabupaten = clean(formData.get("wilayah_kabupaten")).toUpperCase();
  const notes = clean(formData.get("notes"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!fullName) {
    return { success: false, message: "Nama lengkap pejabat wajib diisi." };
  }

  if (!email) {
    return { success: false, message: "Email login Bupati wajib diisi." };
  }

  if (!jabatan) {
    return { success: false, message: "Jabatan wajib diisi." };
  }

  if (password.length < 8) {
    return { success: false, message: "Password minimal 8 karakter." };
  }

  if (password !== confirmPassword) {
    return { success: false, message: "Konfirmasi password tidak sama." };
  }

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        jabatan,
        instansi: instansi || null,
        wilayah_kabupaten: wilayahKabupaten || null,
        source: "bupati_registration_form",
      },
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message:
        createUserError?.message ||
        "Akun login Bupati gagal dibuat. Pastikan email belum pernah dipakai.",
    };
  }

  const submittedBy = createdUser.user.id;

  const { data, error } = await supabase.rpc("submit_bupati_registration", {
    p_full_name: fullName,
    p_email: email,
    p_phone: phone,
    p_jabatan: jabatan,
    p_instansi: instansi,
    p_wilayah_kabupaten: wilayahKabupaten,
    p_notes: notes,
    p_submitted_by: submittedBy,
  });

  if (error) {
    await admin.auth.admin.deleteUser(submittedBy);

    return {
      success: false,
      message: error.message || "Pendaftaran Bupati gagal dikirim.",
    };
  }

  revalidatePath("/register/bupati");
  revalidatePath("/platform/dashboard/bupati-registrations");

  return {
    success: true,
    message:
      "Pendaftaran Bupati berhasil dikirim. Setelah disetujui Platform Super Admin, Anda dapat login memakai email dan password yang diisi di form ini.",
    registrationId: data,
  };
}
