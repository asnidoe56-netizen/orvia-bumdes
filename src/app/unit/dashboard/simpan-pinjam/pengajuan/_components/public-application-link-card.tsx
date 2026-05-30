"use client";

import { useMemo, useState } from "react";

type PublicApplicationLinkCardProps = {
  publicUrlPath: string | null;
  title: string | null;
  isActive: boolean;
};

export function PublicApplicationLinkCard({
  publicUrlPath,
  title,
  isActive,
}: PublicApplicationLinkCardProps) {
  const [copied, setCopied] = useState(false);

  const publicUrl = useMemo(() => {
    if (!publicUrlPath) return null;

    if (typeof window === "undefined") {
      return publicUrlPath;
    }

    return `${window.location.origin}${publicUrlPath}`;
  }, [publicUrlPath]);

  async function handleCopy() {
    if (!publicUrl) return;

    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);

    window.setTimeout(() => {
      setCopied(false);
    }, 2000);
  }

  return (
    <section className="min-w-0 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Link Pengajuan Publik
          </p>
          <h2 className="mt-2 text-lg font-bold text-slate-950">
            Bagikan Form Pengajuan Pinjaman
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Link ini dapat diberikan kepada calon anggota atau kelompok agar
            mereka mengajukan pinjaman sendiri tanpa login. Setiap pengajuan
            tetap masuk sebagai pending_verification dan harus diverifikasi
            petugas unit.
          </p>

          {publicUrl ? (
            <div className="mt-4 min-w-0 rounded-2xl border border-emerald-200 bg-white px-4 py-3">
              <p className="text-xs font-semibold text-slate-500">
                {title || "Form Pengajuan Pinjaman"}
              </p>
              <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                {publicUrl}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
              Link publik belum tersedia untuk unit ini.
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
          <span
            className={[
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
              isActive
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-600",
            ].join(" ")}
          >
            {isActive ? "Aktif" : "Tidak aktif"}
          </span>

          <button
            type="button"
            onClick={handleCopy}
            disabled={!publicUrl || !isActive}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {copied ? "Link Disalin" : "Salin Link"}
          </button>
        </div>
      </div>
    </section>
  );
}