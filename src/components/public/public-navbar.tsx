"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Menu, X } from "lucide-react";
import { useState } from "react";
import { publicNavItems } from "@/components/public/landing-data";
import type { PublicSiteSettings } from "@/lib/public/landing-content";

type PublicNavbarProps = {
  siteSettings?: PublicSiteSettings;
};

export function PublicNavbar({ siteSettings }: PublicNavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const brandName = siteSettings?.brand_name || "ORVIA-BUMDES";
  const brandSubtitle =
    siteSettings?.brand_subtitle || "Core Global Governance Engine";
  const logoUrl = siteSettings?.logo_url ?? null;
  const primaryCtaLabel = siteSettings?.primary_cta_label || "Signup";
  const primaryCtaHref = siteSettings?.primary_cta_href || "/register";
  const secondaryCtaLabel = siteSettings?.secondary_cta_label || "Login";
  const secondaryCtaHref = siteSettings?.secondary_cta_href || "/login";

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200/70 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-700 text-white shadow-lg shadow-emerald-200">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={`Logo ${brandName}`}
                  fill
                  unoptimized
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <Building2 className="h-6 w-6" />
              )}
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-black uppercase tracking-[0.28em] text-emerald-700">
                {brandName}
              </p>
              <p className="truncate text-sm font-bold text-slate-900">
                {brandSubtitle}
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {publicNavItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-3 sm:flex">
            <Link
              href={secondaryCtaHref}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-black text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              {secondaryCtaLabel}
            </Link>
            <Link
              href={primaryCtaHref}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-200 transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              {primaryCtaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button
            type="button"
            aria-label="Buka menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm transition hover:bg-slate-50 lg:hidden"
            onClick={() => setIsMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {isMenuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setIsMenuOpen(false)}
          />

          <aside className="absolute right-4 top-4 flex h-fit max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] flex-col overflow-y-auto rounded-[2rem] border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-emerald-700 text-white">
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      alt={`Logo ${brandName}`}
                      fill
                      unoptimized
                      sizes="40px"
                      className="object-cover"
                    />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate text-xs font-black uppercase tracking-[0.25em] text-emerald-700">
                    {brandName}
                  </p>
                  <p className="mt-1 truncate text-sm font-bold text-slate-900">
                    Menu Publik
                  </p>
                </div>
              </div>

              <button
                type="button"
                aria-label="Tutup menu"
                className="rounded-xl p-2 text-slate-600 hover:bg-slate-100"
                onClick={() => setIsMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="mt-8 space-y-2">
              {publicNavItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex rounded-2xl px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5">
              <Link
                href={secondaryCtaHref}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-800 shadow-sm"
                onClick={() => setIsMenuOpen(false)}
              >
                {secondaryCtaLabel}
              </Link>
              <Link
                href={primaryCtaHref}
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-center text-sm font-black text-white shadow-lg shadow-emerald-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {primaryCtaLabel}
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
