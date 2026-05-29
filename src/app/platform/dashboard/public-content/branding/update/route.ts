import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

function getSafeFileName(fileName: string) {
  return fileName
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

function redirectToBranding(request: Request, searchParams?: Record<string, string>) {
  const url = new URL("/platform/dashboard/public-content/branding", request.url);

  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const supabase = await createClient();

    const brandName = getString(formData, "brand_name");
    const brandSubtitle = getString(formData, "brand_subtitle");
    const productName = getString(formData, "product_name");
    const primaryCtaLabel = getString(formData, "primary_cta_label");
    const primaryCtaHref = getString(formData, "primary_cta_href");
    const secondaryCtaLabel = getString(formData, "secondary_cta_label");
    const secondaryCtaHref = getString(formData, "secondary_cta_href");

    if (!brandName) {
      return redirectToBranding(request, {
        error: "Nama brand wajib diisi.",
      });
    }

    if (!brandSubtitle) {
      return redirectToBranding(request, {
        error: "Subjudul brand wajib diisi.",
      });
    }

    if (!productName) {
      return redirectToBranding(request, {
        error: "Nama produk wajib diisi.",
      });
    }

    if (!primaryCtaLabel || !primaryCtaHref) {
      return redirectToBranding(request, {
        error: "Tombol utama wajib memiliki label dan link.",
      });
    }

    if (!secondaryCtaLabel || !secondaryCtaHref) {
      return redirectToBranding(request, {
        error: "Tombol sekunder wajib memiliki label dan link.",
      });
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
        return redirectToBranding(request, {
          error: "Format logo harus JPG, PNG, WEBP, GIF, atau SVG.",
        });
      }

      if (logoFile.size > 2 * 1024 * 1024) {
        return redirectToBranding(request, {
          error: "Ukuran logo maksimal 2MB.",
        });
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
        return redirectToBranding(request, {
          error: `Upload logo gagal: ${uploadError.message}`,
        });
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
      return redirectToBranding(request, {
        error: error.message || "Gagal menyimpan pengaturan branding publik.",
      });
    }

    revalidatePath("/");
    revalidatePath("/aplikasi");
    revalidatePath("/manajemen");
    revalidatePath("/tentang");
    revalidatePath("/platform/dashboard/public-content");
    revalidatePath("/platform/dashboard/public-content/branding");

    return redirectToBranding(request, {
      success: "Branding publik berhasil disimpan.",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Terjadi kesalahan saat menyimpan branding.";

    return redirectToBranding(request, {
      error: message,
    });
  }
}
