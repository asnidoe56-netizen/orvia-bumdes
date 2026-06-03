"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function parseCurrency(value: FormDataEntryValue | null) {
  const raw = clean(value);

  if (!raw) return 0;

  const normalized = raw
    .replace(/\s/g, "")
    .replace(/Rp/gi, "")
    .replace(/\./g, "")
    .replace(",", ".");

  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error("Harga jual tidak valid.");
  }

  return amount;
}

export async function createItemPrice(itemId: string, formData: FormData) {
  const supabase = await createClient();
  const context = await getLoginContext();

  if (!context?.tenant_id || !context?.unit_id) {
    throw new Error("Konteks unit tidak ditemukan.");
  }

  const priceType = clean(formData.get("price_type")) || "retail";
  const salesPrice = parseCurrency(formData.get("sales_price"));
  const effectiveFrom = clean(formData.get("effective_from"));
  const reason = clean(formData.get("reason"));

  if (!itemId) {
    throw new Error("Item tidak valid.");
  }

  if (salesPrice < 0) {
    throw new Error("Harga jual tidak boleh negatif.");
  }

  if (!effectiveFrom) {
    throw new Error("Tanggal berlaku wajib diisi.");
  }

  const { error } = await supabase.rpc("create_inventory_item_price", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_item_id: itemId,
    p_price_type: priceType,
    p_sales_price: salesPrice,
    p_effective_from: effectiveFrom,
    p_reason: reason || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/unit/dashboard/master-data/items");
  revalidatePath("/unit/dashboard/daftar-stok");
  revalidatePath(`/unit/dashboard/master-data/items/${itemId}/prices`);
}