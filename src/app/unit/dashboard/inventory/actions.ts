"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

export async function createInventoryItem(formData: FormData) {
  const context = await getLoginContext();

  if (!context || !context.tenant_id || !context.unit_id) {
    throw new Error("Sesi login unit tidak valid.");
  }

  const itemCode = String(formData.get("item_code") ?? "").trim().toUpperCase();
  const itemName = String(formData.get("item_name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const unitOfMeasure = String(formData.get("unit_of_measure") ?? "pcs").trim();
  const itemType = String(formData.get("item_type") ?? "stock").trim();
  const minimumStockRaw = String(formData.get("minimum_stock") ?? "0").trim();

  const inventoryAccountId = String(formData.get("inventory_account_id") ?? "") || null;
  const salesAccountId = String(formData.get("sales_account_id") ?? "") || null;
  const cogsAccountId = String(formData.get("cogs_account_id") ?? "") || null;
  const costAccountId = String(formData.get("cost_account_id") ?? "") || null;

  const minimumStock = Number(minimumStockRaw || 0);

  if (!itemCode) throw new Error("Kode item wajib diisi.");
  if (!itemName) throw new Error("Nama item wajib diisi.");
  if (!unitOfMeasure) throw new Error("Satuan wajib diisi.");
  if (!["stock", "service", "non_stock"].includes(itemType)) {
    throw new Error("Tipe item tidak valid.");
  }
  if (Number.isNaN(minimumStock) || minimumStock < 0) {
    throw new Error("Minimum stok harus angka dan tidak boleh negatif.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_inventory_item", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_item_code: itemCode,
    p_item_name: itemName,
    p_description: description || null,
    p_unit_of_measure: unitOfMeasure,
    p_item_type: itemType,
    p_minimum_stock: minimumStock,
    p_inventory_account_id: inventoryAccountId,
    p_sales_account_id: salesAccountId,
    p_cogs_account_id: cogsAccountId,
    p_cost_account_id: costAccountId,
  });

  if (error) {
    throw new Error(error.message || "Item persediaan gagal dibuat.");
  }

  revalidatePath("/unit/dashboard");
  revalidatePath("/unit/dashboard/inventory");
}
