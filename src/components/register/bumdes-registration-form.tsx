"use client";

import { useActionState } from "react";
import {
  Building2,
  CheckCircle2,
  Loader2,
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
            Ajukan BUMDes baru untuk diverifikasi dan disetujui oleh platform.
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
            Data Pemohon
          </h2>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <UserRound className="h-4 w-4" />
                Nama Pemohon
              </span>
              <Input
                name="requester_name"
                placeholder="Nama lengkap pemohon"
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
                Email Pemohon
              </span>
              <Input
                name="requester_email"
                type="email"
                placeholder="pemohon@email.com"
              />
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
