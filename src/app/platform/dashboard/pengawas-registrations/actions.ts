"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approvePengawasRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi Pengawas tidak ditemukan.");
  }

  const admin = createAdminClient();

  const { data: registration, error: readError } = await admin
    .from("pengawas_registrations")
    .select("id, full_name, email, phone, tenant_id, submitted_by, status")
    .eq("id", registrationId)
    .maybeSingle();

  if (readError || !registration) {
    throw new Error(readError?.message || "Registrasi Pengawas tidak ditemukan.");
  }

  if (registration.status !== "pending") {
    throw new Error("Registrasi Pengawas sudah diproses.");
  }

  if (!registration.submitted_by) {
    throw new Error("Akun login Pengawas belum tersedia.");
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: registration.submitted_by,
    full_name: registration.full_name,
    phone: registration.phone || null,
    default_tenant_id: registration.tenant_id,
  });

  if (profileError) {
    throw new Error(profileError.message || "Profil Pengawas gagal dibuat.");
  }

  const { data: existingRole } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", registration.submitted_by)
    .eq("role", "pengawas")
    .eq("tenant_id", registration.tenant_id)
    .is("unit_id", null)
    .maybeSingle();

  if (!existingRole?.id) {
    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: registration.submitted_by,
      role: "pengawas",
      tenant_id: registration.tenant_id,
      unit_id: null,
    });

    if (roleError) {
      throw new Error(roleError.message || "Role Pengawas gagal dibuat.");
    }
  }

  const { error: updateError } = await admin
    .from("pengawas_registrations")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId);

  if (updateError) {
    throw new Error(updateError.message || "Registrasi Pengawas gagal disetujui.");
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/pengawas-registrations");
}

export async function rejectPengawasRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();

  if (!registrationId) {
    throw new Error("ID registrasi Pengawas tidak ditemukan.");
  }

  if (!rejectionReason) {
    throw new Error("Alasan penolakan wajib diisi.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("pengawas_registrations")
    .update({
      status: "rejected",
      rejection_reason: rejectionReason,
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", registrationId)
    .eq("status", "pending");

  if (error) {
    throw new Error(error.message || "Gagal menolak registrasi Pengawas.");
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/pengawas-registrations");
}
