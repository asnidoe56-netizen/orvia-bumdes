"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function getRequiredString(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function getOptionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

export async function createCustomerAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const customerCode = getRequiredString(
    formData,
    "customer_code",
    "Kode customer wajib diisi."
  ).toUpperCase();

  const customerName = getRequiredString(
    formData,
    "customer_name",
    "Nama customer wajib diisi."
  );

  const phone = getOptionalString(formData, "phone");
  const email = getOptionalString(formData, "email");
  const address = getOptionalString(formData, "address");

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_customer", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_customer_code: customerCode,
    p_customer_name: customerName,
    p_phone: phone,
    p_email: email,
    p_address: address,
  });

  if (error) {
    throw new Error(error.message || "Customer gagal disimpan.");
  }

  revalidatePath("/unit/dashboard/master-data/customers");
  revalidatePath("/unit/dashboard/master-data");

  redirect("/unit/dashboard/master-data/customers");
}

export type CustomerActionResult = {
  ok: boolean;
  message: string;
};

function failed(message: string): CustomerActionResult {
  return { ok: false, message };
}

/** RPC yang dipanggil tidak ada di database ini. */
function isMissingFunction(error: PostgrestError | null) {
  if (!error) return false;

  return error.code === "PGRST202" || /schema cache/i.test(error.message ?? "");
}

function missingEngineMessage(error: PostgrestError | null) {
  return (
    "Fungsi ubah/hapus customer belum ada di database Supabase, jadi tidak ada " +
    "yang berubah. Jalankan migrasi " +
    "20260817140000_create_customer_update_delete_engine.sql. " +
    `Detail: ${error?.message ?? ""}`
  );
}

/**
 * Seluruh aturan ubah customer ada di engine database `update_customer`: izin
 * pemanggil, batas tenant/unit, dan kode customer yang tidak boleh kembar.
 *
 * Kegagalan dikembalikan sebagai nilai, tidak dilempar. Error yang dilempar
 * dari Server Function di-set 500 oleh Next dan pesannya disamarkan di
 * produksi, sehingga operator cuma melihat layar gagal tanpa keterangan.
 */
export async function updateCustomerAction(
  formData: FormData
): Promise<CustomerActionResult> {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return failed("Sesi unit tidak valid. Silakan masuk ulang.");
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!customerId) {
    return failed("Customer tidak dikenali. Muat ulang halaman.");
  }

  const customerCode = String(formData.get("customer_code") ?? "")
    .trim()
    .toUpperCase();

  const customerName = String(formData.get("customer_name") ?? "").trim();

  if (!customerCode) {
    return failed("Kode customer wajib diisi.");
  }

  if (!customerName) {
    return failed("Nama customer wajib diisi.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("update_customer", {
    p_customer_id: customerId,
    p_customer_code: customerCode,
    p_customer_name: customerName,
    p_phone: getOptionalString(formData, "phone"),
    p_email: getOptionalString(formData, "email"),
    p_address: getOptionalString(formData, "address"),
    p_is_active: String(formData.get("is_active") ?? "true") === "true",
  });

  if (isMissingFunction(error)) {
    return failed(missingEngineMessage(error));
  }

  if (error) {
    return failed(error.message || "Customer gagal diperbarui.");
  }

  revalidatePath("/unit/dashboard/master-data/customers");
  revalidatePath("/unit/dashboard/master-data");

  return { ok: true, message: `Customer ${customerCode} berhasil diperbarui.` };
}

/**
 * Penghapusan ditolak engine kalau customer sudah dipakai transaksi; pesannya
 * mengarahkan operator untuk menonaktifkannya lewat form ubah.
 */
export async function deleteCustomerAction(
  formData: FormData
): Promise<CustomerActionResult> {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return failed("Sesi unit tidak valid. Silakan masuk ulang.");
  }

  const customerId = String(formData.get("customer_id") ?? "").trim();

  if (!customerId) {
    return failed("Customer tidak dikenali. Muat ulang halaman.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("delete_customer", {
    p_customer_id: customerId,
  });

  if (isMissingFunction(error)) {
    return failed(missingEngineMessage(error));
  }

  if (error) {
    return failed(error.message || "Customer gagal dihapus.");
  }

  revalidatePath("/unit/dashboard/master-data/customers");
  revalidatePath("/unit/dashboard/master-data");

  return { ok: true, message: "Customer berhasil dihapus." };
}