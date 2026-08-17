"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBumdesUser } from "./actions";
import { DELETE_USER_CONFIRMATION } from "./constants";

type DeleteUserButtonProps = {
  roleId: string;
  name: string;
  login: string;
  roleLabel: string;
  unitLabel: string;
  /** Akun sendiri tidak boleh dihapus; tombolnya dimatikan sejak di layar. */
  isSelf: boolean;
};

export function DeleteUserButton({
  roleId,
  name,
  login,
  roleLabel,
  unitLabel,
  isSelf,
}: DeleteUserButtonProps) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isConfirmed =
    confirmation.trim().toUpperCase() === DELETE_USER_CONFIRMATION;

  function closeDialog() {
    if (isPending) return;

    setOpen(false);
    setConfirmation("");
    setErrorMessage(null);
  }

  function handleDelete() {
    setErrorMessage(null);

    const formData = new FormData();
    formData.set("role_id", roleId);
    formData.set("confirmation", confirmation);

    startTransition(async () => {
      try {
        const result = await deleteBumdesUser(formData);

        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }

        window.location.reload();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Pengguna gagal dihapus.",
        );
      }
    });
  }

  if (isSelf) {
    return (
      <span className="text-xs font-semibold text-slate-400">Akun Anda</span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
        aria-label={`Hapus pengguna ${name}`}
        title={`Hapus pengguna ${name}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm md:p-6">
          <div className="min-h-full w-full max-w-lg py-6">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-950">
                      Hapus Pengguna
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Tindakan ini permanen dan tidak bisa dibatalkan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isPending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Tutup dialog hapus pengguna"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                {errorMessage ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
                    {errorMessage}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-base font-black text-slate-950">{name}</p>
                  <p className="mt-1 break-all text-sm text-slate-600">{login}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {roleLabel} · {unitLabel}
                  </p>
                </div>

                <div className="text-sm leading-6 text-slate-600">
                  <p className="font-semibold text-slate-800">
                    Yang akan dihapus:
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Peran pengguna ini di BUMDes Anda.</li>
                    <li>Kredensial akses unitnya.</li>
                    <li>
                      Akun loginnya, hanya jika ia tidak lagi memegang peran di
                      unit atau BUMDes mana pun.
                    </li>
                  </ul>
                  <p className="mt-3">
                    Transaksi yang pernah dicatat pengguna ini tetap tersimpan.
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Ketik {DELETE_USER_CONFIRMATION} untuk mengonfirmasi
                  </span>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    autoComplete="off"
                    placeholder={DELETE_USER_CONFIRMATION}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  />
                </label>

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
                    type="button"
                    variant="danger"
                    onClick={handleDelete}
                    disabled={isPending || !isConfirmed}
                  >
                    {isPending ? "Menghapus..." : "Hapus Permanen"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
