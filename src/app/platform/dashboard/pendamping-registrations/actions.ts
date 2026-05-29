"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approvePendampingRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi pendamping tidak ditemukan.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "approve_pendamping_registration",
    {
      p_registration_id: registrationId,
    }
  );

  if (error) {
    throw new Error(
      error.message || "Gagal menyetujui registrasi Pendamping Kecamatan."
    );
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/pendamping-registrations");
}

export async function rejectPendampingRegistration(formData: FormData) {
  const registrationId = String(formData.get("registration_id") ?? "");
  const rejectionReason = String(formData.get("rejection_reason") ?? "");

  if (!registrationId) {
    throw new Error("ID registrasi pendamping tidak ditemukan.");
  }

  if (!rejectionReason.trim()) {
    throw new Error("Alasan penolakan wajib diisi.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc(
    "reject_pendamping_registration",
    {
      p_registration_id: registrationId,
      p_rejection_reason: rejectionReason,
    }
  );

  if (error) {
    throw new Error(
      error.message || "Gagal menolak registrasi Pendamping Kecamatan."
    );
  }

  revalidatePath("/platform/dashboard");
  revalidatePath("/platform/dashboard/pendamping-registrations");
}
