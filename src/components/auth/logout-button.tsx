"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  function handleLogout() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    window.location.href = "/auth/logout";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      <span>{isLoggingOut ? "Keluar..." : "Logout"}</span>
    </button>
  );
}
