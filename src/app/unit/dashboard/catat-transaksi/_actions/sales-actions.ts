"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function generateSalesInvoiceNo(paymentType: string) {
  const prefix = paymentType === "credit" ? "JK" : "JT";
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

export async function createAndPostSalesInvoice(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const requestedInvoiceNo = String(formData.get("invoice_no") ?? "").trim();
  const paymentType = getOptionalString(formData, "payment_type") ?? "cash";
  const invoiceNo = (requestedInvoiceNo || generateSalesInvoiceNo(paymentType)).toUpperCase();

  const invoiceDate = getRequiredString(
    formData,
    "invoice_date",
    "Tanggal penjualan wajib diisi."
  );

  const itemId = getRequiredString(
    formData,
    "item_id",
    "Barang wajib dipilih."
  );

  const customerId = getOptionalString(formData, "customer_id");
  const dueDate = getOptionalString(formData, "due_date");
  const notes = getOptionalString(formData, "notes");
  const description = getOptionalString(formData, "description");

  const quantity = Number(String(formData.get("quantity") ?? "0").trim());
  const unitPrice = Number(String(formData.get("unit_price") ?? "0").trim());
  const discountAmount = Number(String(formData.get("discount_amount") ?? "0").trim());
  const taxAmount = Number(String(formData.get("tax_amount") ?? "0").trim());

  if (!["cash", "credit"].includes(paymentType)) {
    throw new Error("Jenis penjualan tidak valid.");
  }

  if (paymentType === "credit" && !dueDate) {
    throw new Error("Tanggal jatuh tempo wajib diisi untuk penjualan kredit.");
  }

  if (Number.isNaN(quantity) || quantity <= 0) {
    throw new Error("Jumlah harus lebih dari 0.");
  }

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    throw new Error("Harga jual tidak boleh negatif.");
  }

  if (Number.isNaN(discountAmount) || discountAmount < 0) {
    throw new Error("Diskon tidak boleh negatif.");
  }

  if (Number.isNaN(taxAmount) || taxAmount < 0) {
    throw new Error("Pajak tidak boleh negatif.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_and_post_sales_invoice", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_customer_id: customerId,
    p_invoice_no: invoiceNo,
    p_invoice_date: invoiceDate,
    p_due_date: dueDate,
    p_payment_type: paymentType,
    p_notes: notes,
    p_lines: [
      {
        item_id: itemId,
        quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        unit_cost: 0,
        description,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Transaksi penjualan gagal disimpan dan diposting.");
  }

  revalidatePath("/unit/dashboard/catat-transaksi");
  revalidatePath("/unit/dashboard/sales");
  revalidatePath("/unit/dashboard/inventory");
  revalidatePath("/unit/dashboard/cash-bank");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard");

  redirect("/unit/dashboard/catat-transaksi");
}
