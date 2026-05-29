"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

type UnitAccessPasswordFieldsProps = {
  className?: string;
  passwordName: string;
  confirmPasswordName: string;
  passwordLabel: string;
  confirmPasswordLabel: string;
  required?: boolean;
};

export function UnitAccessPasswordFields({
  className = "",
  passwordName,
  confirmPasswordName,
  passwordLabel,
  confirmPasswordLabel,
  required = false,
}: UnitAccessPasswordFieldsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className={`grid gap-4 md:grid-cols-2 ${className}`}>
      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LockKeyhole className="h-4 w-4" />
          {passwordLabel}
        </span>

        <div className="relative">
          <input
            name={passwordName}
            type={showPassword ? "text" : "password"}
            placeholder="Minimal 8 karakter"
            minLength={8}
            required={required}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-11 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-emerald-700"
            aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </label>

      <label className="space-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LockKeyhole className="h-4 w-4" />
          {confirmPasswordLabel}
        </span>

        <div className="relative">
          <input
            name={confirmPasswordName}
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Ulangi password"
            minLength={8}
            required={required}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-11 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-emerald-700"
            aria-label={
              showConfirmPassword
                ? "Sembunyikan konfirmasi password"
                : "Lihat konfirmasi password"
            }
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </label>
    </div>
  );
}
