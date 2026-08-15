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

const PHOTO_BUCKET = "bumdes-public";
const PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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

function getSafeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function storagePathFromPublicUrl(photoUrl: string | null) {
  if (!photoUrl) {
    return null;
  }

  const marker = `/storage/v1/object/public/${PHOTO_BUCKET}/`;
  const markerIndex = photoUrl.indexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  return decodeURIComponent(photoUrl.slice(markerIndex + marker.length));
}

/**
 * Hapus berkas lama supaya bucket tidak menumpuk foto yang sudah diganti.
 * Jalur wajib berada di folder tenant ini — `photo_url` lama dikirim dari form,
 * jadi tanpa penjagaan ini sebuah tenant bisa menghapus foto tenant lain.
 */
async function removeMemberPhoto(
  supabase: ServerSupabaseClient,
  tenantId: string,
  photoUrl: string | null,
) {
  const path = storagePathFromPublicUrl(photoUrl);

  if (!path || !path.startsWith(`pengurus/${tenantId}/`)) {
    return;
  }

  await supabase.storage.from(PHOTO_BUCKET).remove([path]);
}

/**
 * Menentukan foto final dari form: berkas baru yang diunggah, permintaan hapus,
 * atau foto lama yang dibiarkan apa adanya. `replacedUrl` adalah foto lama yang
 * sudah tidak dipakai lagi, baru boleh dihapus setelah database tersimpan.
 */
async function resolveMemberPhotoUrl(
  supabase: ServerSupabaseClient,
  tenantId: string,
  formData: FormData,
) {
  const currentUrl = cleanText(formData.get("photo_url"));
  const shouldClear = formData.get("clear_photo") === "on";
  const photoFile = formData.get("photo_file");
  const hasUpload = photoFile instanceof File && photoFile.size > 0;

  if (!hasUpload) {
    return {
      photoUrl: shouldClear ? null : currentUrl,
      replacedUrl: shouldClear ? currentUrl : null,
    };
  }

  if (!PHOTO_ALLOWED_TYPES.includes(photoFile.type)) {
    throw new Error("Format foto harus JPG, PNG, atau WEBP.");
  }

  if (photoFile.size > PHOTO_MAX_BYTES) {
    throw new Error("Ukuran foto maksimal 4MB.");
  }

  const uploadPath = `pengurus/${tenantId}/${Date.now()}-${getSafeFileName(photoFile.name)}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(uploadPath, photoFile, {
      cacheControl: "3600",
      contentType: photoFile.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Upload foto gagal: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(PHOTO_BUCKET)
    .getPublicUrl(uploadPath);

  return {
    photoUrl: publicUrlData.publicUrl,
    replacedUrl: currentUrl,
  };
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
  const { photoUrl } = await resolveMemberPhotoUrl(
    supabase,
    context.tenant_id,
    formData,
  );
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
    // Barisnya gagal dibuat, jadi foto yang terlanjur naik tidak punya pemilik.
    await removeMemberPhoto(supabase, context.tenant_id, photoUrl);
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
  const { photoUrl, replacedUrl } = await resolveMemberPhotoUrl(
    supabase,
    context.tenant_id,
    formData,
  );
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
    if (photoUrl !== replacedUrl) {
      await removeMemberPhoto(supabase, context.tenant_id, photoUrl);
    }

    throw new Error(error.message);
  }

  if (replacedUrl && replacedUrl !== photoUrl) {
    await removeMemberPhoto(supabase, context.tenant_id, replacedUrl);
  }

  await revalidatePengaturanAndPublicPage(context.tenant_id);
}


