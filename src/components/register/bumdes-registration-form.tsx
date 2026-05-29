"use client";

import { useActionState, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import {
  submitBumdesRegistration,
  type RegisterBumdesState,
} from "@/app/register/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: RegisterBumdesState = {
  success: false,
  message: "",
};

export function BumdesRegistrationForm() {
  const [state, formAction, isPending] = useActionState(
    submitBumdesRegistration,
    initialState
  );

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <div className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <Building2 className="h-5 w-5" />
        </div>

        <div>
          <h1 className="text-2xl font-bold text-slate-950">
            Pendaftaran BUMDes
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Ajukan BUMDes baru untuk diverifikasi platform. Email dan password
            pemohon akan menjadi akses direktur setelah disetujui.
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
            Data BUMDes
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama BUMDes *
              </span>
              <Input
                name="nama_bumdes"
                placeholder="Contoh: BUMDes Maju Bersama"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Kode BUMDes *
              </span>
              <Input
                name="kode_bumdes"
                placeholder="Contoh: BMD-MAJU"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Desa *
              </span>
              <Input
                name="nama_desa"
                placeholder="Contoh: Desa Maju"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Kecamatan *
              </span>
              <Input
                name="nama_kecamatan"
                placeholder="Contoh: Kecamatan Sejahtera"
                required
              />
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <MapPin className="h-4 w-4" />
                Alamat
              </span>
              <Input
                name="alamat"
                placeholder="Alamat kantor / lokasi BUMDes"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone className="h-4 w-4" />
                Nomor WhatsApp BUMDes
              </span>
              <Input
                name="nomor_whatsapp"
                placeholder="Contoh: 081234567890"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail className="h-4 w-4" />
                Email BUMDes
              </span>
              <Input
                name="email"
                type="email"
                placeholder="contoh@bumdes.id"
              />
            </label>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Data Pemohon / Calon Direktur
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound className="h-4 w-4" />
                Nama Pemohon *
              </span>
              <Input
                name="requester_name"
                placeholder="Nama lengkap pemohon"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Phone className="h-4 w-4" />
                No. HP Pemohon
              </span>
              <Input
                name="requester_phone"
                placeholder="Contoh: 081234567890"
              />
            </label>

            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Mail className="h-4 w-4" />
                Email Login Pemohon *
              </span>
              <Input
                name="requester_email"
                type="email"
                placeholder="pemohon@email.com"
                required
              />
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <LockKeyhole className="h-4 w-4" />
                Password Login *
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
                Password ini dipakai untuk login setelah BUMDes disetujui.
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
                  onClick={() =>
                    setShowConfirmPassword((current) => !current)
                  }
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
              "Kirim Pendaftaran"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
