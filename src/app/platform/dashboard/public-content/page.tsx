import Link from "next/link";
import { FileText, Globe2, Newspaper, Rows3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";

type PublicSectionRow = {
  id: string;
  section_key: string;
  section_label: string;
  title: string;
  display_order: number;
};

type PublicItemRow = {
  id: string;
  section_key: string;
  item_key: string | null;
  title: string;
  icon_key: string | null;
  link_href: string | null;
  display_order: number;
};

type PublicNewsRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author_name: string | null;
  published_at: string | null;
  display_order: number;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function PlatformPublicContentPage() {
  const supabase = await createClient();

  const [sectionsResult, itemsResult, newsResult] = await Promise.all([
    supabase
      .from("v_public_landing_sections")
      .select("id, section_key, section_label, title, display_order")
      .order("display_order", { ascending: true }),

    supabase
      .from("v_public_landing_items")
      .select("id, section_key, item_key, title, icon_key, link_href, display_order")
      .order("display_order", { ascending: true }),

    supabase
      .from("v_public_news_posts")
      .select("id, slug, title, excerpt, author_name, published_at, display_order")
      .order("published_at", { ascending: false, nullsFirst: false }),
  ]);

  const sections = (sectionsResult.data ?? []) as PublicSectionRow[];
  const items = (itemsResult.data ?? []) as PublicItemRow[];
  const newsPosts = (newsResult.data ?? []) as PublicNewsRow[];

  const hasError =
    sectionsResult.error !== null ||
    itemsResult.error !== null ||
    newsResult.error !== null;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / Konten Publik"
        title="Konten Publik Landing Page"
        description="Pantau konten publik yang tampil di landing page ORVIA-BUMDES. Tahap ini masih read-only sebelum form pengelolaan konten dibuat."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Section Publik"
          value={sections.length.toString()}
          description="Section landing page yang aktif."
          icon={<Globe2 className="h-5 w-5" />}
        />
        <StatCard
          title="Item Konten"
          value={items.length.toString()}
          description="Card/fitur yang tampil di halaman publik."
          icon={<Rows3 className="h-5 w-5" />}
        />
        <StatCard
          title="Berita Publik"
          value={newsPosts.length.toString()}
          description="Posting berita yang sudah published."
          icon={<Newspaper className="h-5 w-5" />}
        />
        <StatCard
          title="Sumber Data"
          value={hasError ? "Error" : "Aktif"}
          description={
            hasError
              ? "Ada query CMS publik yang gagal dibaca."
              : "Konten dibaca dari view CMS publik."
          }
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {hasError ? (
        <Card className="mb-5 border-orange-200 bg-orange-50">
          <CardHeader
            title="Peringatan Akses Data"
            description="Sebagian data CMS publik gagal dibaca. Periksa policy RLS, grant, dan koneksi Supabase."
            action={<Badge variant="warning">Butuh Cek</Badge>}
          />
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader
            title="Section Landing Page"
            description="Section utama yang tampil di halaman publik."
            action={<Badge variant="success">Published View</Badge>}
          />

          <div className="min-w-0 overflow-x-auto px-5 pb-5">
            <table className="min-w-[680px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-3 font-black">Urutan</th>
                  <th className="px-3 py-3 font-black">Key</th>
                  <th className="px-3 py-3 font-black">Label</th>
                  <th className="px-3 py-3 font-black">Judul</th>
                  <th className="px-3 py-3 font-black">Status</th>
                  <th className="px-3 py-3 font-black">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sections.length > 0 ? (
                  sections.map((section) => (
                    <tr key={section.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 font-bold text-slate-700">
                        {section.display_order}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">
                        {section.section_key}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-900">
                        {section.section_label}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {section.title}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="success">Published</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <Link
                          href={`/platform/dashboard/public-content/sections/${section.id}/edit`}
                          className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                      Belum ada section publik.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Berita Publik"
            description="Posting berita/pengumuman yang tampil di landing page dan popup publik."
            action={<Badge variant="success">Editable</Badge>}
          />

          <div className="space-y-3 px-5 pb-5">
            {newsPosts.length > 0 ? (
              newsPosts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {post.title}
                      </p>
                      <p className="mt-1 truncate font-mono text-xs text-slate-500">
                        {post.slug}
                      </p>
                    </div>
                    <Badge variant="success">Published</Badge>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {post.excerpt ?? "Tidak ada ringkasan."}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                    <span>Author: {post.author_name ?? "-"}</span>
                    <span>•</span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Link
                      href={`/platform/dashboard/public-content/news/${post.id}/edit`}
                      className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                    >
                      Edit Berita
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Belum ada berita publik.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <CardHeader
          title="Daftar Aplikasi Publik"
          description="Atur nama aplikasi, deskripsi, icon, tombol, dan link domain yang tampil di halaman /aplikasi."
          action={<Badge variant="success">Editable</Badge>}
        />

        <div className="min-w-0 overflow-x-auto px-5 pb-5">
          <table className="min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3 font-black">Urutan</th>
                <th className="px-3 py-3 font-black">Section</th>
                <th className="px-3 py-3 font-black">Item Key</th>
                <th className="px-3 py-3 font-black">Judul</th>
                <th className="px-3 py-3 font-black">Icon</th>
                <th className="px-3 py-3 font-black">Link</th>
                <th className="px-3 py-3 font-black">Status</th>
                <th className="px-3 py-3 font-black">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-bold text-slate-700">
                      {item.display_order}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                      {item.section_key}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600">
                      {item.item_key ?? "-"}
                    </td>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      {item.title}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.icon_key ?? "-"}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {item.link_href ? (
                        <span className="line-clamp-1 max-w-[220px] text-xs font-bold text-emerald-700">
                          {item.link_href}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-slate-400">
                          Belum diatur
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="success">Published</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <Link
                        href={`/platform/dashboard/public-content/items/${item.id}/edit`}
                        className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100"
                      >
                        Edit Aplikasi
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    Belum ada item konten.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}




