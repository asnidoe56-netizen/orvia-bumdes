"use server";

import { revalidatePath } from "next/cache";
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