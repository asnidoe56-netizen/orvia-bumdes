export const dynamic = "force-dynamic";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getLoginContext } from "@/lib/auth/get-login-context";

export default async function TenantSuspendedPage() {
  const context = await getLoginContext();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-xl rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <ShieldAlert className="h-7 w-7" />
        </div>

        <p className="mt-5 text-xs font-black uppercase tracking-wide text-amber-700">
          Akses Tenant Ditangguhkan
        </p>

        <h1 className="mt-2 text-2xl font-black text-slate-950">
          BUMDes sedang disuspend
        </h1>

        <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
          Akses ke dashboard BUMDes dan Unit untuk tenant ini sedang dinonaktifkan sementara oleh Admin Platform.
          Silakan hubungi Admin Platform untuk klarifikasi atau aktivasi kembali.
        </p>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm">
          <div className="flex justify-between gap-3 border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-500">User ID</span>
            <span className="font-black text-slate-800">{context?.user_id?.slice(0, 8) ?? "-"}...</span>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-200 py-2">
            <span className="font-bold text-slate-500">Role</span>
            <span className="font-black text-slate-800">{context?.role ?? "-"}</span>
          </div>
          <div className="flex justify-between gap-3 pt-2">
            <span className="font-bold text-slate-500">Status Tenant</span>
            <span className="font-black text-amber-700">{context?.tenant_status ?? "suspended"}</span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/auth/logout"
            className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-black text-white transition hover:bg-slate-800"
          >
            Keluar
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Kembali ke Login
          </Link>
        </div>
      </section>
    </main>
  );
}
