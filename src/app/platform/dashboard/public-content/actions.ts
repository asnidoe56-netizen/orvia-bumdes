"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function getInteger(formData: FormData, key: string) {
  const rawValue = getString(formData, key);
  const parsed = Number.parseInt(rawValue, 10);

  if (Number.isNaN(parsed)) {
    return 0;
  }

  return parsed;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getSafeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export async function updatePublicContentSection(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("ID section tidak ditemukan.");
  }

  const title = getString(formData, "title");

  if (!title) {
    throw new Error("Judul section wajib diisi.");
  }

  let ctaLabel = getNullableString(formData, "cta_label");
  let ctaHref = getNullableString(formData, "cta_href");

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    ctaLabel = null;
    ctaHref = null;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("public_content_sections")
    .update({
      section_label: getString(formData, "section_label"),
      eyebrow: getNullableString(formData, "eyebrow"),
      title,
      subtitle: getNullableString(formData, "subtitle"),
      body: getNullableString(formData, "body"),
      cta_label: ctaLabel,
      cta_href: ctaHref,
      image_url: getNullableString(formData, "image_url"),
      display_order: getInteger(formData, "display_order"),
      is_published: getBoolean(formData, "is_published"),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan section publik.");
  }

  revalidatePath("/");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath(`/platform/dashboard/public-content/sections/${id}/edit`);

  redirect("/platform/dashboard/public-content");
}

