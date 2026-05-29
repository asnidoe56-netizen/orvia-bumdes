import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Building2, ImagePlus, LinkIcon, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";


type PublicSiteSettingsRow = {
  id: string;
  setting_key: string;
  brand_name: string;
  brand_subtitle: string;
  product_name: string;
  product_tagline: string | null;
  initiator_name: string | null;
  initiator_label: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  primary_cta_label: string;
  primary_cta_href: string;
  secondary_cta_label: string;
  secondary_cta_href: string;
  is_active: boolean;
};

const fallbackSettings: PublicSiteSettingsRow = {
  id: "fallback",
  setting_key: "default",
  brand_name: "ORVIA-BUMDES",
  brand_subtitle: "Core Global Governance Engine",
  product_name: "ORVIA-BUMDES OS 1.0",
  product_tagline: "Sistem operasi tata kelola, akuntansi, dan laporan BUMDes.",
  initiator_name: "Ruang Inovasi Digital Daerah",
  initiator_label: "Sebuah inisiatif dari",
  logo_url: null,
  favicon_url: null,
  primary_cta_label: "Signup",
  primary_cta_href: "/register",
  secondary_cta_label: "Login",
  secondary_cta_href: "/login",
  is_active: true,
};

type PublicBrandingPageProps = {
  searchParams?: Promise<{
    error?: string;
    success?: string;
  }>;
};

export default async function PublicBrandingPage({
  searchParams,
}: PublicBrandingPageProps) {
  const params = await searchParams;
  const errorMessage = params?.error ?? null;
  const successMessage = params?.success ?? null;
  const supabase = await createClient();

  const { data } = await supabase
    .from("v_public_site_settings")
    .select(
      "id, setting_key, brand_name, brand_subtitle, product_name, product_tagline, initiator_name, initiator_label, logo_url, favicon_url, primary_cta_label, primary_cta_href, secondary_cta_label, secondary_cta_href, is_active",
    )
    .eq("setting_key", "default")
    .maybeSingle();

  const settings = (data as PublicSiteSettingsRow | null) ?? fallbackSettings;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Konten Publik / Branding"
        title="Pengaturan Branding Publik"
        description="Kelola logo, nama brand, identitas produk, penggagas, dan tombol utama halaman publik."
      />

      {errorMessage ? (
        <Card className="mb-5 border-red-200 bg-red-50">
          <CardHeader
            title="Branding gagal disimpan"
            description={errorMessage}
            action={<Badge variant="warning">Error</Badge>}
          />
        </Card>
      ) : null}

      {successMessage ? (
        <Card className="mb-5 border-emerald-200 bg-emerald-50">
          <CardHeader
            title="Branding berhasil disimpan"
            description={successMessage}
            action={<Badge variant="success">Berhasil</Badge>}
          />
        </Card>
      ) : null}

      <div className="mb-5">
        <Link
          href="/platform/dashboard/public-content"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Konten Publik
        </Link>
      </div>

      <form action="/platform/dashboard/public-content/branding/update" method="post" encType="multipart/form-data" className="space-y-5">
        <Card>
          <CardHeader
            title="Identitas Brand"
            description="Nama dan subtitle ini akan tampil di navbar publik."
            action={<Badge variant={settings.is_active ? "success" : "warning"}>{settings.is_active ? "Aktif" : "Nonaktif"}</Badge>}
          />

          <div className="grid gap-5 px-5 pb-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Nama Brand
              </label>
              <input
                name="brand_name"
                defaultValue={settings.brand_name}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Subjudul Brand / Engine
              </label>
              <input
                name="brand_subtitle"
                defaultValue={settings.brand_subtitle}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Nama Produk
              </label>
              <input
                name="product_name"
                defaultValue={settings.product_name}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Tagline Produk
              </label>
              <input
                name="product_tagline"
                defaultValue={settings.product_tagline ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Penggagas
              </label>
              <input
                name="initiator_label"
                defaultValue={settings.initiator_label ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Nama Penggagas
              </label>
              <input
                name="initiator_name"
                defaultValue={settings.initiator_name ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Logo Publik"
            description="Logo dapat diupload dari komputer atau diisi memakai URL manual. Jika keduanya diisi, upload file akan dipakai."
            action={<Badge variant="success">Upload / URL</Badge>}
          />

          <div className="space-y-5 px-5 pb-5">
            <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-emerald-700">
                  <ImagePlus className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-700">
                    Logo Navbar / Brand
                  </p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900">
                    Gunakan logo rasio kotak agar tampil rapi di navbar. Format SVG, PNG, JPG, WEBP, atau GIF. Ukuran maksimal 2MB.
                  </p>
                </div>
              </div>

              {settings.logo_url ? (
                <div className="mt-5 overflow-hidden rounded-[1.5rem] bg-white shadow-sm">
                  <div className="flex items-center gap-4 p-4">
                    <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                      <Image
                        src={settings.logo_url}
                        alt={`Logo ${settings.brand_name}`}
                        fill
                        unoptimized
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-slate-900">
                        Logo aktif saat ini
                      </p>
                      <p className="mt-1 line-clamp-1 text-xs font-semibold text-slate-500">
                        {settings.logo_url}
                      </p>
                    </div>

                    <button
                      type="submit"
                      name="clear_logo_url"
                      value="1"
                      formNoValidate
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600 shadow-sm transition hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Hapus Logo
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-center gap-4 rounded-[1.5rem] border border-dashed border-emerald-200 bg-white p-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-700 text-white">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      Belum ada logo custom.
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Navbar akan memakai ikon default sampai logo diupload.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-5 md:grid-cols-2">
                <div>
                  <label className="text-sm font-bold text-slate-700">
                    Upload File Logo
                  </label>
                  <input
                    name="logo_file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                    className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-emerald-700 file:px-4 file:py-2 file:text-sm file:font-bold file:text-white hover:file:bg-emerald-800"
                  />
                  <p className="mt-2 text-xs leading-5 text-emerald-800">
                    Jika upload file dipilih, URL manual di bawah akan diganti otomatis oleh URL Supabase Storage.
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                    <LinkIcon className="h-4 w-4 text-emerald-700" />
                    URL Logo Manual
                  </label>
                  <input
                    name="logo_url"
                    defaultValue={settings.logo_url ?? ""}
                    placeholder="https://domain.com/logo.png"
                    className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <p className="mt-2 text-xs leading-5 text-emerald-800">
                    Bisa diisi URL Supabase Storage atau URL gambar publik lain.
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold text-slate-700">
                  URL Favicon Manual
                </label>
                <input
                  name="favicon_url"
                  defaultValue={settings.favicon_url ?? ""}
                  placeholder="https://domain.com/favicon.png"
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Tombol Navbar"
            description="Atur label dan link tombol yang tampil di navbar publik."
          />

          <div className="grid gap-5 px-5 pb-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Tombol Sekunder
              </label>
              <input
                name="secondary_cta_label"
                defaultValue={settings.secondary_cta_label}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Link Tombol Sekunder
              </label>
              <input
                name="secondary_cta_href"
                defaultValue={settings.secondary_cta_href}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Label Tombol Utama
              </label>
              <input
                name="primary_cta_label"
                defaultValue={settings.primary_cta_label}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Link Tombol Utama
              </label>
              <input
                name="primary_cta_href"
                defaultValue={settings.primary_cta_href}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>
          </div>
        </Card>

        <div className="flex flex-wrap items-center justify-end gap-3 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/platform/dashboard/public-content"
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            Batal
          </Link>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <Save className="h-4 w-4" />
            Simpan Branding
          </button>
        </div>
      </form>
    </div>
  );
}



