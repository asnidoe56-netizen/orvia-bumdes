"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function generateCapitalExpenditureNo(paymentType: string) {
  const prefix = paymentType === "credit" ? "BMK" : "BMT";
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

function getOptionalNumber(formData: FormData, key: string, defaultValue: number) {
  const rawValue = String(formData.get(key) ?? "").trim();

  if (!rawValue) {
    return defaultValue;
  }

  const value = Number(rawValue);

  if (Number.isNaN(value)) {
    throw new Error(`Nilai ${key} tidak valid.`);
  }

  return value;
}

function getRupiahNumber(formData: FormData, key: string, defaultValue: number) {
  const value = getOptionalNumber(formData, key, defaultValue);
  return Math.round(value);
}

export async function createAndPostCapitalExpenditure(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    throw new Error("Sesi unit tidak valid.");
  }

  const requestedTransactionNo = String(formData.get("transaction_no") ?? "").trim();
  const paymentType = getRequiredString(
    formData,
    "payment_type",
    "Cara pembayaran wajib dipilih."
  );

  if (!["cash", "credit"].includes(paymentType)) {
    throw new Error("Cara pembayaran Belanja Modal tidak valid.");
  }

  const transactionNo = (
    requestedTransactionNo || generateCapitalExpenditureNo(paymentType)
  ).toUpperCase();

  const transactionDate = getRequiredString(
    formData,
    "transaction_date",
    "Tanggal Belanja Modal wajib diisi."
  );

  const assetCategoryId = getRequiredString(
    formData,
    "asset_category_id",
    "Kategori aset wajib dipilih."
  );

  const assetName = getRequiredString(
    formData,
    "asset_name",
    "Nama aset wajib diisi."
  );

  const supplierId = getOptionalString(formData, "supplier_id");
  const cashBankAccountId = getOptionalString(formData, "cash_bank_account_id");
  const dueDate = getOptionalString(formData, "due_date");
  const notes = getOptionalString(formData, "notes");
  const description = getOptionalString(formData, "description");

  const quantity = getOptionalNumber(formData, "quantity", 1);
  const unitPrice = getRupiahNumber(formData, "unit_price", 0);
  const residualValue = getRupiahNumber(formData, "residual_value", 0);
  const usefulLifeMonths = getOptionalNumber(formData, "useful_life_months", 0);

  if (paymentType === "cash" && !cashBankAccountId) {
    throw new Error("Akun kas/bank wajib dipilih untuk Belanja Modal tunai.");
  }

  if (paymentType === "credit" && !dueDate) {
    throw new Error("Tanggal jatuh tempo wajib diisi untuk Belanja Modal kredit.");
  }

  if (paymentType === "credit" && cashBankAccountId) {
    throw new Error("Akun kas/bank tidak boleh dipilih untuk Belanja Modal kredit.");
  }

  if (quantity <= 0) {
    throw new Error("Jumlah aset harus lebih dari 0.");
  }

  if (unitPrice <= 0) {
    throw new Error("Harga aset harus lebih dari 0.");
  }

  if (residualValue < 0) {
    throw new Error("Nilai residu tidak boleh negatif.");
  }

  if (usefulLifeMonths < 0) {
    throw new Error("Umur manfaat tidak valid.");
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_and_post_capital_expenditure", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_supplier_id: supplierId,
    p_transaction_no: transactionNo,
    p_transaction_date: transactionDate,
    p_payment_type: paymentType,
    p_due_date: paymentType === "credit" ? dueDate : null,
    p_asset_category_id: assetCategoryId,
    p_cash_bank_account_id: paymentType === "cash" ? cashBankAccountId : null,
    p_notes: notes,
    p_lines: [
      {
        asset_name: assetName,
        description,
        quantity,
        unit_price: unitPrice,
        residual_value: residualValue,
        useful_life_months: usefulLifeMonths > 0 ? usefulLifeMonths : null,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Belanja Modal gagal disimpan dan diposting.");
  }

  revalidatePath("/unit/dashboard/catat-transaksi");
  revalidatePath("/unit/dashboard/catat-transaksi/belanja-modal");
  revalidatePath("/unit/dashboard/cash-bank");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard");

  redirect("/unit/dashboard/catat-transaksi");
}

