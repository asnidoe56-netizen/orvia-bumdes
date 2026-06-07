import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Globe2, Settings, Store, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  createPublicMemberSettingAction,
  updatePublicMemberSettingAction,
  updatePublicProfileSettingAction,
  updatePublicUnitSettingAction,
} from "./actions";

type BusinessUnitRow = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
  created_at: string;
};

type PublicUnitRow = {
  unit_id: string;
  public_description: string | null;
  display_order: number;
  is_published: boolean;
};

type PublicProfileRow = {
  public_slug: string;
  is_published: boolean;
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
};

type PublicMemberRow = {
  id: string;
  name: string;
  position: string;
  role_group: string;
  photo_url: string | null;
  display_order: number;
  is_published: boolean;
};

const ROLE_GROUP_OPTIONS = [
  { value: "penasihat", label: "Penasihat" },
  { value: "pengawas", label: "Pengawas" },
  { value: "pengurus", label: "Pengurus" },
  { value: "manager_unit", label: "Manager Unit" },
  { value: "lainnya", label: "Lainnya" },
  { value: "pelaksana_operasional", label: "Pelaksana Operasional" },
];

function roleGroupLabel(value: string) {
  return (
    ROLE_GROUP_OPTIONS.find((option) => option.value === value)?.label ??
    "Pengurus"
  );
}

