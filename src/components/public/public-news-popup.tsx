"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import type { PublicNewsPost } from "@/lib/public/landing-content";

type PublicNewsPopupProps = {
  newsPosts: PublicNewsPost[];
};

function getPositionClass(position: string) {
  if (position === "top-left") {
    return "left-4 top-24 sm:left-6";
  }

  if (position === "bottom-right") {
    return "bottom-6 right-4 sm:right-6";
  }

  if (position === "bottom-left") {
    return "bottom-6 left-4 sm:left-6";
  }

  return "right-4 top-24 sm:right-6";
}

export function PublicNewsPopup({ newsPosts }: PublicNewsPopupProps) {
  const popupNews = useMemo(
    () =>
      newsPosts.find(
        (post) => post.popup_enabled && Boolean(post.link_href),
      ),
    [newsPosts],
  );

  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!popupNews || isDismissed) return;

    const delaySeconds = Math.max(0, popupNews.popup_delay_seconds ?? 5);
    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, delaySeconds * 1000);

    return () => window.clearTimeout(timer);
  }, [popupNews, isDismissed]);

  if (!popupNews || !isVisible || isDismissed) {
    return null;
  }

  return (
    <div
      className={[
        "fixed z-50 w-[calc(100vw-2rem)] max-w-sm transition-all duration-500",
        getPositionClass(popupNews.popup_position),
      ].join(" ")}
    >
      <div className="overflow-hidden rounded-[1.5rem] border border-emerald-100 bg-white shadow-2xl shadow-emerald-950/20">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">
              Berita Terbaru
            </p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              ORVIA-BUMDES
            </p>
          </div>

          <button
            type="button"
            aria-label="Tutup popup berita"
            onClick={() => {
              setIsDismissed(true);
              setIsVisible(false);
            }}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <a
          href={popupNews.link_href ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="block"
        >
          {popupNews.cover_image_url ? (
            <div className="relative h-40 w-full">
              <Image
                src={popupNews.cover_image_url}
                alt={popupNews.title}
                fill
                sizes="384px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-32 w-full items-center justify-center bg-emerald-50 text-sm font-black text-emerald-700">
              ORVIA-BUMDES
            </div>
          )}

          <div className="p-4">
            <h2 className="line-clamp-2 text-lg font-black leading-snug text-slate-950">
              {popupNews.title}
            </h2>

            <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
              {popupNews.excerpt ?? "Klik untuk membaca berita selengkapnya."}
            </p>

            <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2 text-xs font-black text-white">
              Baca Berita
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
        </a>
      </div>
    </div>
  );
}

