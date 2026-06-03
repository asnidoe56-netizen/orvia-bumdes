import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Clock3,
  Download,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Target,
  UsersRound,
} from "lucide-react";
import { PublicNavbar } from "@/components/public/public-navbar";
import { PublicNewsPopup } from "@/components/public/public-news-popup";
import { getPublicLandingContent } from "@/lib/public/landing-content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type PublicBumdesProfile = {
  public_slug: string;
  hero_title: string | null;
  hero_subtitle: string | null;
  tagline: string | null;
  profile_description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_address: string | null;
  about_history: string | null;
  vision: string | null;
  mission: string | null;
  service_goals: string | null;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
};

type PublicOrgMember = {
  id: string;
  name: string;
  position: string;
  role_group: string;
};

type PublicUnit = {
  unit_id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  public_description: string | null;
};

type PublicPpid = {
  officer_name: string | null;
  officer_position: string | null;
  service_phone: string | null;
  service_email: string | null;
  service_address: string | null;
  service_hours: string | null;
  request_procedure: string | null;
  objection_procedure: string | null;
};

type PublicDocument = {
  id: string;
  title: string;
  file_url: string;
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function roleLabel(roleGroup: string) {
  const labels: Record<string, string> = {
    penasihat: "Penasihat",
    pelaksana_operasional: "Pelaksana Operasional",
    pengawas: "Pengawas",
    manager_unit: "Manager Unit",
    pengurus: "Pengurus",
    lainnya: "Lainnya",
  };

  return labels[roleGroup] ?? roleGroup;
}

export default async function PublicBumdesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const landingContent = await getPublicLandingContent();

  const { data: profile } = await supabase
    .from("v_public_bumdes_profiles")
    .select("*")
    .eq("public_slug", slug)
    .maybeSingle<PublicBumdesProfile>();

  if (!profile) {
    notFound();
  }

  const [
    { data: members },
    { data: units },
    { data: ppid },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("v_public_bumdes_organizational_members")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicOrgMember[]>(),
    supabase
      .from("v_public_bumdes_units")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicUnit[]>(),
    supabase
      .from("v_public_bumdes_ppid")
      .select("*")
      .eq("public_slug", slug)
      .maybeSingle<PublicPpid>(),
    supabase
      .from("v_public_bumdes_documents")
      .select("*")
      .eq("public_slug", slug)
      .order("display_order", { ascending: true })
      .returns<PublicDocument[]>(),
  ]);

  const title = profile.hero_title ?? profile.nama_bumdes;
  const subtitle =
    profile.hero_subtitle ??
    `Desa ${profile.nama_desa}, Kecamatan ${profile.nama_kecamatan}`;

  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <PublicNavbar siteSettings={landingContent.siteSettings} />

      <section className="relative isolate overflow-hidden px-4 pb-20 pt-36 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]" />

        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-emerald-700">
              Profil Publik BUMDes
            </p>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-3xl text-base font-bold leading-8 text-emerald-800">
              {subtitle}
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-slate-600 sm:text-lg">
              {profile.tagline ??
                profile.profile_description ??
                "Halaman informasi resmi BUMDes untuk profil kelembagaan, unit usaha, dan layanan informasi publik."}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href="#profil"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-6 py-4 text-sm font-black text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-800"
              >
                Lihat Profil
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#ppid"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black text-slate-800 transition hover:border-emerald-200 hover:bg-emerald-50"
              >
                PPID
                <ShieldCheck className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="overflow-hidden rounded-[2.5rem] border border-white bg-white shadow-2xl shadow-emerald-100">
            <div className="flex h-[380px] items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-orange-50">
              <div className="text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-emerald-700 text-white">
                  <Landmark className="h-12 w-12" />
                </div>
                <p className="mt-5 text-2xl font-black text-slate-950">
                  {profile.nama_bumdes}
                </p>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                  {profile.kode_bumdes}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="profil" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Profil BUMDes"
            title="Identitas dan struktur kelembagaan"
            description="Informasi dasar BUMDes, kontak publik, dan struktur pengurus yang dipublikasikan."
          />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <Building2 className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 text-sm font-black text-slate-950">
                {profile.nama_bumdes}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <MapPin className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 text-sm font-black text-slate-950">
                Desa {profile.nama_desa}, Kecamatan {profile.nama_kecamatan}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <Phone className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 text-sm font-black text-slate-950">
                {profile.contact_phone ?? "-"}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <Mail className="h-6 w-6 text-emerald-700" />
              <p className="mt-3 text-sm font-black text-slate-950">
                {profile.contact_email ?? "-"}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-[2rem] border border-slate-200 bg-slate-50 p-6 sm:p-8">
            <h3 className="text-2xl font-black tracking-tight text-slate-950">
              Deskripsi Singkat
            </h3>
            <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
              {profile.profile_description ??
                "Deskripsi profil BUMDes belum dipublikasikan."}
            </p>
            <p className="mt-4 text-sm font-bold leading-7 text-slate-700">
              Alamat: {profile.contact_address ?? "-"}
            </p>
          </div>

          <div className="mt-8">
            <h3 className="mb-5 text-2xl font-black tracking-tight text-slate-950">
              Struktur Pengurus
            </h3>
            {members && members.length > 0 ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <UsersRound className="h-7 w-7 text-emerald-700" />
                    <p className="mt-4 text-lg font-black text-slate-950">
                      {member.name}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-600">
                      {member.position}
                    </p>
                    <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                      {roleLabel(member.role_group)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
                Struktur pengurus belum dipublikasikan.
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="tentang" className="bg-slate-50 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Tentang"
            title="Sejarah, visi, misi, dan tujuan layanan"
          />
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm lg:col-span-3">
              <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-700">
                Sejarah Singkat
              </p>
              <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
                {profile.about_history ??
                  "Sejarah singkat BUMDes belum dipublikasikan."}
              </p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
              <Target className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-5 text-2xl font-black text-slate-950">Visi</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {profile.vision ?? "Visi belum dipublikasikan."}
              </p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
              <ShieldCheck className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-5 text-2xl font-black text-slate-950">Misi</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {profile.mission ?? "Misi belum dipublikasikan."}
              </p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-7 shadow-sm">
              <Landmark className="h-8 w-8 text-emerald-700" />
              <h3 className="mt-5 text-2xl font-black text-slate-950">
                Tujuan Layanan
              </h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                {profile.service_goals ??
                  "Tujuan layanan belum dipublikasikan."}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="unit" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="Unit Aktif"
            title="Unit usaha yang dipublikasikan"
            description="Daftar unit usaha aktif BUMDes yang tersedia untuk informasi publik."
          />
          {units && units.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {units.map((unit) => (
                <div
                  key={unit.unit_id}
                  className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <Building2 className="h-6 w-6 text-emerald-700" />
                  <h3 className="mt-6 text-2xl font-black tracking-tight text-slate-950">
                    {unit.nama_unit}
                  </h3>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-700">
                    {unit.kode_unit} - {unit.jenis_unit}
                  </p>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    {unit.public_description ??
                      "Deskripsi unit usaha belum dipublikasikan."}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">
              Belum ada unit aktif yang dipublikasikan.
            </div>
          )}
        </div>
      </section>

      <section id="ppid" className="bg-slate-950 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-emerald-300">
              PPID
            </p>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Keterbukaan Informasi Publik
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-300 sm:text-base">
              Kanal layanan informasi publik BUMDes untuk mendukung transparansi
              dan akuntabilitas.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
              <h3 className="text-2xl font-black">Layanan Informasi</h3>
              <div className="mt-6 space-y-4 text-sm leading-7 text-slate-300">
                <p className="flex gap-3">
                  <UsersRound className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {ppid?.officer_name
                    ? `${ppid.officer_name} - ${ppid.officer_position ?? "PPID"}`
                    : "Penanggung jawab informasi belum dipublikasikan."}
                </p>
                <p className="flex gap-3">
                  <Phone className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {ppid?.service_phone ?? profile.contact_phone ?? "-"}
                </p>
                <p className="flex gap-3">
                  <Mail className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {ppid?.service_email ?? profile.contact_email ?? "-"}
                </p>
                <p className="flex gap-3">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {ppid?.service_address ?? profile.contact_address ?? "-"}
                </p>
                <p className="flex gap-3">
                  <Clock3 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" />
                  {ppid?.service_hours ?? "Jam layanan belum dipublikasikan."}
                </p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-7">
              <h3 className="text-2xl font-black">Prosedur Informasi</h3>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="text-sm font-black text-emerald-300">
                    Permohonan Informasi
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {ppid?.request_procedure ??
                      "Prosedur permohonan informasi belum dipublikasikan."}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="text-sm font-black text-emerald-300">
                    Keberatan Informasi
                  </p>
                  <p className="mt-3 text-sm leading-7 text-slate-300">
                    {ppid?.objection_procedure ??
                      "Prosedur keberatan informasi belum dipublikasikan."}
                  </p>
                </div>
              </div>

              {documents && documents.length > 0 ? (
                <div className="mt-6">
                  <h4 className="text-lg font-black">Dokumen Publik</h4>
                  <div className="mt-4 space-y-3">
                    {documents.map((document) => (
                      <Link
                        key={document.id}
                        href={document.file_url}
                        className="flex items-center justify-between gap-4 rounded-2xl bg-white/10 p-4 text-sm font-bold text-white transition hover:bg-white/15"
                      >
                        <span className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-emerald-300" />
                          {document.title}
                        </span>
                        <Download className="h-4 w-4" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <PublicNewsPopup newsPosts={landingContent.newsPosts} />
    </main>
  );
}