"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function publishTenantPublicProfile(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");

  if (!tenantId) {
    throw new Error("Tenant tidak valid.");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User belum login.");
  }

  const { error: provisionError } = await supabase.rpc(
    "provision_tenant_public_profile",
    {
      p_tenant_id: tenantId,
      p_actor_id: user.id,
    },
  );

  if (provisionError) {
    throw new Error(provisionError.message);
  }

  const { error: profileError } = await supabase
    .from("tenant_public_profiles")
    .update({
      is_published: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: ppidError } = await supabase
    .from("tenant_public_ppid")
    .update({
      is_published: true,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (ppidError) {
    throw new Error(ppidError.message);
  }

  revalidatePath("/platform/dashboard/bumdes");
}

export async function unpublishTenantPublicProfile(formData: FormData) {
  const tenantId = String(formData.get("tenant_id") ?? "");

  if (!tenantId) {
    throw new Error("Tenant tidak valid.");
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("User belum login.");
  }

  const { error: profileError } = await supabase
    .from("tenant_public_profiles")
    .update({
      is_published: false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: ppidError } = await supabase
    .from("tenant_public_ppid")
    .update({
      is_published: false,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  if (ppidError) {
    throw new Error(ppidError.message);
  }

  revalidatePath("/platform/dashboard/bumdes");
}

const PLATFORM_BUMDES_PATH = "/platform/dashboard/bumdes";

function redirectWithMessage(type: "success" | "error", message: string): never {
  redirect(`${PLATFORM_BUMDES_PATH}?${type}=${encodeURIComponent(message)}`);
}

function getRequiredString(formData: FormData, key: string, label: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${label} wajib diisi.`);
  }

  return value;
}

export async function suspendTenant(formData: FormData) {
  let tenantId = "";
  let reason = "";

  try {
    tenantId = getRequiredString(formData, "tenant_id", "Tenant");
    reason = getRequiredString(formData, "reason", "Alasan suspend");
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "Input suspend tenant tidak valid.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_tenant_lifecycle_status", {
    p_tenant_id: tenantId,
    p_status: "suspended",
    p_reason: reason,
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(PLATFORM_BUMDES_PATH);
  redirectWithMessage("success", "Tenant berhasil disuspend.");
}

export async function activateTenant(formData: FormData) {
  let tenantId = "";
  let reason = "";

  try {
    tenantId = getRequiredString(formData, "tenant_id", "Tenant");
    reason = getRequiredString(formData, "reason", "Alasan aktivasi");
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "Input aktivasi tenant tidak valid.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("set_tenant_lifecycle_status", {
    p_tenant_id: tenantId,
    p_status: "active",
    p_reason: reason,
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(PLATFORM_BUMDES_PATH);
  redirectWithMessage("success", "Tenant berhasil diaktifkan.");
}

export async function deleteTenantWithAudit(formData: FormData) {
  let tenantId = "";
  let confirmationText = "";
  let reason = "";

  try {
    tenantId = getRequiredString(formData, "tenant_id", "Tenant");
    confirmationText = getRequiredString(formData, "confirmation_text", "Kode konfirmasi");
    reason = getRequiredString(formData, "reason", "Alasan hapus tenant");
  } catch (error) {
    redirectWithMessage(
      "error",
      error instanceof Error ? error.message : "Input hapus tenant tidak valid.",
    );
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_tenant_with_audit", {
    p_tenant_id: tenantId,
    p_confirmation_text: confirmationText,
    p_reason: reason,
  });

  if (error) {
    redirectWithMessage("error", error.message);
  }

  revalidatePath(PLATFORM_BUMDES_PATH);
  redirectWithMessage("success", "Tenant berhasil dihapus dengan backup audit.");
}
