"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPinned,
  Phone,
  UserRound,
  UsersRound,
} from "lucide-react";
import {
  submitPendampingRegistration,
  type RegisterPendampingState,
} from "@/app/register/pendamping/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: RegisterPendampingState = {
  success: false,
  message: "",
};

export function PendampingRegistrationForm() {
  const [state, formAction, isPending] = useActionState(
    submitPendampingRegistration,
    initialState
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <UsersRound className="h-5 w-5" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Pendaftaran Pendamping Kecamatan
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ajukan akun Pendamping Kecamatan. Setelah disetujui Admin Platform,
            akun ini hanya dapat mereview proposal BUMDes sesuai wilayah kecamatan tugas.
          </p>
        </div>
      </div>

      {state.message ? (
        <div
          className={[
            "mb-5 rounded-2xl border px-4 py-3 text-sm font-medium",
            state.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          <div className="flex items-center gap-2">
            {state.success ? <CheckCircle2 className="h-4 w-4" /> : null}
            <span>{state.message}</span>
          </div>
        </div>
      ) : null}

      <form action={formAction} className="space-y-8">
        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Data Pendamping
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound className="h-4 w-4" />
                Nama Lengkap *
              </span>
              <Input
                name="full_name"
                placeholder="Contoh: Pendamping Kecamatan Kwandang"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail className="h-4 w-4" />
                Email Login *
              </span>
              <Input
                name="email"
                type="email"
                placeholder="pendamping.kwandang@email.com"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone className="h-4 w-4" />
                Nomor HP
              </span>
              <Input
                name="phone"
                placeholder="Contoh: 081234567890"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPinned className="h-4 w-4" />
                Kecamatan Tugas *
              </span>
              <Input
                name="nama_kecamatan"
                placeholder="Contoh: KWANDANG"
                required
              />
              <p className="text-xs text-slate-500">
                Harus sama dengan nama kecamatan tenant/BUMDes yang akan didampingi.
              </p>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Instansi / Keterangan
              </span>
              <Input
                name="instansi"
                placeholder="Contoh: Pendamping Desa / Kecamatan / Dinas terkait"
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Catatan Tambahan
              </span>
              <textarea
                name="notes"
                placeholder="Catatan tambahan untuk Admin Platform"
                className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Password Login
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <LockKeyhole className="h-4 w-4" />
                Password *
              </span>

              <div className="relative">
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimal 8 karakter"
                  minLength={8}
                  required
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition hover:text-emerald-700"
                  aria-label={showPassword ? "Sembunyikan password" : "Lihat password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <p className="text-xs text-slate-500">
                Password ini dipakai untuk login setelah akun disetujui.
              </p>
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <LockKeyhole className="h-4 w-4" />
                Konfirmasi Password *
              </span>

              <div className="relative">
                <Input
                  name="confirm_password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Ulangi password"
                  minLength={8}
                  required
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition hover:text-emerald-700"
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
        </section>

        <div className="flex justify-end border-t border-slate-200 pt-5">
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Mengirim...
              </>
            ) : (
              "Kirim Pendaftaran Pendamping"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
