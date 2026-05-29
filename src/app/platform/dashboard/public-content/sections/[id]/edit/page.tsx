import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ImagePlus, LinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PublicSection = {
  id: string;
  section_key: string;
  section_label: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  image_url: string | null;
  display_order: number;
  is_published: boolean;
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
  const value = Number(getString(formData, key));
  return Number.isFinite(value) ? value : 0;
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

async function updatePublicSectionWithImage(formData: FormData) {
  "use server";

  const supabase = await createClient();

  const id = getString(formData, "id");
  const title = getString(formData, "title");
  const sectionLabel = getString(formData, "section_label");
  const manualImageUrl = getNullableString(formData, "image_url");
  const imageFile = formData.get("image_file");

  if (!id || !title || !sectionLabel) {
    throw new Error("Section, label, dan judul wajib diisi.");
  }

  let ctaLabel = getNullableString(formData, "cta_label");
  let ctaHref = getNullableString(formData, "cta_href");

  if ((ctaLabel && !ctaHref) || (!ctaLabel && ctaHref)) {
    ctaLabel = null;
    ctaHref = null;
  }

  let finalImageUrl = manualImageUrl;

  if (imageFile instanceof File && imageFile.size > 0) {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

    if (!allowedTypes.includes(imageFile.type)) {
      throw new Error("Format gambar harus JPG, PNG, WEBP, atau GIF.");
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      throw new Error("Ukuran gambar maksimal 5MB.");
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
      throw new Error(`Upload gambar gagal: ${uploadError.message}`);
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
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/aplikasi");
  revalidatePath("/platform/dashboard/public-content");
  redirect("/platform/dashboard/public-content");
}

export default async function EditPublicSectionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("public_content_sections")
    .select(
      "id, section_key, section_label, eyebrow, title, subtitle, body, cta_label, cta_href, image_url, display_order, is_published",
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const section = data as PublicSection;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Konten Publik / Edit Section"
        title={`Edit Section: ${section.section_label}`}
        description="Kelola konten landing page publik, termasuk gambar hero atau gambar section."
      />

      <Card>
        <CardHeader
          title="Form Section Landing Page"
          description="Untuk section Beranda/Hero, gambar ini akan tampil sebagai komposisi visual utama halaman publik."
          action={
            section.is_published ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="warning">Draft</Badge>
            )
          }
        />

        <form
          action={updatePublicSectionWithImage}
          className="space-y-5 px-5 pb-5"
        >
          <input type="hidden" name="id" value={section.id} />

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Key Section
              </label>
              <input
                value={section.section_key}
                disabled
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Section
              </label>
              <input
                name="section_label"
                defaultValue={section.section_label}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Urutan
              </label>
              <input
                name="display_order"
                type="number"
                defaultValue={section.display_order}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Eyebrow / Teks Kecil Atas
            </label>
            <input
              name="eyebrow"
              defaultValue={section.eyebrow ?? ""}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Judul Section
            </label>
            <input
              name="title"
              defaultValue={section.title}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              required
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Subtitle
            </label>
            <textarea
              name="subtitle"
              defaultValue={section.subtitle ?? ""}
              rows={3}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Body / Isi Penjelasan
            </label>
            <textarea
              name="body"
              defaultValue={section.body ?? ""}
              rows={5}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
                <ImagePlus className="h-5 w-5" />
              </div>

              <div>
                <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">
                  Gambar Section / Hero
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900">
                  Pilih salah satu: upload file langsung dari komputer atau
                  tempel URL gambar publik. Jika keduanya diisi, upload file
                  akan dipakai sebagai gambar utama.
                </p>
              </div>
            </div>

            {section.image_url ? (
              <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
                <div
                  className="h-56 w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${section.image_url})` }}
                />
                <div className="border-t border-emerald-100 px-4 py-3 text-xs font-semibold text-slate-500">
                  Gambar aktif saat ini
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm font-bold text-slate-700">
                  Upload File Gambar
                </label>
                <input
                  name="image_file"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-emerald-800"
                />
                <p className="mt-2 text-xs leading-5 text-emerald-800">
                  Maksimal 5MB. Format: JPG, PNG, WEBP, atau GIF.
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <LinkIcon className="h-4 w-4 text-emerald-700" />
                  URL Gambar Manual
                </label>
                <input
                  name="image_url"
                  defaultValue={section.image_url ?? ""}
                  placeholder="https://domain.com/gambar-hero.png"
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-2 text-xs leading-5 text-emerald-800">
                  Bisa diisi URL Supabase Storage atau URL gambar publik lain.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Tombol CTA
              </label>
              <input
                name="cta_label"
                defaultValue={section.cta_label ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Link CTA
              </label>
              <input
                name="cta_href"
                defaultValue={section.cta_href ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              name="is_published"
              type="checkbox"
              defaultChecked={section.is_published}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Tampilkan section ini di landing page publik
          </label>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
            <Link
              href="/platform/dashboard/public-content"
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </Link>

            <button
              type="submit"
              className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}