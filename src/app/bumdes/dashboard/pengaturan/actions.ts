"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function cleanInteger(value: FormDataEntryValue | null, fallback = 100) {
  const numberValue = Number(value ?? fallback);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.trunc(numberValue);
}

export async function updatePublicUnitSettingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks BUMDes tidak ditemukan.");
  }

  const unitId = cleanText(formData.get("unit_id"));

  if (!unitId) {
    throw new Error("Unit usaha tidak ditemukan.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: unit, error: unitError } = await supabase
    .from("business_units")
    .select("id, tenant_id, status")
    .eq("id", unitId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (unitError) {
    throw new Error(unitError.message);
  }

  if (!unit) {
    throw new Error("Unit usaha tidak valid untuk BUMDes ini.");
  }

  if (unit.status !== "aktif") {
    throw new Error("Hanya unit aktif yang dapat ditampilkan pada halaman publik.");
  }

  const isPublished = formData.get("is_published") === "on";
  const publicDescription = cleanText(formData.get("public_description"));
  const displayOrder = cleanInteger(formData.get("display_order"), 100);

  const { error } = await supabase.from("tenant_public_units").upsert(
    {
      tenant_id: context.tenant_id,
      unit_id: unitId,
      public_description: publicDescription,
      display_order: displayOrder,
      is_published: isPublished,
      updated_by: user?.id ?? null,
    },
    {
      onConflict: "tenant_id,unit_id",
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  const { data: publicProfile } = await supabase
    .from("tenant_public_profiles")
    .select("public_slug")
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  revalidatePath("/bumdes/dashboard/pengaturan");

  if (publicProfile?.public_slug) {
    revalidatePath(`/bumdes/${publicProfile.public_slug}`);
  }
}