export default async function BumdesPengaturanPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
        Konteks BUMDes tidak ditemukan.
      </div>
    );
  }

  const supabase = await createClient();

  const [
    { data: units },
    { data: publicUnits },
    { data: publicProfile },
    { data: publicMembers },
  ] = await Promise.all([
      supabase
        .from("business_units")
        .select("id, kode_unit, nama_unit, jenis_unit, status, created_at")
        .eq("tenant_id", context.tenant_id)
        .eq("status", "aktif")
        .order("created_at", { ascending: true }),
      supabase
        .from("tenant_public_units")
        .select("unit_id, public_description, display_order, is_published")
        .eq("tenant_id", context.tenant_id),
      supabase
        .from("tenant_public_profiles")
        .select("public_slug, is_published, hero_title, hero_subtitle, tagline, profile_description, contact_phone, contact_email, contact_address, about_history, vision, mission, service_goals")
        .eq("tenant_id", context.tenant_id)
        .maybeSingle<PublicProfileRow>(),
      supabase
        .from("tenant_public_organizational_members")
        .select("id, name, position, role_group, photo_url, display_order, is_published")
        .eq("tenant_id", context.tenant_id)
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);

  const publicUnitMap = new Map(
    ((publicUnits ?? []) as PublicUnitRow[]).map((item) => [item.unit_id, item]),
  );

  const activeUnits = (units ?? []) as BusinessUnitRow[];
  const members = (publicMembers ?? []) as PublicMemberRow[];
  const publishedCount = activeUnits.filter(
    (unit) => publicUnitMap.get(unit.id)?.is_published,
  ).length;
  const publishedMemberCount = members.filter((member) => member.is_published).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengaturan"
        description="Kelola informasi yang boleh tampil pada halaman publik BUMDes."
        action={
          publicProfile?.public_slug ? (
            <Link
              href={`/bumdes/${publicProfile.public_slug}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              Lihat Halaman Publik
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Badge variant="warning">Profil Publik Belum Ada</Badge>
          )
        }
      />

      <Card>
        <CardHeader
          title="Profil Publik BUMDes"
          description="Atur tulisan utama, kontak, sejarah, visi, misi, dan tujuan layanan yang tampil pada halaman publik."
          action={<Badge variant="success">Tahap 3</Badge>}
        />

        <form action={updatePublicProfileSettingAction} className="mt-6 space-y-6">
          <div className="rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">
                  Status Halaman Publik
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Jika dimatikan, halaman publik BUMDes tidak akan menampilkan profil lengkap kepada masyarakat.
                </p>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  name="is_published"
                  defaultChecked={publicProfile?.is_published ?? false}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                Publikasikan Profil
              </label>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Judul Utama
              </span>
              <input
                name="hero_title"
                defaultValue={publicProfile?.hero_title ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Contoh: BUMDes BUHUTA WALAMA"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Subjudul Utama
              </span>
              <input
                name="hero_subtitle"
                defaultValue={publicProfile?.hero_subtitle ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Contoh: Desa Tolango, Kecamatan Anggrek"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Kalimat Pembuka / Tagline
              </span>
              <textarea
                name="tagline"
                defaultValue={publicProfile?.tagline ?? ""}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Tuliskan kalimat pendek yang menggambarkan wajah BUMDes kepada masyarakat."
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Deskripsi Singkat
              </span>
              <textarea
                name="profile_description"
                defaultValue={publicProfile?.profile_description ?? ""}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Ceritakan secara singkat profil BUMDes dengan bahasa yang mudah dipahami masyarakat."
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Telepon Publik
              </span>
              <input
                name="contact_phone"
                defaultValue={publicProfile?.contact_phone ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Nomor layanan publik"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Email Publik
              </span>
              <input
                name="contact_email"
                defaultValue={publicProfile?.contact_email ?? ""}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Email layanan publik"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Alamat Publik
              </span>
              <textarea
                name="contact_address"
                defaultValue={publicProfile?.contact_address ?? ""}
                rows={3}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Alamat kantor atau alamat layanan BUMDes."
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Sejarah Singkat
              </span>
              <textarea
                name="about_history"
                defaultValue={publicProfile?.about_history ?? ""}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Tulis sejarah singkat berdirinya BUMDes."
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Visi
              </span>
              <textarea
                name="vision"
                defaultValue={publicProfile?.vision ?? ""}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Tulis visi BUMDes."
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Misi
              </span>
              <textarea
                name="mission"
                defaultValue={publicProfile?.mission ?? ""}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Tulis misi BUMDes."
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Tujuan Layanan
              </span>
              <textarea
                name="service_goals"
                defaultValue={publicProfile?.service_goals ?? ""}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Tulis tujuan layanan BUMDes untuk masyarakat desa."
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="rounded-2xl bg-emerald-700 px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
            >
              Simpan Profil Publik
            </button>
          </div>
        </form>
      </Card>
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Unit Aktif</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {activeUnits.length}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Unit usaha aktif milik BUMDes.
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Dipublikasikan
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {publishedCount}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Unit yang tampil di halaman publik.
              </p>
            </div>
            <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
              <Globe2 className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Pengurus Publik
              </p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {publishedMemberCount}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Struktur yang tampil di halaman publik.
              </p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
              <Users className="h-5 w-5" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Status Profil
              </p>
              <p className="mt-2 text-lg font-black text-slate-950">
                {publicProfile?.is_published ? "Publik Aktif" : "Belum Publik"}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Profil harus aktif agar halaman publik dapat dibuka.
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
              <Settings className="h-5 w-5" />
            </div>
          </div>
        </Card>
      </section>

      <Card>
        <CardHeader
          title="Pengaturan Unit Publik"
          description="Pilih unit usaha yang boleh tampil di halaman publik BUMDes. Unit internal tetap aman meskipun tidak dipublikasikan."
          action={<Badge variant="success">Tahap 1</Badge>}
        />

        <div className="mt-6 space-y-4">
          {activeUnits.length > 0 ? (
            activeUnits.map((unit) => {
              const publicUnit = publicUnitMap.get(unit.id);
              const isPublished = publicUnit?.is_published ?? false;

              return (
                <form
                  key={unit.id}
                  action={updatePublicUnitSettingAction}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                >
                  <input type="hidden" name="unit_id" value={unit.id} />

                  <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr_180px_160px] lg:items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
                          <Store className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-950">
                            {unit.nama_unit}
                          </h3>
                          <p className="text-sm font-semibold text-slate-500">
                            {unit.kode_unit} · {unit.jenis_unit}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                            <Eye className="h-3.5 w-3.5" />
                            Tampil di Publik
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-600">
                            <EyeOff className="h-3.5 w-3.5" />
                            Disembunyikan
                          </span>
                        )}
                      </div>
                    </div>

                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Deskripsi Publik
                      </span>
                      <textarea
                        name="public_description"
                        defaultValue={publicUnit?.public_description ?? ""}
                        rows={4}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                        placeholder="Contoh: Unit perdagangan yang menyediakan kebutuhan pertanian dan layanan masyarakat desa."
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Urutan
                      </span>
                      <input
                        type="number"
                        name="display_order"
                        defaultValue={publicUnit?.display_order ?? 100}
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                      />
                    </label>

                    <div className="space-y-3">
                      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                        <input
                          type="checkbox"
                          name="is_published"
                          defaultChecked={isPublished}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                        />
                        Tampilkan
                      </label>

                      <button
                        type="submit"
                        className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                      >
                        Simpan
                      </button>
                    </div>
                  </div>
                </form>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-black text-slate-950">
                Belum ada unit aktif.
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Tambahkan unit usaha terlebih dahulu melalui menu Unit Usaha.
              </p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Struktur Pengurus Publik"
          description="Atur siapa saja pengurus BUMDes yang boleh tampil di halaman publik. Data ini menjadi wajah resmi BUMDes di hadapan masyarakat."
          action={<Badge variant="success">Tahap 2</Badge>}
        />

        <form
          action={createPublicMemberSettingAction}
          className="mt-6 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-white p-3 text-emerald-700 shadow-sm">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Tambah Pengurus Publik
              </h3>
              <p className="text-sm text-slate-600">
                Masukkan nama pengurus yang akan tampil pada halaman publik.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_1fr_120px_150px]">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Nama
              </span>
              <input
                name="name"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Nama pengurus"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Jabatan
              </span>
              <input
                name="position"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Contoh: Direktur"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Kelompok
              </span>
              <select
                name="role_group"
                defaultValue="pengurus"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              >
                {ROLE_GROUP_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                URL Foto
              </span>
              <input
                name="photo_url"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                placeholder="Opsional"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                Urutan
              </span>
              <input
                type="number"
                name="display_order"
                defaultValue={100}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
              />
            </label>

            <div className="space-y-3">
              <label className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  name="is_published"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                />
                Tampilkan
              </label>

              <button
                type="submit"
                className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
              >
                Tambah
              </button>
            </div>
          </div>
        </form>

        <div className="mt-6 space-y-4">
          {members.length > 0 ? (
            members.map((member) => (
              <form
                key={member.id}
                action={updatePublicMemberSettingAction}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <input type="hidden" name="member_id" value={member.id} />

                <div className="grid gap-5 lg:grid-cols-[1fr_1fr_180px_1fr_120px_150px] lg:items-start">
                  <div>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                        Nama
                      </span>
                      <input
                        name="name"
                        defaultValue={member.name}
                        required
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                      />
                    </label>

                    <div className="mt-3">
                      {member.is_published ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">
                          <Eye className="h-3.5 w-3.5" />
                          Tampil di Publik
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-black text-slate-600">
                          <EyeOff className="h-3.5 w-3.5" />
                          Disembunyikan
                        </span>
                      )}
                    </div>
                  </div>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Jabatan
                    </span>
                    <input
                      name="position"
                      defaultValue={member.position}
                      required
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Kelompok
                    </span>
                    <select
                      name="role_group"
                      defaultValue={member.role_group}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                    >
                      {ROLE_GROUP_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      Saat ini: {roleGroupLabel(member.role_group)}
                    </p>
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      URL Foto
                    </span>
                    <input
                      name="photo_url"
                      defaultValue={member.photo_url ?? ""}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                      placeholder="Opsional"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-wide text-slate-500">
                      Urutan
                    </span>
                    <input
                      type="number"
                      name="display_order"
                      defaultValue={member.display_order}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-50"
                    />
                  </label>

                  <div className="space-y-3">
                    <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
                      <input
                        type="checkbox"
                        name="is_published"
                        defaultChecked={member.is_published}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-700"
                      />
                      Tampilkan
                    </label>

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-emerald-800"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </form>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <h3 className="text-xl font-black text-slate-950">
                Struktur pengurus belum diisi.
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Tambahkan pengurus agar masyarakat dapat melihat struktur resmi BUMDes.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}




