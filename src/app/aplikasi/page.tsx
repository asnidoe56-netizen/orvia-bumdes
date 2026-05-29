import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  LockKeyhole,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/public-navbar";
import { PublicNewsPopup } from "@/components/public/public-news-popup";
import {
  getPublicLandingContent,
  type PublicLandingItem,
} from "@/lib/public/landing-content";

function ApplicationIcon({ iconKey }: { iconKey: string | null }) {
  if (iconKey === "users") return <UsersRound className="h-6 w-6" />;
  if (iconKey === "dashboard") return <LayoutDashboard className="h-6 w-6" />;
  if (iconKey === "shield") return <ShieldCheck className="h-6 w-6" />;
  if (iconKey === "report") return <BarChart3 className="h-6 w-6" />;
  if (iconKey === "governance") return <ClipboardList className="h-6 w-6" />;
  if (iconKey === "tenant") return <Building2 className="h-6 w-6" />;
  if (iconKey === "security") return <LockKeyhole className="h-6 w-6" />;

  return <CheckCircle2 className="h-6 w-6" />;
}

function ApplicationCard({ item }: { item: PublicLandingItem }) {
  const hasLink = Boolean(item.link_href);

  return (
    <div className="group flex h-full flex-col rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-100/60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <ApplicationIcon iconKey={item.icon_key} />
        </div>

        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-500">
          {item.item_key ?? "aplikasi"}
        </span>
      </div>

      <h2 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
        {item.title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7 text-slate-600">
        {item.description ??
          "Deskripsi aplikasi ini dapat diatur dari dashboard Super Admin Platform."}
      </p>

      <div className="mt-6 border-t border-slate-100 pt-5">
        {hasLink ? (
          <Link
            href={item.link_href ?? "#"}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-800"
          >
            {item.link_label ?? "Buka Aplikasi"}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-3 text-center text-sm font-black text-slate-500">
            Link belum diatur Super Admin
          </div>
        )}
      </div>
    </div>
  );
}

export default async function AplikasiPage() {
  const landingContent = await getPublicLandingContent();

  const aplikasiSection = landingContent.sections.find(
    (section) => section.section_key === "aplikasi",
  );

  const applicationItems = landingContent.items.filter(
    (item) => item.section_key === "aplikasi",
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar />

      <section className="relative isolate overflow-hidden px-4 pb-16 pt-36 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />

        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700">
              {aplikasiSection?.eyebrow ?? "Aplikasi"}
            </p>

            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {aplikasiSection?.title ??
                "Satu ekosistem kerja untuk banyak peran."}
            </h1>

            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              {aplikasiSection?.subtitle ??
                "Pilih aplikasi sesuai kebutuhan. Daftar aplikasi, deskripsi, ikon, dan tujuan link dapat dikelola dari dashboard Super Admin Platform."}
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
              Direktori Aplikasi
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              Akses aplikasi ORVIA-BUMDES
            </h2>
          </div>

          {applicationItems.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {applicationItems.map((item) => (
                <ApplicationCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
              <h2 className="text-2xl font-black text-slate-950">
                Belum ada aplikasi yang dipublikasikan.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Tambahkan item konten dengan section aplikasi dari dashboard
                Super Admin Platform.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              Kelola dari Super Admin
            </p>
            <h2 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
              Direktori aplikasi ini membaca data dari CMS publik platform.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300">
              Judul, deskripsi, ikon, urutan, status publikasi, label tombol,
              dan link tujuan dapat diatur dari dashboard Super Admin.
            </p>
          </div>

          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 transition hover:bg-emerald-50"
          >
            Mulai Registrasi
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <PublicNewsPopup newsPosts={landingContent.newsPosts} />
    </main>
  );
}


