export const dynamic = "force-dynamic";

import { Building2, MapPin, UsersRound, Store, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type Tenant = {
  id: string;
  nama_bumdes: string;
  kode_bumdes: string;
  nama_desa: string;
  nama_kecamatan: string;
  alamat: string | null;
  nomor_whatsapp: string | null;
  email: string | null;
  status: string;
};

type BusinessUnit = {
  id: string;
  nama_unit: string;
  kode_unit: string;
  jenis_unit: string;
  status: string;
};

export default async function BumdesDashboardPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select(
      "id, nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan, alamat, nomor_whatsapp, email, status"
    )
    .eq("id", context.tenant_id)
    .single();

  const { data: units } = await supabase
    .from("business_units")
    .select("id, nama_unit, kode_unit, jenis_unit, status")
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const { count: userCount } = await supabase
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", context.tenant_id);

  const tenantData = tenant as Tenant | null;
  const unitList = (units ?? []) as BusinessUnit[];

  if (tenantError || !tenantData) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
        Gagal membaca data BUMDes: {tenantError?.message ?? "Tenant tidak ditemukan."}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
              Dashboard Direktur BUMDes
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-950">
              {tenantData.nama_bumdes}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                <Building2 className="h-4 w-4" />
                {tenantData.kode_bumdes}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
                <MapPin className="h-4 w-4" />
                Desa {tenantData.nama_desa}, Kecamatan {tenantData.nama_kecamatan}
              </span>

              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 font-bold text-emerald-700">
                <ShieldCheck className="h-4 w-4" />
                {tenantData.status}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm">
            <p className="font-bold text-emerald-800">
              {context.full_name || "Direktur BUMDes"}
            </p>
            <p className="mt-1 text-emerald-700">
              Role: {context.role}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">Unit Usaha</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {unitList.length}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Unit usaha dalam tenant ini.
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Store className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Pengguna Tenant
              </p>
              <p className="mt-2 text-3xl font-bold text-slate-950">
                {userCount ?? 0}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                User yang punya role di tenant ini.
              </p>
            </div>

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <UsersRound className="h-5 w-5" />
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Kontak BUMDes</p>
          <p className="mt-2 text-base font-bold text-slate-950">
            {tenantData.email || "-"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tenantData.nomor_whatsapp || "Nomor WhatsApp belum diisi."}
          </p>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Daftar Unit Usaha
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Unit usaha milik {tenantData.nama_bumdes}.
            </p>
          </div>

          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            Database Connected
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Jenis Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                  Status
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {unitList.length > 0 ? (
                unitList.map((unit) => (
                  <tr key={unit.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-950">
                        {unit.nama_unit}
                      </div>
                      <div className="text-xs text-slate-500">
                        {unit.kode_unit}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {unit.jenis_unit}
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        {unit.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-10 text-center text-sm text-slate-500"
                  >
                    Belum ada unit usaha. Direktur BUMDes dapat membuat unit pada menu Unit Usaha.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
