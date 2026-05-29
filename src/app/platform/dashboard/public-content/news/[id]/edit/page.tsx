import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { updatePublicNewsPost } from "../../../actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type PublicNewsPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  published_at: string | null;
  display_order: number;
  is_published: boolean;
  link_href: string | null;
  popup_enabled: boolean;
  popup_delay_seconds: number;
  popup_position: string;
};

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);

  return localDate.toISOString().slice(0, 16);
}

export default async function EditPublicNewsPostPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("public_news_posts")
    .select(
      "id, slug, title, excerpt, content, cover_image_url, author_name, published_at, display_order, is_published, link_href, popup_enabled, popup_delay_seconds, popup_position"
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    notFound();
  }

  const post = data as PublicNewsPost;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Konten Publik / Edit Berita"
        title={`Edit Berita: ${post.title}`}
        description="Atur judul, deskripsi, gambar, URL berita, isi berita, dan pengaturan popup berita publik."
      />

      <Card>
        <CardHeader
          title="Form Berita Publik"
          description="Berita dapat tampil di halaman publik dan dapat dimunculkan sebagai card popup otomatis."
          action={
            post.is_published ? (
              <Badge variant="success">Published</Badge>
            ) : (
              <Badge variant="warning">Draft</Badge>
            )
          }
        />

        <form action={updatePublicNewsPost} className="space-y-5 px-5 pb-5">
          <input type="hidden" name="id" value={post.id} />

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Judul Berita
              </label>
              <input
                name="title"
                defaultValue={post.title}
                placeholder="Contoh: ORVIA-BUMDES membuka registrasi BUMDes digital"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Slug Berita
              </label>
              <input
                name="slug"
                defaultValue={post.slug}
                placeholder="contoh-judul-berita"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Deskripsi Berita
            </label>
            <textarea
              name="excerpt"
              defaultValue={post.excerpt ?? ""}
              rows={3}
              placeholder="Ringkasan singkat yang tampil pada card berita."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Link Gambar Berita
              </label>
              <input
                name="cover_image_url"
                defaultValue={post.cover_image_url ?? ""}
                placeholder="https://domain.com/gambar-berita.jpg"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Link URL Berita
              </label>
              <input
                name="link_href"
                defaultValue={post.link_href ?? ""}
                placeholder="https://domain.com/berita/judul-berita"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-700">
              Isi Berita
            </label>
            <textarea
              name="content"
              defaultValue={post.content ?? ""}
              rows={10}
              placeholder="Tulis isi berita lengkap di sini."
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-7 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            />
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div>
              <label className="text-sm font-bold text-slate-700">
                Penulis
              </label>
              <input
                name="author_name"
                defaultValue={post.author_name ?? ""}
                placeholder="ORVIA-BUMDES"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Tanggal Publikasi
              </label>
              <input
                name="published_at"
                type="datetime-local"
                defaultValue={formatDateTimeLocal(post.published_at)}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>

            <div>
              <label className="text-sm font-bold text-slate-700">
                Urutan Tampil
              </label>
              <input
                name="display_order"
                type="number"
                defaultValue={post.display_order}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Pengaturan Popup Berita
            </p>

            <p className="mt-2 text-sm leading-6 text-emerald-900">
              Jika diaktifkan, card berita akan muncul otomatis dari pojok layar
              setelah delay yang ditentukan.
            </p>

            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <label className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-slate-700">
                <input
                  name="popup_enabled"
                  type="checkbox"
                  defaultChecked={post.popup_enabled}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Aktifkan Popup
              </label>

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Delay Muncul
                </label>
                <input
                  name="popup_delay_seconds"
                  type="number"
                  min={0}
                  max={60}
                  defaultValue={post.popup_delay_seconds}
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
                <p className="mt-2 text-xs text-emerald-800">
                  Contoh: 5 berarti popup muncul setelah 5 detik.
                </p>
              </div>

              <div>
                <label className="text-sm font-bold text-slate-700">
                  Posisi Popup
                </label>
                <select
                  name="popup_position"
                  defaultValue={post.popup_position}
                  className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="top-right">Pojok kanan atas</option>
                  <option value="top-left">Pojok kiri atas</option>
                  <option value="bottom-right">Pojok kanan bawah</option>
                  <option value="bottom-left">Pojok kiri bawah</option>
                </select>
              </div>
            </div>
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
            <input
              name="is_published"
              type="checkbox"
              defaultChecked={post.is_published}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            Tampilkan berita ini di halaman publik
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
              Simpan Berita
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}