"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function approvePengawasRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi Pengawas tidak ditemukan.");
  }

  const admin = createAdminClient();

  const { error } = await admin.rpc("approve_pengawas_registration", {
    p_registration_id: registrationId,
  });

  if (error) {
    throw new Error(error.message || "Registrasi Pengawas gagal disetujui.");
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

  const { error } = await admin.rpc("reject_pengawas_registration", {
    p_registration_id: registrationId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    throw new Error(error.message || "Gagal menolak registrasi Pengawas.");
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/pengawas-registrations");
}
