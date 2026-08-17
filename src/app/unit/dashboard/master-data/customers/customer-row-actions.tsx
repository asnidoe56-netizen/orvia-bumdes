"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { deleteCustomerAction, updateCustomerAction } from "./actions";

export type CustomerRecord = {
  id: string;
  customer_code: string;
  customer_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export function CustomerRowActions({ customer }: { customer: CustomerRecord }) {
  const router = useRouter();
  const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeDialog() {
    if (isPending) return;

    setOpenDialog(null);
    setErrorMessage(null);
  }

  /**
   * Server Function-nya mengembalikan kegagalan sebagai nilai, jadi pesan
   * engine ("customer sudah dipakai N transaksi") sampai apa adanya ke layar.
   */
  function runAction(
    action: typeof updateCustomerAction,
    formData: FormData,
    fallbackMessage: string
  ) {
    setErrorMessage(null);

    startTransition(async () => {
      try {
        const result = await action(formData);

        if (!result.ok) {
          setErrorMessage(result.message);
          return;
        }

        setOpenDialog(null);
        router.refresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : fallbackMessage
        );
      }
    });
  }

  function handleUpdate(formData: FormData) {
    formData.set("customer_id", customer.id);
    runAction(updateCustomerAction, formData, "Customer gagal diperbarui.");
  }

  function handleDelete() {
    const formData = new FormData();
    formData.set("customer_id", customer.id);
    runAction(deleteCustomerAction, formData, "Customer gagal dihapus.");
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpenDialog("edit")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
          aria-label={`Ubah customer ${customer.customer_name}`}
          title={`Ubah customer ${customer.customer_name}`}
        >
          <Pencil className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setOpenDialog("delete")}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          aria-label={`Hapus customer ${customer.customer_name}`}
          title={`Hapus customer ${customer.customer_name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <Dialog
        open={openDialog === "edit"}
        title="Ubah Customer"
        description="Perubahan berlaku untuk transaksi baru. Transaksi yang sudah tercatat tetap memakai data lamanya."
        onClose={closeDialog}
      >
        <form action={handleUpdate} className="space-y-4">
          {errorMessage ? (
            <p
              aria-live="polite"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-4">
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Kode Customer
              </span>
              <input
                name="customer_code"
                required
                defaultValue={customer.customer_code}
                className={`${fieldClass} uppercase`}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nama Customer
              </span>
              <input
                name="customer_name"
                required
                defaultValue={customer.customer_name}
                className={fieldClass}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Nomor Telepon
              </span>
              <input
                name="phone"
                defaultValue={customer.phone ?? ""}
                placeholder="Nomor telepon"
                className={fieldClass}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">
                Email
              </span>
              <input
                name="email"
                type="email"
                defaultValue={customer.email ?? ""}
                placeholder="email@contoh.com"
                className={fieldClass}
              />
            </label>

            <label className="space-y-2 col-span-full">
              <span className="text-sm font-semibold text-slate-700">
                Alamat
              </span>
              <textarea
                name="address"
                rows={3}
                defaultValue={customer.address ?? ""}
                placeholder="Alamat customer"
                className={fieldClass}
              />
            </label>

            <label className="space-y-2 col-span-full">
              <span className="text-sm font-semibold text-slate-700">
                Status
              </span>
              <select
                name="is_active"
                defaultValue={customer.is_active ? "true" : "false"}
                className={fieldClass}
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
              <span className="block text-xs leading-5 text-slate-500">
                Customer nonaktif tidak bisa dipilih pada transaksi penjualan
                baru, tetapi riwayatnya tetap tersimpan.
              </span>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={closeDialog}
              disabled={isPending}
            >
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={openDialog === "delete"}
        title="Hapus Customer"
        description="Tindakan ini permanen dan tidak bisa dibatalkan."
        onClose={closeDialog}
      >
        <div className="space-y-4">
          {errorMessage ? (
            <p
              aria-live="polite"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}

          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <p className="text-base font-black text-slate-950">
                {customer.customer_name}
              </p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                {customer.customer_code}
              </p>
            </div>
          </div>

          <p className="text-sm leading-6 text-slate-600">
            Customer yang sudah dipakai pada transaksi penjualan tidak bisa
            dihapus. Untuk kasus itu, ubah statusnya menjadi nonaktif lewat
            tombol ubah.
          </p>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:justify-end">
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
              disabled={isPending}
            >
              {isPending ? "Menghapus..." : "Hapus Customer"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
