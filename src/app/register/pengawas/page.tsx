export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { PengawasRegistrationForm } from "@/components/register/pengawas-registration-form";

export default async function RegisterPengawasPage() {
  const admin = createAdminClient();

  const { data } = await admin
    .from("tenants")
    .select("id, nama_bumdes, kode_bumdes, nama_desa, nama_kecamatan")
    .order("nama_bumdes", { ascending: true });

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Login
        </Link>

        <Link
          href="/register"
          className="rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 shadow-sm transition hover:text-emerald-700"
        >
          Daftar BUMDes
        </Link>
      </div>

      <PengawasRegistrationForm tenants={data ?? []} />
    </main>
  );
}
