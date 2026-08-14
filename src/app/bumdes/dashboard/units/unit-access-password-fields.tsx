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

  // Ketidakcocokan password adalah kegagalan tersering saat membuat unit — dan
  // paling sering karena password manager browser hanya mengisi satu kolom.
  // Dicocokkan di sini supaya ketahuan sebelum form dikirim, bukan sesudahnya.
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isTooShort = password.length > 0 && password.length < 8;
  const isMismatch = confirmPassword.length > 0 && password !== confirmPassword;

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
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={isTooShort}
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

        {isTooShort ? (
          <span className="block text-xs font-semibold text-red-600">
            Password minimal 8 karakter.
          </span>
        ) : null}
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
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={isMismatch}
            className={`w-full rounded-xl border px-3 py-2 pr-11 text-sm outline-none focus:ring-2 ${
              isMismatch
                ? "border-red-300 focus:border-red-500 focus:ring-red-100"
                : "border-slate-200 focus:border-emerald-500 focus:ring-emerald-100"
            }`}
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

        {isMismatch ? (
          <span role="alert" className="block text-xs font-semibold text-red-600">
            Konfirmasi password belum sama. Klik ikon mata untuk membandingkan.
          </span>
        ) : null}
      </label>
    </div>
  );
}
