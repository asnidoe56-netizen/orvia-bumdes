import Link from "next/link";
import { ArrowLeft, Landmark, UsersRound } from "lucide-react";
import { BumdesRegistrationForm } from "@/components/register/bumdes-registration-form";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Login
        </Link>

        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href="/register/pendamping"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 shadow-sm transition hover:text-emerald-700"
          >
            <UsersRound className="h-3.5 w-3.5" />
            Daftar Pendamping
          </Link>

          <Link
            href="/register/bupati"
            className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 shadow-sm transition hover:text-emerald-700"
          >
            <Landmark className="h-3.5 w-3.5" />
            Daftar Bupati
          </Link>
        </div>
      </div>

      <BumdesRegistrationForm />
    </main>
  );
}

