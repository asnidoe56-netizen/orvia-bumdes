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

function getNumber(formData: FormData, key: string, defaultValue = 0) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    throw new Error(`${key} harus berupa angka.`);
  }

  return value;
}


export type SalesInvoiceActionState = {
  success: boolean;
  message: string | null;
};

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Transaksi penjualan gagal disimpan dan diposting.";
}

type SalesLinePreviewInput = {
  itemId: string;
  quantity: number;
  discountPercent: number;
  taxAmount: number;
  invoiceDate?: string;
};

export async function previewSalesLineDiscountPercent(input: SalesLinePreviewInput) {
  await getLoginContext();

  if (!input.itemId) {
    return null;
  }

  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "preview_sales_line_discount_percent",
    {
      p_item_id: input.itemId,
      p_quantity: input.quantity,
      p_discount_percent: input.discountPercent || 0,
      p_tax_amount: input.taxAmount || 0,
      p_invoice_date: input.invoiceDate || new Date().toISOString().slice(0, 10),
    }
  );

  if (error) {
    throw new Error(error.message || "Preview perhitungan penjualan gagal.");
  }

  return data as {
    unit_price: number;
    unit_cost: number;
    quantity: number;
    discount_percent: number;
    discount_amount: number;
    tax_amount: number;
    gross_amount: number;
    line_total: number;
    gross_profit: number;
  };
}
export async function createAndPostSalesInvoice(
  _previousState: SalesInvoiceActionState,
  formData: FormData
): Promise<SalesInvoiceActionState> {
  try {
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

    const quantity = getNumber(formData, "quantity");
    const discountPercent = getNumber(formData, "discount_percent", 0);
    const taxAmount = getNumber(formData, "tax_amount", 0);

    if (!["cash", "credit"].includes(paymentType)) {
      throw new Error("Jenis penjualan tidak valid.");
    }

    if (paymentType === "credit" && !dueDate) {
      throw new Error("Tanggal jatuh tempo wajib diisi untuk penjualan kredit.");
    }

    if (quantity <= 0) {
      throw new Error("Jumlah harus lebih dari 0.");
    }

    if (discountPercent < 0 || discountPercent > 100) {
      throw new Error("Diskon persen harus berada di antara 0 sampai 100.");
    }

    if (taxAmount < 0) {
      throw new Error("Pajak tidak boleh negatif.");
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc(
      "create_and_post_sales_invoice_with_discount_percent",
      {
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
            discount_percent: discountPercent,
            tax_amount: taxAmount,
            description,
          },
        ],
      }
    );

    if (error) {
      return {
        success: false,
        message:
          error.message ||
          "Transaksi penjualan gagal disimpan dan diposting.",
      };
    }

    revalidatePath("/unit/dashboard/catat-transaksi");
    revalidatePath("/unit/dashboard/sales");
    revalidatePath("/unit/dashboard/inventory");
    revalidatePath("/unit/dashboard/daftar-stok");
    revalidatePath("/unit/dashboard/cash-bank");
    revalidatePath("/unit/dashboard/reports");
    revalidatePath("/unit/dashboard");
  } catch (error) {
    return {
      success: false,
      message: getActionErrorMessage(error),
    };
  }

  redirect("/unit/dashboard/catat-transaksi");
}