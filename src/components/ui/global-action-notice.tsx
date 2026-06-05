"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";

type NoticeVariant = "success" | "error" | "warning" | "info";

type NoticeState = {
  variant: NoticeVariant;
  title: string;
  message: string;
};

const queryKeys = [
  "success",
  "error",
  "warning",
  "info",
  "created",
  "posted",
  "submitted",
  "approved",
  "rejected",
  "validated",
  "review",
  "periods_prepared",
] as const;

const legacyMessages: Record<string, NoticeState> = {
  created: {
    variant: "success",
    title: "Berhasil",
    message: "Data berhasil dibuat.",
  },
  posted: {
    variant: "success",
    title: "Berhasil",
    message: "Data berhasil diposting.",
  },
  submitted: {
    variant: "success",
    title: "Berhasil",
    message: "Data berhasil diajukan.",
  },
  approved: {
    variant: "success",
    title: "Berhasil",
    message: "Data berhasil disetujui.",
  },
  rejected: {
    variant: "warning",
    title: "Ditolak",
    message: "Data berhasil ditolak.",
  },
  validated: {
    variant: "success",
    title: "Berhasil",
    message: "Data berhasil divalidasi.",
  },
  review: {
    variant: "info",
    title: "Perlu Tinjauan",
    message: "Data siap ditinjau.",
  },
  periods_prepared: {
    variant: "success",
    title: "Berhasil",
    message: "Periode berhasil disiapkan.",
  },
};

const variantStyles: Record<NoticeVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
  error: "border-rose-200 bg-rose-50 text-rose-950",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  info: "border-sky-200 bg-sky-50 text-sky-950",
};

const iconStyles: Record<NoticeVariant, string> = {
  success: "bg-emerald-600 text-white",
  error: "bg-rose-600 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-sky-600 text-white",
};

function buildNoticeFromSearch(search: string): NoticeState | null {
  const params = new URLSearchParams(search);

  const error = params.get("error");
  if (error) {
    return {
      variant: "error",
      title: "Gagal",
      message: error,
    };
  }

  const success = params.get("success");
  if (success) {
    return {
      variant: "success",
      title: "Berhasil",
      message: success,
    };
  }

  const warning = params.get("warning");
  if (warning) {
    return {
      variant: "warning",
      title: "Perhatian",
      message: warning,
    };
  }

  const info = params.get("info");
  if (info) {
    return {
      variant: "info",
      title: "Informasi",
      message: info,
    };
  }

  for (const key of queryKeys) {
    if (legacyMessages[key] && params.has(key)) {
      return legacyMessages[key];
    }
  }

  return null;
}

function getInitialNotice() {
  if (typeof window === "undefined") {
    return null;
  }

  return buildNoticeFromSearch(window.location.search);
}

function cleanNoticeQueryFromUrl() {
  const url = new URL(window.location.href);

  queryKeys.forEach((key) => {
    url.searchParams.delete(key);
  });

  window.history.replaceState(
    window.history.state,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

function NoticeIcon({ variant }: { variant: NoticeVariant }) {
  if (variant === "success") {
    return <CheckCircle2 className="h-5 w-5" />;
  }

  if (variant === "error") {
    return <XCircle className="h-5 w-5" />;
  }

  if (variant === "warning") {
    return <AlertTriangle className="h-5 w-5" />;
  }

  return <Info className="h-5 w-5" />;
}

export function GlobalActionNotice() {
  const [notice, setNotice] = useState<NoticeState | null>(getInitialNotice);

  useEffect(() => {
    if (!notice) {
      return;
    }

    cleanNoticeQueryFromUrl();

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 4500);

    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  if (!notice) {
    return null;
  }

  return (
    <div className="fixed inset-x-4 top-20 z-[80] flex justify-end print:hidden sm:inset-x-auto sm:right-5 sm:w-[420px]">
      <div
        className={`w-full rounded-3xl border p-4 shadow-xl shadow-slate-900/10 backdrop-blur ${variantStyles[notice.variant]}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconStyles[notice.variant]}`}
          >
            <NoticeIcon variant={notice.variant} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">{notice.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-85">
              {notice.message}
            </p>
          </div>

          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            className="rounded-xl p-1 opacity-60 transition hover:bg-white/60 hover:opacity-100"
            onClick={() => setNotice(null)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
