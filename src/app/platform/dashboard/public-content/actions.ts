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






