"use server";

import { revalidatePath } from "next/cache";
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

export async function createMasterItem(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const itemCode = getRequiredString(
    formData,
    "item_code",
    "Kode item wajib diisi."
  ).toUpperCase();

  const itemName = getRequiredString(
    formData,
    "item_name",
    "Nama item wajib diisi."
  );

  const unitOfMeasure =
    getOptionalString(formData, "unit_of_measure") ?? "pcs";

  const itemType =
    getOptionalString(formData, "item_type") ?? "stock";

  const description = getOptionalString(formData, "description");

  const minimumStockRaw = String(formData.get("minimum_stock") ?? "0").trim();
  const minimumStock = Number(minimumStockRaw || 0);

  if (Number.isNaN(minimumStock) || minimumStock < 0) {
    throw new Error("Minimum stok harus berupa angka dan tidak boleh negatif.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_inventory_item", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_item_code: itemCode,
    p_item_name: itemName,
    p_description: description,
    p_unit_of_measure: unitOfMeasure,
    p_item_type: itemType,
    p_minimum_stock: minimumStock,
    p_inventory_account_id: null,
    p_sales_account_id: null,
    p_cogs_account_id: null,
    p_cost_account_id: null,
  });

  if (error) {
    throw new Error(error.message || "Item gagal disimpan.");
  }

  revalidatePath("/unit/dashboard/master-data");
  revalidatePath("/unit/dashboard/master-data/items");
  revalidatePath("/unit/dashboard");
}

export async function createMasterSupplier(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const supplierCode = getRequiredString(
    formData,
    "supplier_code",
    "Kode supplier wajib diisi."
  ).toUpperCase();

  const supplierName = getRequiredString(
    formData,
    "supplier_name",
    "Nama supplier wajib diisi."
  );

  const phone = getOptionalString(formData, "phone");
  const email = getOptionalString(formData, "email");
  const address = getOptionalString(formData, "address");

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_supplier", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_supplier_code: supplierCode,
    p_supplier_name: supplierName,
    p_phone: phone,
    p_email: email,
    p_address: address,
  });

  if (error) {
    throw new Error(error.message || "Supplier gagal disimpan.");
  }

  revalidatePath("/unit/dashboard/master-data");
  revalidatePath("/unit/dashboard/master-data/suppliers");
}

export async function createMasterCustomer(formData: FormData) {
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

  revalidatePath("/unit/dashboard/master-data");
  revalidatePath("/unit/dashboard/master-data/customers");
}

