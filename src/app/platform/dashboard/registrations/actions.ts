"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const registrationsPath = "/platform/dashboard/registrations";

function redirectWithError(message: string) {
  redirect(`${registrationsPath}?error=${encodeURIComponent(message)}`);
}

export async function approveTenantRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    redirectWithError("ID registrasi tidak ditemukan.");
  }

  const supabase = await createClient();

  const { error: approveError } = await supabase.rpc(
    "approve_tenant_registration",
    {
      p_registration_id: registrationId,
    }
  );

  if (approveError) {
    console.error("approve_tenant_registration error:", approveError);
    redirectWithError(
      approveError.message || "Gagal menyetujui registrasi BUMDes."
    );
  }

  revalidatePath("/platform/dashboard");
  revalidatePath(registrationsPath);

  redirect(`${registrationsPath}?success=${encodeURIComponent("Registrasi BUMDes berhasil disetujui.")}`);
}

export async function rejectTenantRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const rejectionReason = String(formData.get("rejection_reason") ?? "");

  if (!registrationId) {
    redirectWithError("ID registrasi tidak ditemukan.");
  }

  if (!rejectionReason.trim()) {
    redirectWithError("Alasan penolakan wajib diisi.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("reject_tenant_registration", {
    p_registration_id: registrationId,
    p_rejection_reason: rejectionReason,
  });

  if (error) {
    console.error("reject_tenant_registration error:", error);
    redirectWithError(error.message || "Gagal menolak registrasi BUMDes.");
  }

  revalidatePath("/platform/dashboard");
  revalidatePath(registrationsPath);

  redirect(`${registrationsPath}?success=${encodeURIComponent("Registrasi BUMDes berhasil ditolak.")}`);
}