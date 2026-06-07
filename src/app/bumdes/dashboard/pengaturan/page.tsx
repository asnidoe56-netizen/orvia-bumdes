import Link from "next/link";
import { ArrowRight, Eye, EyeOff, Globe2, Settings, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { updatePublicUnitSettingAction } from "./actions";

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
};

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

  const [{ data: units }, { data: publicUnits }, { data: publicProfile }] =
    await Promise.all([
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
        .select("public_slug, is_published")
        .eq("tenant_id", context.tenant_id)
        .maybeSingle<PublicProfileRow>(),
    ]);

  const publicUnitMap = new Map(
    ((publicUnits ?? []) as PublicUnitRow[]).map((item) => [item.unit_id, item]),
  );

  const activeUnits = (units ?? []) as BusinessUnitRow[];
  const publishedCount = activeUnits.filter(
    (unit) => publicUnitMap.get(unit.id)?.is_published,
  ).length;

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

      <section className="grid gap-4 md:grid-cols-3">
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
    </div>
  );
}

