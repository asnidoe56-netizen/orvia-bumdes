"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function generateSupplierPaymentNo() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replaceAll("-", "");
  const timePart = now.toISOString().slice(11, 23).replace(/[:.]/g, "");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BH-${datePart}-${timePart}-${randomPart}`;
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

function getRupiahAmount(formData: FormData, key: string) {
  const rawValue = String(formData.get(key) ?? "").trim();
  const value = Number(rawValue);

  if (!rawValue || Number.isNaN(value) || value <= 0) {
    throw new Error("Nominal pembayaran harus lebih dari 0.");
  }

  return Math.round(value);
}

function getActionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Pembayaran hutang supplier gagal diposting.";
}

export async function paySupplierPurchaseInvoice(formData: FormData) {
  try {
    const context = await getLoginContext();

    if (!context?.tenant_id || !context.unit_id) {
      throw new Error("Sesi unit tidak valid.");
    }

    const purchaseInvoiceId = getRequiredString(
      formData,
      "purchase_invoice_id",
      "Invoice hutang supplier wajib dipilih."
    );

    const cashBankAccountId = getRequiredString(
      formData,
      "cash_bank_account_id",
      "Akun kas/bank pembayaran wajib dipilih."
    );

    const paymentDate = getRequiredString(
      formData,
      "payment_date",
      "Tanggal pembayaran wajib diisi."
    );

    const requestedPaymentNo = String(formData.get("payment_no") ?? "").trim();
    const paymentNo = (
      requestedPaymentNo || generateSupplierPaymentNo()
    ).toUpperCase();

    const amount = getRupiahAmount(formData, "amount");
    const notes = getOptionalString(formData, "notes");

    const supabase = await createClient();

    const { error } = await supabase.rpc("pay_supplier_purchase_invoice", {
      p_purchase_invoice_id: purchaseInvoiceId,
      p_cash_bank_account_id: cashBankAccountId,
      p_payment_no: paymentNo,
      p_payment_date: paymentDate,
      p_amount: amount,
      p_notes: notes,
    });

    if (error) {
      throw new Error(
        error.message || "Pembayaran hutang supplier gagal diposting."
      );
    }

    revalidatePath("/unit/dashboard/catat-transaksi");
    revalidatePath("/unit/dashboard/catat-transaksi/bayar-hutang-supplier");
    revalidatePath("/unit/dashboard/purchasing");
    revalidatePath("/unit/dashboard/cash-bank");
    revalidatePath("/unit/dashboard/reports");
    revalidatePath("/unit/dashboard");
  } catch (error) {
    const message = encodeURIComponent(getActionErrorMessage(error));
    redirect(`/unit/dashboard/catat-transaksi/bayar-hutang-supplier?error=${message}`);
  }

  redirect("/unit/dashboard/catat-transaksi");
}
