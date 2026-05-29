"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveTenantRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi tidak ditemukan.");
  }

  const supabase = await createClient();

  const { error: approveError } = await supabase.rpc(
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
