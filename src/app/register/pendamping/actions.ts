"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type RegisterPendampingState = {
  success: boolean;
  message: string;
  registrationId?: string;
};

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function submitPendampingRegistration(
  _prevState: RegisterPendampingState,
  formData: FormData
): Promise<RegisterPendampingState> {
  const supabase = await createClient();
  const admin = createAdminClient();

  const fullName = clean(formData.get("full_name"));
  const email = clean(formData.get("email")).toLowerCase();
  const phone = clean(formData.get("phone"));
  const namaKecamatan = clean(formData.get("nama_kecamatan")).toUpperCase();
  const instansi = clean(formData.get("instansi"));
  const notes = clean(formData.get("notes"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!fullName) {
    return {
      success: false,
      message: "Nama lengkap pendamping wajib diisi.",
    };
  }

  if (!email) {
    return {
      success: false,
      message: "Email login pendamping wajib diisi.",
    };
  }

  if (!namaKecamatan) {
    return {
      success: false,
      message: "Kecamatan tugas pendamping wajib diisi.",
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
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || null,
        nama_kecamatan: namaKecamatan,
        instansi: instansi || null,
        source: "pendamping_registration_form",
      },
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message:
        createUserError?.message ||
        "Akun login Pendamping gagal dibuat. Pastikan email belum pernah dipakai.",
    };
  }

  const submittedBy = createdUser.user.id;

  const { data, error } = await supabase.rpc(
    "submit_pendamping_registration",
    {
      p_full_name: fullName,
      p_email: email,
      p_phone: phone,
      p_nama_kecamatan: namaKecamatan,
      p_instansi: instansi,
      p_notes: notes,
      p_submitted_by: submittedBy,
    }
  );

  if (error) {
    await admin.auth.admin.deleteUser(submittedBy);

    return {
      success: false,
      message: error.message || "Pendaftaran Pendamping gagal dikirim.",
    };
  }

  revalidatePath("/register/pendamping");
  revalidatePath("/platform/dashboard/pendamping-registrations");

  return {
    success: true,
    message:
      "Pendaftaran Pendamping Kecamatan berhasil dikirim. Setelah disetujui platform, Anda dapat login memakai email dan password yang diisi di form ini.",
    registrationId: data,
  };
}
