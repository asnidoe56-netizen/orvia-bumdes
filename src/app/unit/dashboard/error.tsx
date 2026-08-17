"use client";

// Sama seperti dashboard BUMDes: tanpa file ini, error server apa pun di
// dashboard unit jatuh ke layar bawaan Next.js ("This page couldn't load")
// tanpa konteks apa pun — yang di sisi petugas terbaca sebagai "error 500".
// Digest tetap ditampilkan supaya baris log di VPS bisa dicocokkan.

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function UnitDashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[unit/dashboard]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-[2rem] border border-red-100 bg-white p-6 shadow-sm shadow-slate-200/70 md:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <AlertTriangle className="h-6 w-6" />
        </div>

        <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
          Halaman gagal dimuat
        </h1>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Terjadi kesalahan di server saat memuat halaman ini. Data Anda tidak
          berubah. Coba muat ulang; kalau masih gagal, sampaikan kode di bawah ke
          tim teknis.
        </p>

        {error.digest ? (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 font-mono text-xs text-slate-700">
            Kode error: {error.digest}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => unstable_retry()}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:-translate-y-0.5 hover:bg-emerald-800"
        >
          <RotateCcw className="h-4 w-4" />
          Coba lagi
        </button>
      </div>
    </div>
  );
}
