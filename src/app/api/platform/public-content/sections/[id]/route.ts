import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const formData = await request.formData();

  const title = getString(formData, "title");
  const sectionLabel = getString(formData, "section_label");

  if (!id || !title || !sectionLabel) {
    return NextResponse.json(
      {
        success: false,
        message: "ID section, label section, dan judul wajib diisi.",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  let ctaLabel = getNullableString(formData, "cta_label");
  let ctaHref = getNullableString(formData, "cta_href");

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    ctaLabel = null;
    ctaHref = null;
  }

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
      return NextResponse.json(
        {
          success: false,
          message: "Format gambar harus JPG, PNG, WEBP, GIF, atau SVG.",
        },
        { status: 400 },
      );
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          message: "Ukuran gambar maksimal 5MB.",
        },
        { status: 400 },
      );
    }

    const safeFileName = getSafeFileName(imageFile.name);
    const uploadPath = `sections/${id}/${Date.now()}-${safeFileName}`;

    const { error: uploadError } = await supabase.storage
      .from("public-content")
      .upload(uploadPath, imageFile, {
        cacheControl: "3600",
        contentType: imageFile.type,
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        {
          success: false,
          message: `Upload gambar gagal: ${uploadError.message}`,
        },
        { status: 400 },
      );
    }

    const { data: publicUrlData } = supabase.storage
      .from("public-content")
      .getPublicUrl(uploadPath);

    finalImageUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase
    .from("public_content_sections")
    .update({
      section_label: sectionLabel,
      eyebrow: getNullableString(formData, "eyebrow"),
      title,
      subtitle: getNullableString(formData, "subtitle"),
      body: getNullableString(formData, "body"),
      cta_label: ctaLabel,
      cta_href: ctaHref,
      image_url: finalImageUrl,
      display_order: getInteger(formData, "display_order"),
      is_published: getBoolean(formData, "is_published"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Gagal menyimpan section publik.",
      },
      { status: 400 },
    );
  }

  revalidatePath("/");
  revalidatePath("/aplikasi");
  revalidatePath("/manajemen");
  revalidatePath("/tentang");
  revalidatePath("/platform/dashboard/public-content");
  revalidatePath(`/platform/dashboard/public-content/sections/${id}/edit`);

  const redirectUrl = new URL("/platform/dashboard/public-content", request.url);
  return NextResponse.redirect(redirectUrl, 303);
}
