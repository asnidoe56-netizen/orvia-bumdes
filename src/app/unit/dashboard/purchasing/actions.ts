"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";


function generatePurchaseInvoiceNo(paymentType: string) {
  const prefix = paymentType === "credit" ? "BK" : "BT";
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `${prefix}-${datePart}-${timePart}-${randomPart}`;
}
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

export async function createPurchaseInvoice(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const invoiceNo = getRequiredString(
    formData,
    "invoice_no",
    "Nomor invoice wajib diisi."
  ).toUpperCase();

  const invoiceDate = getRequiredString(
    formData,
    "invoice_date",
    "Tanggal invoice wajib diisi."
  );

  const supplierId = getRequiredString(
    formData,
    "supplier_id",
    "Supplier wajib dipilih."
  );

  const itemId = getRequiredString(
    formData,
    "item_id",
    "Item barang wajib dipilih."
  );

  const paymentType = getOptionalString(formData, "payment_type") ?? "cash";
  const dueDate = getOptionalString(formData, "due_date");
  const notes = getOptionalString(formData, "notes");
  const description = getOptionalString(formData, "description");

  const quantity = Number(String(formData.get("quantity") ?? "0").trim());
  const unitCost = Number(String(formData.get("unit_cost") ?? "0").trim());
  const discountAmount = Number(String(formData.get("discount_amount") ?? "0").trim());
  const taxAmount = Number(String(formData.get("tax_amount") ?? "0").trim());

  if (Number.isNaN(quantity) || quantity <= 0) {
    throw new Error("Quantity harus lebih dari 0.");
  }

  if (Number.isNaN(unitCost) || unitCost < 0) {
    throw new Error("Harga beli tidak boleh negatif.");
  }

  if (Number.isNaN(discountAmount) || discountAmount < 0) {
    throw new Error("Diskon tidak boleh negatif.");
  }

  if (Number.isNaN(taxAmount) || taxAmount < 0) {
    throw new Error("Pajak tidak boleh negatif.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_purchase_invoice", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_supplier_id: supplierId,
    p_invoice_no: invoiceNo,
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_payment_type: paymentType,
    p_notes: notes,
    p_lines: [
      {
        item_id: itemId,
        quantity,
        unit_cost: unitCost,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        description,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Draft pembelian gagal dibuat.");
  }

  revalidatePath("/unit/dashboard/purchasing");
  redirect("/unit/dashboard/purchasing");
}


export async function createAndPostPurchaseInvoice(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const requestedInvoiceNo = String(formData.get("invoice_no") ?? "").trim();
  const paymentType = getOptionalString(formData, "payment_type") ?? "cash";
  const invoiceNo = (requestedInvoiceNo || generatePurchaseInvoiceNo(paymentType)).toUpperCase();

  const invoiceDate = getRequiredString(
    formData,
    "invoice_date",
    "Tanggal pembelian wajib diisi."
  );

  const supplierId = getRequiredString(
    formData,
    "supplier_id",
    "Supplier wajib dipilih."
  );

  const itemId = getRequiredString(
    formData,
    "item_id",
    "Barang wajib dipilih."
  );

  const dueDate = getOptionalString(formData, "due_date");
  const notes = getOptionalString(formData, "notes");
  const description = getOptionalString(formData, "description");

  const quantity = Number(String(formData.get("quantity") ?? "0").trim());
  const unitCost = Number(String(formData.get("unit_cost") ?? "0").trim());
  const discountAmount = Number(String(formData.get("discount_amount") ?? "0").trim());
  const taxAmount = Number(String(formData.get("tax_amount") ?? "0").trim());

  if (!["cash", "credit"].includes(paymentType)) {
    throw new Error("Jenis pembelian tidak valid.");
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    throw new Error("Jumlah harus lebih dari 0.");
  }

  if (Number.isNaN(unitCost) || unitCost < 0) {
    throw new Error("Harga beli tidak boleh negatif.");
  }

  if (Number.isNaN(discountAmount) || discountAmount < 0) {
    throw new Error("Diskon tidak boleh negatif.");
  }

  if (Number.isNaN(taxAmount) || taxAmount < 0) {
    throw new Error("Pajak tidak boleh negatif.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_and_post_purchase_invoice", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_supplier_id: supplierId,
    p_invoice_no: invoiceNo,
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_payment_type: paymentType,
    p_notes: notes,
    p_lines: [
      {
        item_id: itemId,
        quantity,
        unit_cost: unitCost,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        description,
      },
    ],
  });

  if (error) {
    const message =
      error.message || "Transaksi pembelian gagal disimpan dan diposting.";

    if (paymentType === "cash") {
      redirect(
        `/unit/dashboard/catat-transaksi?error=${encodeURIComponent(message)}`
      );
    }

    redirect(`/unit/dashboard/purchasing?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/unit/dashboard/catat-transaksi");
  revalidatePath("/unit/dashboard/purchasing");
  revalidatePath("/unit/dashboard/inventory");
  revalidatePath("/unit/dashboard/cash-bank");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard");

  if (paymentType === "cash") {
    redirect(
      `/unit/dashboard/catat-transaksi?success=${encodeURIComponent(
        "Pembelian tunai berhasil diproses."
      )}`
    );
  }

  redirect("/unit/dashboard/purchasing");
}
export async function postPurchaseInvoice(formData: FormData) {
  const supabase = await createClient();
  const context = await getLoginContext();

  if (!context?.tenant_id || !context?.unit_id) {
    throw new Error("Konteks tenant/unit tidak ditemukan.");
  }

  const purchaseInvoiceId = String(formData.get("purchase_invoice_id") ?? "").trim();

  if (!purchaseInvoiceId) {
    throw new Error("ID invoice pembelian wajib diisi.");
  }

  const { error } = await supabase.rpc("post_purchase_invoice", {
    p_purchase_invoice_id: purchaseInvoiceId,
  });

  if (error) {
    redirect(`/unit/dashboard/purchasing?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/unit/dashboard/purchasing");
  revalidatePath("/unit/dashboard");
  redirect("/unit/dashboard/purchasing");
}








