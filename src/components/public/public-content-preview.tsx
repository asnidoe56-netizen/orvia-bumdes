import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Newspaper } from "lucide-react";
import type {
  PublicLandingSection,
  PublicNewsPost,
} from "@/lib/public/landing-content";

type PublicContentPreviewProps = {
  sections: PublicLandingSection[];
  newsPosts: PublicNewsPost[];
};

function findSection(
  sections: PublicLandingSection[],
  sectionKey: string,
): PublicLandingSection | undefined {
  return sections.find((section) => section.section_key === sectionKey);
}

function formatDate(value: string | null) {
  if (!value) return "Belum dijadwalkan";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function SectionPreview({
  id,
  eyebrow,
  title,
  description,
  tone = "white",
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  tone?: "white" | "slate";
}) {
  return (
    <section
      id={id}
      className={[
        tone === "slate" ? "bg-slate-50" : "bg-white",
        "px-4 py-16 sm:px-6 lg:px-8",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
          {eyebrow}
        </p>

        <div className="mt-3 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <h2 className="text-3xl font-black tracking-tight text-slate-950">
            {title}
          </h2>

          <p className="text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </div>
    </section>
  );
}

function NewsPreview({ post }: { post?: PublicNewsPost }) {
  const href = post?.link_href ?? "#";
  const hasLink = Boolean(post?.link_href);

  return (
    <section id="berita" className="bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="overflow-hidden rounded-[2.25rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-emerald-50 shadow-xl shadow-orange-100/50">
          <div className="grid lg:grid-cols-[0.95fr_1.05fr]">
            <div className="relative min-h-[280px] overflow-hidden bg-slate-950">
              {post?.cover_image_url ? (
                <Image
                  src={post.cover_image_url}
                  alt={post.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.35),transparent_36%),linear-gradient(135deg,#020617,#064e3b)] p-10 text-white">
                  <div className="text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10">
                      <Newspaper className="h-8 w-8 text-emerald-200" />
                    </div>
                    <p className="mt-5 text-sm font-black uppercase tracking-[0.28em] text-emerald-200">
                      ORVIA-BUMDES
                    </p>
                    <h3 className="mt-3 text-3xl font-black leading-tight">
                      Ruang Berita Publik
                    </h3>
                  </div>
                </div>
              )}

              <div className="absolute left-5 top-5 rounded-full bg-white/95 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-700 shadow-lg">
                Berita
              </div>
            </div>

            <div className="flex flex-col justify-center p-6 md:p-10">
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                <span className="inline-flex items-center gap-2 rounded-full bg-orange-100 px-3 py-1 text-orange-700">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(post?.published_at ?? null)}
                </span>
                <span>{post?.author_name ?? "ORVIA-BUMDES"}</span>
              </div>

              <h2 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {post?.title ?? "Ruang publikasi perkembangan BUMDes."}
              </h2>

              <p className="mt-5 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
                {post?.excerpt ??
                  "Artikel, pengumuman, dan informasi publik dapat dimasukkan melalui dashboard Super Admin Platform."}
              </p>

              <div className="mt-8">
                {hasLink ? (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:-translate-y-0.5 hover:bg-emerald-800"
                  >
                    Baca Berita
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : (
                  <div className="inline-flex rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-4 text-sm font-black text-slate-500">
                    Link berita belum diatur
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {post ? (
          <div className="mt-5 flex justify-end">
            <Link
              href="/#berita"
              className="text-xs font-black uppercase tracking-[0.2em] text-slate-400"
            >
              Berita terbaru dari konten publik
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function PublicContentPreview({
  sections,
  newsPosts,
}: PublicContentPreviewProps) {
  const aplikasi = findSection(sections, "aplikasi");
  const manajemen = findSection(sections, "manajemen");
  const latestNews = newsPosts[0];

  return (
    <>
      <SectionPreview
        id="aplikasi"
        eyebrow={aplikasi?.eyebrow ?? "Aplikasi"}
        title={aplikasi?.title ?? "Satu ekosistem kerja untuk banyak peran."}
        description={
          aplikasi?.subtitle ??
          aplikasi?.body ??
          "Bagian ini dapat diatur dari database Super Admin Platform."
        }
      />

      <SectionPreview
        id="manajemen"
        eyebrow={manajemen?.eyebrow ?? "Manajemen"}
        title={
          manajemen?.title ??
          "Konten manajemen akan dikelola dari dashboard platform."
        }
        description={
          manajemen?.subtitle ??
          manajemen?.body ??
          "Ini disiapkan sebagai placeholder awal sebelum modul CMS publik dibuat."
        }
        tone="slate"
      />

      <NewsPreview post={latestNews} />
    </>
  );
}

