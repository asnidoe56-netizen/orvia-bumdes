"use client";

import { useRef, useState, useTransition } from "react";
import { Eye, EyeOff, LockKeyhole, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBumdesUnitUser } from "./actions";

type AddUserDialogProps = {
  units: {
    id: string;
    kode_unit: string;
    nama_unit: string;
    jenis_unit: string;
    status: string;
  }[];
};

function PasswordInput({
  name,
  label,
  placeholder,
}: {
  name: string;
  label: string;
  placeholder: string;
}) {
  const [show, setShow] = useState(false);

  return (
    <label className="space-y-2">
      <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <LockKeyhole className="h-4 w-4" />
        {label}
      </span>

      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          minLength={8}
          required
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 pr-11 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
        <button
          type="button"
          onClick={() => setShow((current) => !current)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-emerald-700"
          aria-label={show ? "Sembunyikan password" : "Lihat password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}

export function AddUserDialog({ units }: AddUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const activeUnits = units.filter((unit) =>
    ["aktif", "active"].includes(unit.status.toLowerCase()),
  );

  function closeDialog() {
    if (isPending) return;

    setOpen(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    formRef.current?.reset();
  }

  function handleSubmit(formData: FormData) {
    setErrorMessage(null);
    setSuccessMessage(null);

    startTransition(async () => {
      try {
        const result = await createBumdesUnitUser(formData);
        setSuccessMessage(result.message);
        formRef.current?.reset();
        window.location.reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Pengguna gagal ditambahkan.",
        );
      }
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Tambah Pengguna
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm md:p-6">
          <div className="min-h-full w-full max-w-2xl py-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5">
                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Tambah Pengguna
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Buat akun operator unit, lalu simpan ke Auth, profil, role,
                    dan kredensial akses unit.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Tutup dialog tambah pengguna"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form ref={formRef} action={handleSubmit} className="space-y-5 p-5">
                {errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                {successMessage ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                    {successMessage}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Nama *
                    </span>
                    <input
                      name="full_name"
                      required
                      placeholder="Nama lengkap pengguna"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Unit Usaha *
                    </span>
                    <select
                      name="unit_id"
                      required
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      <option value="">Pilih unit usaha</option>
                      {activeUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.nama_unit} ({unit.kode_unit})
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 md:col-span-2">
                    <span className="text-sm font-semibold text-slate-700">
                      Email *
                    </span>
                    <input
                      name="email"
                      type="email"
                      required
                      placeholder="pengguna@email.com"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    />
                  </label>

                  <PasswordInput
                    name="password"
                    label="Password *"
                    placeholder="Minimal 8 karakter"
                  />

                  <PasswordInput
                    name="confirm_password"
                    label="Konfirmasi Password *"
                    placeholder="Ulangi password"
                  />
                </div>

                {activeUnits.length === 0 ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-700">
                    Belum ada unit usaha aktif. Buat unit usaha terlebih dahulu.
                  </div>
                ) : null}

                <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={closeDialog}
                    disabled={isPending}
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    disabled={isPending || activeUnits.length === 0}
                  >
                    {isPending ? "Menyimpan..." : "Simpan Pengguna"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
