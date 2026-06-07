"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

const ALLOWED_ROLE_GROUPS = new Set([
  "penasihat",
  "pengawas",
  "pengurus",
  "pelaksana_operasional",
]);

function cleanText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function requiredText(value: FormDataEntryValue | null, fieldName: string) {
  const text = cleanText(value);

  if (!text) {
    throw new Error(`${fieldName} wajib diisi.`);
  }

  return text;
}

function cleanInteger(value: FormDataEntryValue | null, fallback = 100) {
  const numberValue = Number(value ?? fallback);

  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.trunc(numberValue);
}

function cleanRoleGroup(value: FormDataEntryValue | null) {
  const roleGroup = String(value ?? "pengurus").trim().toLowerCase();

  if (!ALLOWED_ROLE_GROUPS.has(roleGroup)) {
    return "pengurus";
  }

  return roleGroup;
}

async function revalidatePengaturanAndPublicPage(tenantId: string) {
  const supabase = await createClient();

  const { data: publicProfile } = await supabase
    .from("tenant_public_profiles")
    .select("public_slug")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  revalidatePath("/bumdes/dashboard/pengaturan");

  if (publicProfile?.public_slug) {
    revalidatePath(`/bumdes/${publicProfile.public_slug}`);
  }
}


export async function updatePublicProfileSettingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks BUMDes tidak ditemukan.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublished = formData.get("is_published") === "on";

  const { error } = await supabase
    .from("tenant_public_profiles")
    .update({
      is_published: isPublished,
      hero_title: cleanText(formData.get("hero_title")),
      hero_subtitle: cleanText(formData.get("hero_subtitle")),
      tagline: cleanText(formData.get("tagline")),
      profile_description: cleanText(formData.get("profile_description")),
      contact_phone: cleanText(formData.get("contact_phone")),
      contact_email: cleanText(formData.get("contact_email")),
      contact_address: cleanText(formData.get("contact_address")),
      about_history: cleanText(formData.get("about_history")),
      vision: cleanText(formData.get("vision")),
      mission: cleanText(formData.get("mission")),
      service_goals: cleanText(formData.get("service_goals")),
      updated_by: user?.id ?? null,
    })
    .eq("tenant_id", context.tenant_id);

  if (error) {
    throw new Error(error.message);
  }

  await revalidatePengaturanAndPublicPage(context.tenant_id);
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

  await revalidatePengaturanAndPublicPage(context.tenant_id);
}

export async function createPublicMemberSettingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks BUMDes tidak ditemukan.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = requiredText(formData.get("name"), "Nama pengurus");
  const position = requiredText(formData.get("position"), "Jabatan");
  const roleGroup = cleanRoleGroup(formData.get("role_group"));
  const photoUrl = cleanText(formData.get("photo_url"));
  const displayOrder = cleanInteger(formData.get("display_order"), 100);
  const isPublished = formData.get("is_published") === "on";

  const { error } = await supabase
    .from("tenant_public_organizational_members")
    .insert({
      tenant_id: context.tenant_id,
      name,
      position,
      role_group: roleGroup,
      photo_url: photoUrl,
      display_order: displayOrder,
      is_published: isPublished,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    });

  if (error) {
    throw new Error(error.message);
  }

  await revalidatePengaturanAndPublicPage(context.tenant_id);
}

export async function updatePublicMemberSettingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Konteks BUMDes tidak ditemukan.");
  }

  const memberId = cleanText(formData.get("member_id"));

  if (!memberId) {
    throw new Error("Data pengurus tidak ditemukan.");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = requiredText(formData.get("name"), "Nama pengurus");
  const position = requiredText(formData.get("position"), "Jabatan");
  const roleGroup = cleanRoleGroup(formData.get("role_group"));
  const photoUrl = cleanText(formData.get("photo_url"));
  const displayOrder = cleanInteger(formData.get("display_order"), 100);
  const isPublished = formData.get("is_published") === "on";

  const { error } = await supabase
    .from("tenant_public_organizational_members")
    .update({
      name,
      position,
      role_group: roleGroup,
      photo_url: photoUrl,
      display_order: displayOrder,
      is_published: isPublished,
      updated_by: user?.id ?? null,
    })
    .eq("id", memberId)
    .eq("tenant_id", context.tenant_id);

  if (error) {
    throw new Error(error.message);
  }

  await revalidatePengaturanAndPublicPage(context.tenant_id);
}


