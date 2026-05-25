"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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