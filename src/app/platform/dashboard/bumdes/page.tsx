import Link from "next/link";
import { Building2, ExternalLink, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { CopyPublicLinkButton } from "./copy-public-link-button";

type TenantRow = {
  id: string;
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  status: string | null;
};

type PublicProfileRow = {
  tenant_id: string;
  public_slug: string;
  is_published: boolean;
};

function statusLabel(status: string | null) {
  if (status === "active") return "Aktif";
  if (status === "inactive") return "Nonaktif";
  return status ?? "-";
}

export default async function PlatformBumdesPage() {
  const supabase = await createClient();

  const [{ data: tenants }, { data: publicProfiles }] = await Promise.all([
    supabase
      .from("tenants")
      .select("id,kode_bumdes,nama_bumdes,nama_desa,nama_kecamatan,status")
      .order("created_at", { ascending: false })
      .returns<TenantRow[]>(),
    supabase
      .from("tenant_public_profiles")
      .select("tenant_id,public_slug,is_published")
      .returns<PublicProfileRow[]>(),
  ]);

  const rows = tenants ?? [];
  const profileByTenant = new Map(
    (publicProfiles ?? []).map((profile) => [profile.tenant_id, profile]),
  );

  const activeCount = rows.filter((row) => row.status === "active").length;
  const inactiveCount = rows.filter((row) => row.status !== "active").length;
  const villageCount = new Set(
    rows
      .map((row) => `${row.nama_desa ?? ""}-${row.nama_kecamatan ?? ""}`)
      .filter((value) => value !== "-"),
  ).size;

  return (
    <div>
      <PageHeader
        breadcrumb="Admin Platform / BUMDes"
        title="BUMDes / Tenant"
        description="Pantau seluruh BUMDes yang sudah menjadi tenant aktif dalam sistem. Link publik dapat disalin dan dikirim ke BUMDes setelah profil dipublikasikan."
      />

      <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Tenant Aktif"
          value={activeCount.toString()}
          description="BUMDes dengan status tenant aktif."
          icon={<Building2 className="h-5 w-5" />}
        />
        <StatCard
          title="Wilayah Desa"
          value={villageCount.toString()}
          description="Jumlah kombinasi desa/kecamatan tenant."
          icon={<MapPin className="h-5 w-5" />}
        />
        <StatCard
          title="BUMDes Nonaktif"
          value={inactiveCount.toString()}
          description="Tenant yang tidak berada pada status active."
          icon={<Building2 className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardHeader
          title="Daftar BUMDes"
          description="Link publik dibaca dari tenant_public_profiles. Gunakan tombol copy untuk mengirim tautan ke BUMDes."
          action={<Badge variant="success">Database Connected</Badge>}
        />

        <div className="overflow-x-auto px-5 pb-5">
          <table className="min-w-[980px] w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs font-black uppercase tracking-wide text-slate-500">
                <th className="border-b border-slate-200 px-4 py-3">Kode</th>
                <th className="border-b border-slate-200 px-4 py-3">BUMDes</th>
                <th className="border-b border-slate-200 px-4 py-3">Desa</th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Kecamatan
                </th>
                <th className="border-b border-slate-200 px-4 py-3">Status</th>
                <th className="border-b border-slate-200 px-4 py-3">
                  Link Publik
                </th>
                <th className="border-b border-slate-200 px-4 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((tenant) => {
                  const profile = profileByTenant.get(tenant.id);
                  const publicPath = profile?.public_slug
                    ? `/bumdes/${profile.public_slug}`
                    : null;

                  return (
                    <tr key={tenant.id} className="align-top">
                      <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-700">
                        {tenant.kode_bumdes ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <p className="font-black text-slate-950">
                          {tenant.nama_bumdes ?? "-"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-500">
                          Tenant ID: {tenant.id.slice(0, 8)}...
                        </p>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-700">
                        {tenant.nama_desa ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4 font-bold text-slate-700">
                        {tenant.nama_kecamatan ?? "-"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        <Badge
                          variant={tenant.status === "active" ? "success" : "warning"}
                        >
                          {statusLabel(tenant.status)}
                        </Badge>
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        {publicPath ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={
                                  profile?.is_published ? "success" : "warning"
                                }
                              >
                                {profile?.is_published ? "Published" : "Draft"}
                              </Badge>
                              <code className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700">
                                {publicPath}
                              </code>
                            </div>
                            <p className="text-xs leading-5 text-slate-500">
                              {profile?.is_published
                                ? "Link dapat dikirim ke BUMDes."
                                : "Profil masih draft, link belum tampil publik."}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Badge variant="warning">Belum Ada</Badge>
                            <p className="text-xs leading-5 text-slate-500">
                              Profil publik belum dibuat untuk tenant ini.
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-4">
                        {publicPath ? (
                          <div className="flex flex-wrap gap-2">
                            <CopyPublicLinkButton path={publicPath} />
                            <Link
                              href={publicPath}
                              target="_blank"
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-800"
                            >
                              Buka
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-400">
                            Belum tersedia
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-sm font-bold text-slate-500"
                  >
                    Belum ada data BUMDes. Tenant akan terbentuk setelah
                    registrasi disetujui melalui database RPC.
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