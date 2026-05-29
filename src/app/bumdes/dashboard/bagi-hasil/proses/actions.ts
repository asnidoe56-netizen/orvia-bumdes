"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

function required(formData: FormData, key: string, message: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(message);
  }

  return value;
}

function optional(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function revalidateBagiHasil() {
  revalidatePath("/bumdes/dashboard/bagi-hasil");
  revalidatePath("/bumdes/dashboard");
  revalidatePath("/bumdes/dashboard/reports");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard/reports/neraca");
  revalidatePath("/unit/dashboard/reports/laba-rugi");
  revalidatePath("/unit/dashboard/reports/perubahan-ekuitas");
}

function generateAllocationNo(year: number) {
  const now = new Date();
  const stamp = now.toISOString().slice(11, 19).replaceAll(":", "");
  return `BH-${year}-${stamp}`;
}

function generateDistributionNo(year: number, code: string) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const time = now.toISOString().slice(11, 19).replaceAll(":", "");
  return `DBH-${year}-${code}-${date}-${time}`;
}

async function getAnnualClosing(id: string, tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("annual_closings")
    .select("id, tenant_id, unit_id, closing_year, status, journal_entry_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Gagal membaca annual closing.");
  }

  if (!data) {
    throw new Error("Annual closing tidak ditemukan.");
  }

  return data as {
    id: string;
    tenant_id: string;
    unit_id: string | null;
    closing_year: number;
    status: string;
    journal_entry_id: string | null;
  };
}

async function getAllocation(id: string, tenantId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profit_sharing_allocations")
    .select("id, tenant_id, unit_id, annual_closing_id, allocation_no, status, journal_entry_id")
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Gagal membaca alokasi Bagi Hasil.");
  }

  if (!data) {
    throw new Error("Alokasi Bagi Hasil tidak ditemukan.");
  }

  return data as {
    id: string;
    tenant_id: string;
    unit_id: string | null;
    annual_closing_id: string;
    allocation_no: string;
    status: string;
    journal_entry_id: string | null;
  };
}

async function getRetainedEarningsAccountId(
  tenantId: string,
  unitId: string | null
) {
  const supabase = await createClient();

  let query = supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("kode", "3200")
    .eq("account_type", "EKUITAS")
    .eq("is_active", true)
    .eq("is_postable", true)
    .limit(1);

  query = unitId ? query.eq("unit_id", unitId) : query.is("unit_id", null);

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message || "Gagal membaca akun 3200.");
  }

  if (!data?.id) {
    throw new Error("Akun 3200 Saldo Laba Ditahan tidak ditemukan.");
  }

  return data.id as string;
}

