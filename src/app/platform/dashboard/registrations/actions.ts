"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";

export async function approveTenantRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi tidak ditemukan.");
  }

  const supabase = await createClient();

  const { data: tenantId, error: approveError } = await supabase.rpc(
    "approve_tenant_registration",
    {
      p_registration_id: registrationId,
    }
  );

  if (approveError) {
    throw new Error(
      approveError.message || "Gagal menyetujui registrasi BUMDes."
    );
  }

  const admin = createAdminClient();

  const { data: registration, error: registrationError } = await admin
    .from("tenant_registrations")
    .select(
      "id, nama_bumdes, kode_bumdes, requester_name, requester_email, email"
    )
    .eq("id", registrationId)
    .single();

  if (registrationError || !registration) {
    throw new Error("Registrasi disetujui, tetapi data registrasi gagal dibaca.");
  }

  const loginEmail = registration.requester_email || registration.email;

  if (!loginEmail) {
    throw new Error(
      "Registrasi disetujui, tetapi email login direktur belum tersedia."
    );
  }

  const temporaryPassword = generateTemporaryPassword();

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: loginEmail,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: registration.requester_name,
        tenant_id: tenantId,
        role: "direktur_bumdes",
        source: "tenant_registration_approval",
      },
    });

  if (createUserError || !createdUser.user) {
    throw new Error(
      createUserError?.message ||
        "Tenant sudah dibuat, tetapi akun login direktur gagal dibuat."
    );
  }

  await admin
    .from("profiles")
    .update({
      full_name: registration.requester_name,
      default_tenant_id: tenantId,
    })
    .eq("id", createdUser.user.id);

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: createdUser.user.id,
    role: "direktur_bumdes",
    tenant_id: tenantId,
    unit_id: null,
  });

  if (roleError) {
    throw new Error(
      roleError.message || "Akun dibuat, tetapi role direktur gagal disimpan."
    );
  }

  console.log("AKSES DIREKTUR BUMDES BARU", {
    bumdes: registration.nama_bumdes,
    email: loginEmail,
    temporaryPassword,
    tenantId,
  });

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/registrations");
}

export async function rejectTenantRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const rejectionReason = String(formData.get("rejection_reason") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi tidak ditemukan.");
  }

  if (!rejectionReason.trim()) {
    throw new Error("Alasan penolakan wajib diisi.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_tenant_registration", {
    p_registration_id: registrationId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    throw new Error(error.message || "Gagal menolak registrasi BUMDes.");
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/registrations");
}