export async function updatePublicContentItem(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("ID item konten tidak ditemukan.");
  }

  const title = getString(formData, "title");

  if (!title) {
    throw new Error("Judul item konten wajib diisi.");
  }

  let linkLabel = getNullableString(formData, "link_label");
  let linkHref = getNullableString(formData, "link_href");

  if ((linkLabel && !linkHref) || (!linkLabel && linkHref)) {
    linkLabel = null;
    linkHref = null;
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("public_content_items")
    .update({
      item_key: getNullableString(formData, "item_key"),
      title,
      description: getNullableString(formData, "description"),
      icon_key: getNullableString(formData, "icon_key"),
      link_label: linkLabel,
      link_href: linkHref,
      display_order: getInteger(formData, "display_order"),
      is_published: getBoolean(formData, "is_published"),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan item konten publik.");
  }

  revalidatePath("/");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath(`/platform/dashboard/public-content/items/${id}/edit`);

  redirect("/platform/dashboard/public-content");
}

export async function updatePublicNewsPost(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("ID berita tidak ditemukan.");
  }

  const slug = getString(formData, "slug");
  const title = getString(formData, "title");

  if (!slug) {
    throw new Error("Slug berita wajib diisi.");
  }

  if (!title) {
    throw new Error("Judul berita wajib diisi.");
  }

  const publishedAt = getNullableString(formData, "published_at");

  const supabase = await createClient();

  const { error } = await supabase
    .from("public_news_posts")
    .update({
      slug,
      title,
      excerpt: getNullableString(formData, "excerpt"),
      content: getNullableString(formData, "content"),
      cover_image_url: getNullableString(formData, "cover_image_url"),
      author_name: getNullableString(formData, "author_name"),
      published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
      display_order: getInteger(formData, "display_order"),
      is_published: getBoolean(formData, "is_published"),
      link_href: getNullableString(formData, "link_href"),
      popup_enabled: getBoolean(formData, "popup_enabled"),
      popup_delay_seconds: getInteger(formData, "popup_delay_seconds"),
      popup_position: getString(formData, "popup_position") || "top-right",
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan berita publik.");
  }

  revalidatePath("/");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath(`/platform/dashboard/public-content/news/${id}/edit`);

  redirect("/platform/dashboard/public-content");
}
export async function updatePublicSiteSettings(formData: FormData) {
  const supabase = await createClient();

  const brandName = getString(formData, "brand_name");
  const brandSubtitle = getString(formData, "brand_subtitle");
  const productName = getString(formData, "product_name");
  const primaryCtaLabel = getString(formData, "primary_cta_label");
  const primaryCtaHref = getString(formData, "primary_cta_href");
  const secondaryCtaLabel = getString(formData, "secondary_cta_label");
  const secondaryCtaHref = getString(formData, "secondary_cta_href");

  if (!brandName) {
    throw new Error("Nama brand wajib diisi.");
  }

  if (!brandSubtitle) {
    throw new Error("Subjudul brand wajib diisi.");
  }

  if (!productName) {
    throw new Error("Nama produk wajib diisi.");
  }

  if (!primaryCtaLabel || !primaryCtaHref) {
    throw new Error("Tombol utama wajib memiliki label dan link.");
  }

  if (!secondaryCtaLabel || !secondaryCtaHref) {
    throw new Error("Tombol sekunder wajib memiliki label dan link.");
  }

  const logoFile = formData.get("logo_file");
  const shouldClearLogo = formData.get("clear_logo_url") === "1";
  let finalLogoUrl = shouldClearLogo ? null : getNullableString(formData, "logo_url");

  if (!shouldClearLogo && logoFile instanceof File && logoFile.size > 0) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(logoFile.type)) {
      throw new Error("Format logo harus JPG, PNG, WEBP, GIF, atau SVG.");
    }

    if (logoFile.size > 2 * 1024 * 1024) {
      throw new Error("Ukuran logo maksimal 2MB.");
    }

    const safeFileName = getSafeFileName(logoFile.name);
    const uploadPath = `branding/logo-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("public-content")
      .upload(uploadPath, logoFile, {
        cacheControl: "3600",
        contentType: logoFile.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload logo gagal: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("public-content")
      .getPublicUrl(uploadPath);

    finalLogoUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase.from("public_site_settings").upsert(
    {
      setting_key: "default",
      brand_name: brandName,
      brand_subtitle: brandSubtitle,
      product_name: productName,
      product_tagline: getNullableString(formData, "product_tagline"),
      initiator_name: getNullableString(formData, "initiator_name"),
      initiator_label: getNullableString(formData, "initiator_label"),
      logo_url: finalLogoUrl,
      favicon_url: getNullableString(formData, "favicon_url"),
      primary_cta_label: primaryCtaLabel,
      primary_cta_href: primaryCtaHref,
      secondary_cta_label: secondaryCtaLabel,
      secondary_cta_href: secondaryCtaHref,
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "setting_key",
    },
  );

  if (error) {
    throw new Error(error.message || "Gagal menyimpan pengaturan branding publik.");
  }

  revalidatePath("/");
  revalidatePath("/aplikasi");
  revalidatePath("/manajemen");
  revalidatePath("/tentang");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath("/platform/dashboard/public-content/branding");

  redirect("/platform/dashboard/public-content/branding");
}

export async function updatePublicSectionWithImage(formData: FormData) {
  const id = getString(formData, "id");

  if (!id) {
    throw new Error("ID section tidak ditemukan.");
  }

  const title = getString(formData, "title");

  if (!title) {
    throw new Error("Judul section wajib diisi.");
  }

  const supabase = await createClient();

  const imageFile = formData.get("image_file");
  const shouldClearImage = formData.get("clear_image_url") === "1";

  let finalImageUrl = shouldClearImage ? null : getNullableString(formData, "image_url");

  if (!shouldClearImage && imageFile instanceof File && imageFile.size > 0) {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "image/svg+xml",
    ];

    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error("Format gambar harus JPG, PNG, WEBP, GIF, atau SVG.");
    }

    if (imageFile.size > 4 * 1024 * 1024) {
      throw new Error("Ukuran gambar maksimal 4MB.");
    }

    const safeFileName = getSafeFileName(imageFile.name);
    const uploadPath = `sections/section-${id}-${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("public-content")
      .upload(uploadPath, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload gambar section gagal: ${uploadError.message}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from("public-content")
      .getPublicUrl(uploadPath);

    finalImageUrl = publicUrlData.publicUrl;
  }

  let ctaLabel = getNullableString(formData, "cta_label");
  let ctaHref = getNullableString(formData, "cta_href");

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    ctaLabel = null;
    ctaHref = null;
  }

  const { error } = await supabase
    .from("public_content_sections")
    .update({
      section_label: getString(formData, "section_label"),
      eyebrow: getNullableString(formData, "eyebrow"),
      title,
      subtitle: getNullableString(formData, "subtitle"),
      body: getNullableString(formData, "body"),
      cta_label: ctaLabel,
      cta_href: ctaHref,
      image_url: finalImageUrl,
      display_order: getInteger(formData, "display_order"),
      is_published: getBoolean(formData, "is_published"),
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Gagal menyimpan section publik.");
  }

  revalidatePath("/");
  revalidatePath("/aplikasi");
  revalidatePath("/manajemen");
  revalidatePath("/tentang");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath(`/platform/dashboard/public-content/sections/${id}/edit`);

  redirect("/platform/dashboard/public-content");
}