export async function calculateAnnualClosingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const unitId = required(
    formData,
    "unit_id",
    "Unit usaha wajib dipilih."
  );

  const closingYearText = required(
    formData,
    "closing_year",
    "Tahun tutup buku wajib diisi."
  );

  const closingYear = Number(closingYearText);

  if (!Number.isInteger(closingYear) || closingYear < 2000 || closingYear > 2100) {
    throw new Error("Tahun tutup buku tidak valid.");
  }

  const notes = optional(formData, "notes");

  const supabase = await createClient();

  const { error } = await supabase.rpc("calculate_annual_closing", {
    p_tenant_id: context.tenant_id,
    p_unit_id: unitId,
    p_closing_year: closingYear,
    p_notes: notes || "Dibuat dari dashboard Bagi Hasil.",
  });

  if (error) {
    throw new Error(error.message || "Buat tutup tahun gagal.");
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}
export async function postAnnualClosingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const annualClosingId = required(
    formData,
    "annual_closing_id",
    "Annual closing wajib dipilih."
  );

  const annualClosing = await getAnnualClosing(
    annualClosingId,
    context.tenant_id
  );

  const retainedEarningsAccountId = await getRetainedEarningsAccountId(
    annualClosing.tenant_id,
    annualClosing.unit_id
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("post_annual_closing", {
    p_annual_closing_id: annualClosing.id,
    p_retained_earnings_account_id: retainedEarningsAccountId,
  });

  if (error) {
    throw new Error(error.message || "Posting annual closing gagal.");
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}

export async function calculateProfitSharingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const annualClosingId = required(
    formData,
    "annual_closing_id",
    "Annual closing wajib dipilih."
  );

  const schemeId = required(
    formData,
    "scheme_id",
    "Skema Bagi Hasil wajib dipilih."
  );

  const allocationDate = required(
    formData,
    "allocation_date",
    "Tanggal alokasi wajib diisi."
  );

  const annualClosing = await getAnnualClosing(
    annualClosingId,
    context.tenant_id
  );

  const allocationNo = (
    optional(formData, "allocation_no") ||
    generateAllocationNo(annualClosing.closing_year)
  ).toUpperCase();

  const supabase = await createClient();

  const { error } = await supabase.rpc("calculate_profit_sharing_allocation", {
    p_annual_closing_id: annualClosing.id,
    p_scheme_id: schemeId,
    p_allocation_no: allocationNo,
    p_allocation_date: allocationDate,
    p_notes: "Dihitung dari dashboard Bagi Hasil.",
  });

  if (error) {
    throw new Error(error.message || "Hitung Bagi Hasil gagal.");
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}

export async function approveProfitSharingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const allocationId = required(
    formData,
    "allocation_id",
    "Alokasi Bagi Hasil wajib dipilih."
  );

  await getAllocation(allocationId, context.tenant_id);

  const supabase = await createClient();

  const { error } = await supabase.rpc("approve_profit_sharing_allocation", {
    p_allocation_id: allocationId,
  });

  if (error) {
    throw new Error(error.message || "Persetujuan Bagi Hasil gagal.");
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}

export async function postProfitSharingAllocationAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const allocationId = required(
    formData,
    "allocation_id",
    "Alokasi Bagi Hasil wajib dipilih."
  );

  const allocation = await getAllocation(allocationId, context.tenant_id);

  const retainedEarningsAccountId = await getRetainedEarningsAccountId(
    allocation.tenant_id,
    allocation.unit_id
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("post_profit_sharing_allocation", {
    p_allocation_id: allocation.id,
    p_retained_earnings_account_id: retainedEarningsAccountId,
  });

  if (error) {
    throw new Error(error.message || "Posting Bagi Hasil gagal.");
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}

export async function distributeProfitSharingAction(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.tenant_id) {
    throw new Error("Sesi BUMDes tidak valid.");
  }

  const allocationId = required(
    formData,
    "allocation_id",
    "Alokasi Bagi Hasil wajib dipilih."
  );

  const distributionDate = required(
    formData,
    "distribution_date",
    "Tanggal distribusi wajib diisi."
  );

  const sourceCashBankAccountId = required(
    formData,
    "source_cash_bank_account_id",
    "Kas/bank sumber wajib dipilih."
  );

  const destinationCashBankAccountId = optional(
    formData,
    "destination_cash_bank_account_id"
  );

  const allocation = await getAllocation(allocationId, context.tenant_id);
  const supabase = await createClient();

  const { data: rows, error: rowsError } = await supabase
    .from("v_profit_sharing_allocation_flow")
    .select("allocation_line_id, allocation_code, target_account_type, remaining_amount, closing_year, line_no")
    .eq("tenant_id", context.tenant_id)
    .eq("allocation_id", allocation.id)
    .gt("remaining_amount", 0)
    .order("line_no", { ascending: true });

  if (rowsError) {
    throw new Error(rowsError.message || "Gagal membaca detail distribusi.");
  }

  if (!rows || rows.length === 0) {
    throw new Error("Tidak ada sisa Bagi Hasil yang perlu didistribusikan.");
  }

  const hasInternalTransfer = rows.some(
    (row) => String(row.target_account_type ?? "") === "EKUITAS"
  );

  if (hasInternalTransfer && !destinationCashBankAccountId) {
    throw new Error(
      "Kas tujuan wajib dipilih karena ada alokasi internal modal."
    );
  }

  for (const row of rows) {
    const allocationLineId = String(row.allocation_line_id ?? "");
    const allocationCode = String(row.allocation_code ?? "LINE");
    const closingYear = Number(row.closing_year ?? new Date().getFullYear());
    const targetAccountType = String(row.target_account_type ?? "");

    if (!allocationLineId) {
      throw new Error(`allocation_line_id kosong untuk baris ${allocationCode}.`);
    }

    const { error } = await supabase.rpc(
      "post_profit_sharing_distribution_payment",
      {
        p_allocation_line_id: allocationLineId,
        p_distribution_no: generateDistributionNo(closingYear, allocationCode),
        p_distribution_date: distributionDate,
        p_source_cash_bank_account_id: sourceCashBankAccountId,
        p_destination_cash_bank_account_id:
          targetAccountType === "EKUITAS" ? destinationCashBankAccountId : null,
      }
    );

    if (error) {
      throw new Error(
        error.message || `Distribusi gagal pada baris ${allocationCode}.`
      );
    }
  }

  revalidateBagiHasil();
  redirect("/bumdes/dashboard/bagi-hasil");
}

