"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type PageBackButtonProps = {
  fallbackHref?: string;
  label?: string;
};

export function PageBackButton({
  fallbackHref = "/unit/dashboard",
  label = "Kembali",
}: PageBackButtonProps) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <div className="sticky top-24 z-30 mb-3 flex w-fit">
      <button
        type="button"
        onClick={handleBack}
        className="group inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-3 py-2 text-sm font-bold text-emerald-800 shadow-lg shadow-slate-200/70 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-600 hover:text-white hover:shadow-xl sm:px-4 sm:py-2.5"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 transition group-hover:bg-white/20 group-hover:text-white">
          <ArrowLeft className="h-4 w-4" />
        </span>

        <span>{label}</span>
      </button>
    </div>
  );
}
