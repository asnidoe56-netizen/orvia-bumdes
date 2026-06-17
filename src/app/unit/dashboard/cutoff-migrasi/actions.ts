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

function assertUnitCutoffRole(role: string) {
  if (!["manager_unit", "operator_unit"].includes(role)) {
    throw new Error("Akses cut-off migrasi unit tidak valid.");
  }
}

export async function validateUnitCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("validate_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    throw new Error(error.message || "Validasi cut-off migrasi gagal.");
  }

  revalidatePath("/unit/dashboard/cutoff-migrasi");
  redirect(`/unit/dashboard/cutoff-migrasi?validated=${cutoffMigrationId}`);
}

export async function submitUnitCutoffMigrationAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("submit_unit_cutoff_migration", {
    p_cutoff_migration_id: cutoffMigrationId,
  });

  if (error) {
    throw new Error(error.message || "Pengajuan cut-off migrasi ke Pengawas gagal.");
  }

  revalidatePath("/unit/dashboard/cutoff-migrasi");
  revalidatePath("/pengawas/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi?submitted=${cutoffMigrationId}`);
}

export async function createUnitCutoffMigrationDraftAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffNo = getRequiredString(
    formData,
    "cutoff_no",
    "Nomor cut-off wajib diisi."
  );

  const cutoffDate = getRequiredString(
    formData,
    "cutoff_date",
    "Tanggal cut-off wajib diisi."
  );

  const orviaStartDate = getRequiredString(
    formData,
    "orvia_start_date",
    "Tanggal mulai ORVIA wajib diisi."
  );

  const sourceApplicationName = String(
    formData.get("source_application_name") ?? ""
  ).trim();

  const sourceStandard = String(formData.get("source_standard") ?? "").trim();

  const preOrviaProfitSharingStatus = getRequiredString(
    formData,
    "pre_orvia_profit_sharing_status",
    "Status bagi hasil sebelum ORVIA wajib dipilih."
  );

  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("unit_cutoff_migrations")
    .insert({
      tenant_id: context.tenant_id,
      unit_id: context.unit_id,
      cutoff_no: cutoffNo,
      cutoff_date: cutoffDate,
      orvia_start_date: orviaStartDate,
      source_application_name: sourceApplicationName || null,
      source_standard: sourceStandard || null,
      pre_orvia_profit_sharing_status: preOrviaProfitSharingStatus,
      notes: notes || null,
      created_by: context.user_id,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Gagal membuat draft cut-off migrasi.");
  }

  revalidatePath("/unit/dashboard/cutoff-migrasi");
  redirect(`/unit/dashboard/cutoff-migrasi?created=${data.id}`);
}

function parseMoney(value: FormDataEntryValue | null, message: string) {
  const raw = String(value ?? "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(message);
  }

  return parsed;
}

export async function createUnitCutoffCashBankLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const cashBankKind = getRequiredString(
    formData,
    "cash_bank_kind",
    "Jenis kas/bank wajib dipilih."
  );

  if (!["cash", "bank"].includes(cashBankKind)) {
    throw new Error("Jenis kas/bank tidak valid.");
  }

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const sourceBankName = getRequiredString(
    formData,
    "source_bank_name",
    "Nama kas/bank wajib diisi."
  );
  const notes = String(formData.get("notes") ?? "").trim();

  const amount = parseMoney(
    formData.get("amount"),
    "Nominal kas-bank wajib lebih besar dari nol."
  );

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Baris kas-bank hanya dapat ditambahkan saat status draft atau rejected.");
  }

  const targetCashBankCode =
    cashBankKind === "bank" ? "BANK-UTAMA" : "KAS-UTAMA";

  const { data: cashBankAccounts, error: cashBankAccountError } = await supabase
    .from("cash_bank_accounts")
    .select("id, account_id, account_kind, account_code, account_name")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("account_kind", cashBankKind)
    .eq("is_active", true)
    .order("account_code", { ascending: true });

  const normalizeCashBankText = (value: string | null | undefined) =>
    String(value ?? "").toLowerCase();

  const eligibleCashBankAccounts = cashBankAccounts ?? [];

  const cashBankAccount =
    eligibleCashBankAccounts.find(
      (account) =>
        account.account_code === targetCashBankCode &&
        Boolean(account.account_id)
    ) ??
    eligibleCashBankAccounts.find((account) => {
      const accountName = normalizeCashBankText(account.account_name);
      const accountCode = normalizeCashBankText(account.account_code);
      const isAllocationAccount =
        accountName.includes("alokasi") ||
        accountName.includes("bagi hasil") ||
        accountCode.includes("alokasi") ||
        accountCode.includes("bh");

      if (isAllocationAccount || !account.account_id) {
        return false;
      }

      if (cashBankKind === "cash") {
        return accountName.includes("kas tunai");
      }

      return accountName.includes("bank");
    });

  if (cashBankAccountError || !cashBankAccount?.account_id) {
    throw new Error(
      cashBankAccountError?.message ||
        `Master ${targetCashBankCode} untuk jenis ini belum tersedia atau belum terhubung ke COA.`
    );
  }

  const { error } = await supabase
    .from("unit_cutoff_migration_cash_bank_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      cash_bank_account_id: cashBankAccount.id,
      orvia_account_id: cashBankAccount.account_id,
      cash_bank_kind: cashBankAccount.account_kind,
      source_bank_name: sourceBankName,
      amount,
      notes:
        notes ||
        `Auto mapping ke ${cashBankAccount.account_code} - ${cashBankAccount.account_name}`,
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan saldo kas-bank.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}


function parsePositiveNumber(value: FormDataEntryValue | null, message: string) {
  const raw = String(value ?? "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(message);
  }

  return parsed;
}

async function getUnitCoaId(
  kode: string,
  tenantId: string,
  unitId: string,
  message: string
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_of_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .eq("kode", kode)
    .eq("is_active", true)
    .eq("is_postable", true)
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message || message);
  }

  return data.id as string;
}

export async function createUnitCutoffInventoryLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const itemCode = getRequiredString(
    formData,
    "item_code",
    "Kode barang wajib diisi."
  );

  const itemName = getRequiredString(
    formData,
    "item_name",
    "Nama barang wajib diisi."
  );

  const unitOfMeasure = getRequiredString(
    formData,
    "unit_of_measure",
    "Satuan barang wajib diisi."
  );

  const quantity = parsePositiveNumber(
    formData.get("quantity"),
    "Qty persediaan wajib lebih besar dari nol."
  );

  const unitCost = parseMoney(
    formData.get("unit_cost"),
    "Harga satuan persediaan wajib lebih besar dari nol."
  );

  const totalCost = quantity * unitCost;

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Baris persediaan hanya dapat ditambahkan saat status draft atau rejected.");
  }

  const inventoryAccountId = await getUnitCoaId(
    "1300",
    context.tenant_id,
    context.unit_id,
    "Akun 1300 Persediaan belum tersedia untuk unit ini."
  );

  const salesAccountId = await getUnitCoaId(
    "4100",
    context.tenant_id,
    context.unit_id,
    "Akun 4100 Pendapatan Penjualan belum tersedia untuk unit ini."
  );

  const cogsAccountId = await getUnitCoaId(
    "5100",
    context.tenant_id,
    context.unit_id,
    "Akun 5100 HPP Barang Dagang belum tersedia untuk unit ini."
  );

  const { error } = await supabase
    .from("unit_cutoff_migration_inventory_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      item_code: itemCode,
      item_name: itemName,
      unit_of_measure: unitOfMeasure,
      quantity,
      unit_cost: unitCost,
      total_cost: totalCost,
      inventory_account_id: inventoryAccountId,
      sales_account_id: salesAccountId,
      cogs_account_id: cogsAccountId,
      create_inventory_item: true,
      notes:
        notes ||
        "Auto mapping ke 1300 Persediaan, 4100 Pendapatan Penjualan, dan 5100 HPP Barang Dagang.",
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan saldo persediaan.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}

export async function createUnitCutoffFixedAssetLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const assetCategory = getRequiredString(
    formData,
    "asset_category",
    "Jenis aset tetap wajib dipilih."
  );

  const assetAccountCode =
    assetCategory === "furniture" ? "1502" : "1501";

  const assetCode = getRequiredString(
    formData,
    "asset_code",
    "Kode aset wajib diisi."
  );

  const assetName = getRequiredString(
    formData,
    "asset_name",
    "Nama aset wajib diisi."
  );

  const acquisitionDate = getRequiredString(
    formData,
    "acquisition_date",
    "Tanggal perolehan/cut-off wajib diisi."
  );

  const acquisitionCost = parseMoney(
    formData.get("acquisition_cost"),
    "Nilai aset tetap wajib lebih besar dari nol."
  );

  const usefulLifeMonths = Math.max(
    1,
    Math.trunc(
      parsePositiveNumber(
        formData.get("useful_life_months"),
        "Umur manfaat wajib lebih besar dari nol."
      )
    )
  );

  const residualValue = 0;
  const accumulatedAmount = 0;
  const bookValue = acquisitionCost;

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Aset tetap hanya dapat ditambahkan saat status draft atau rejected.");
  }

  const assetAccountId = await getUnitCoaId(
    assetAccountCode,
    context.tenant_id,
    context.unit_id,
    `Akun ${assetAccountCode} aset tetap belum tersedia untuk unit ini.`
  );

  const accumulatedAccountId = await getUnitCoaId(
    "1590",
    context.tenant_id,
    context.unit_id,
    "Akun 1590 Akumulasi Penyusutan belum tersedia untuk unit ini."
  );

  const expenseAccountId = await getUnitCoaId(
    "6400",
    context.tenant_id,
    context.unit_id,
    "Akun 6400 Beban Penyusutan belum tersedia untuk unit ini."
  );

  const { error } = await supabase
    .from("unit_cutoff_migration_asset_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      asset_code: assetCode,
      asset_name: assetName,
      acquisition_date: acquisitionDate,
      acquisition_cost: acquisitionCost,
      accumulated_amount: accumulatedAmount,
      book_value: bookValue,
      residual_value: residualValue,
      useful_life_months: usefulLifeMonths,
      method: "straight_line",
      asset_account_id: assetAccountId,
      accumulated_account_id: accumulatedAccountId,
      expense_account_id: expenseAccountId,
      notes:
        notes ||
        `Auto mapping ke ${assetAccountCode}, 1590 Akumulasi Penyusutan, dan 6400 Beban Penyusutan.`,
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan aset tetap cut-off.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}

export async function createUnitCutoffOtherAssetLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const itemName = getRequiredString(
    formData,
    "item_name",
    "Nama aset lain wajib diisi."
  );

  const amount = parseMoney(
    formData.get("amount"),
    "Nominal aset lain wajib lebih besar dari nol."
  );

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Aset lain hanya dapat ditambahkan saat status draft atau rejected.");
  }

  const otherAssetAccountId = await getUnitCoaId(
    "1300",
    context.tenant_id,
    context.unit_id,
    "Akun aset pembukaan 1300 belum tersedia untuk unit ini."
  );

  const { error } = await supabase
    .from("unit_cutoff_migration_other_asset_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      item_name: itemName,
      orvia_account_id: otherAssetAccountId,
      amount,
      notes:
        notes ||
        "Perlengkapan/ATK cut-off. Catatan: akun 1400 belum tersedia, sementara dimapping ke akun aset 1300.",
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan aset lain cut-off.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}

export async function createUnitCutoffEquityLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const equitySourceType = getRequiredString(
    formData,
    "equity_source_type",
    "Jenis ekuitas wajib dipilih."
  );

  const amount = parseMoney(
    formData.get("amount"),
    "Nominal ekuitas wajib lebih besar dari nol."
  );

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Ekuitas hanya dapat ditambahkan saat status draft atau rejected.");
  }

  let equityAccountId: string | null = null;
  let orviaAccountId: string;
  let defaultNote: string;

  if (equitySourceType === "initial_capital") {
    const { data: equityAccount, error: equityAccountError } = await supabase
      .from("equity_accounts")
      .select("id, account_id, equity_code, equity_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("equity_type", "initial_capital")
      .eq("is_active", true)
      .order("equity_code", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (equityAccountError || !equityAccount?.account_id) {
      throw new Error(
        equityAccountError?.message ||
          "Akun ekuitas modal awal unit belum tersedia."
      );
    }

    equityAccountId = equityAccount.id;
    orviaAccountId = equityAccount.account_id;
    defaultNote = `Auto mapping ke ${equityAccount.equity_code} - ${equityAccount.equity_name}.`;
  } else if (equitySourceType === "retained_earnings") {
    orviaAccountId = await getUnitCoaId(
      "3200",
      context.tenant_id,
      context.unit_id,
      "Akun 3200 Saldo Laba Ditahan belum tersedia untuk unit ini."
    );
    defaultNote = "Auto mapping ke 3200 Saldo Laba Ditahan / saldo laba sebelum ORVIA.";
  } else {
    throw new Error("Jenis ekuitas tidak valid.");
  }

  const { error } = await supabase
    .from("unit_cutoff_migration_equity_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      equity_account_id: equityAccountId,
      orvia_account_id: orviaAccountId,
      equity_source_type: equitySourceType,
      amount,
      notes: notes || defaultNote,
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan ekuitas cut-off.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
  revalidatePath("/unit/dashboard/cutoff-migrasi");

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}

export async function createUnitCutoffSavingsLoanLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const borrowerName = getRequiredString(
    formData,
    "borrower_name",
    "Nama peminjam wajib diisi."
  );

  const loanNo = getRequiredString(
    formData,
    "loan_no",
    "Nomor pinjaman wajib diisi."
  );

  const loanStartDate = getRequiredString(
    formData,
    "loan_start_date",
    "Tanggal pinjaman wajib diisi."
  );

  const originalPrincipalAmount = parseMoney(
    formData.get("original_principal_amount"),
    "Pokok awal wajib lebih besar dari nol."
  );

  const outstandingPrincipalAmount = parseMoney(
    formData.get("outstanding_principal_amount"),
    "Sisa pokok wajib lebih besar dari nol."
  );

  function parseOptionalMoney(value: FormDataEntryValue | null) {
    const raw = String(value ?? "")
      .replace(/Rp/gi, "")
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .trim();

    if (!raw) return 0;

    const parsed = Number(raw);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("Nominal opsional tidak valid.");
    }

    return parsed;
  }

  function parseOptionalInteger(value: FormDataEntryValue | null) {
    const raw = String(value ?? "").trim();

    if (!raw) return null;

    const parsed = Number(raw);

    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new Error("Sisa tenor harus berupa angka bulat nol atau lebih.");
    }

    return parsed;
  }

  const outstandingServiceAmount = parseOptionalMoney(
    formData.get("outstanding_service_amount")
  );
  const outstandingPenaltyAmount = parseOptionalMoney(
    formData.get("outstanding_penalty_amount")
  );
  const installmentAmount = parseOptionalMoney(formData.get("installment_amount"));
  const remainingTenorMonths = parseOptionalInteger(
    formData.get("remaining_tenor_months")
  );

  const collectibilityStatus =
    String(formData.get("collectibility_status") ?? "current").trim() || "current";

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_unit_cutoff_savings_loan_line", {
    p_cutoff_migration_id: cutoffMigrationId,
    p_borrower_name: borrowerName,
    p_loan_no: loanNo,
    p_loan_start_date: loanStartDate,
    p_original_principal_amount: originalPrincipalAmount,
    p_outstanding_principal_amount: outstandingPrincipalAmount,
    p_outstanding_service_amount: outstandingServiceAmount,
    p_outstanding_penalty_amount: outstandingPenaltyAmount,
    p_member_id: null,
    p_group_id: null,
    p_old_account_code: String(formData.get("old_account_code") ?? "").trim() || null,
    p_old_account_name: String(formData.get("old_account_name") ?? "").trim() || null,
    p_borrower_identity_number:
      String(formData.get("borrower_identity_number") ?? "").trim() || null,
    p_borrower_phone: String(formData.get("borrower_phone") ?? "").trim() || null,
    p_borrower_address: String(formData.get("borrower_address") ?? "").trim() || null,
    p_maturity_date: String(formData.get("maturity_date") ?? "").trim() || null,
    p_installment_amount: installmentAmount || null,
    p_remaining_tenor_months: remainingTenorMonths,
    p_collectibility_status: collectibilityStatus,
    p_notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan piutang pinjaman awal.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}

export async function createUnitCutoffLiabilityLineAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCutoffRole(role);

  const cutoffMigrationId = getRequiredString(
    formData,
    "cutoff_migration_id",
    "ID cut-off migrasi tidak ditemukan."
  );

  const liabilityName = getRequiredString(
    formData,
    "liability_name",
    "Nama kewajiban wajib diisi."
  );

  const orviaAccountId = getRequiredString(
    formData,
    "orvia_account_id",
    "Akun kewajiban ORVIA wajib dipilih."
  );

  const amount = parseMoney(
    formData.get("amount"),
    "Nominal kewajiban wajib lebih besar dari nol."
  );

  const oldAccountCode = String(formData.get("old_account_code") ?? "").trim();
  const oldAccountName = String(formData.get("old_account_name") ?? "").trim();
  const counterpartyName = String(formData.get("counterparty_name") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  const { data: header, error: headerError } = await supabase
    .from("unit_cutoff_migrations")
    .select("id, status")
    .eq("id", cutoffMigrationId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (headerError || !header) {
    throw new Error(headerError?.message || "Draft cut-off migrasi tidak ditemukan.");
  }

  if (header.status !== "draft" && header.status !== "rejected") {
    throw new Error("Kewajiban hanya dapat ditambahkan saat status draft atau rejected.");
  }

  const { data: liabilityAccount, error: liabilityAccountError } = await supabase
    .from("chart_of_accounts")
    .select("id, kode, nama, tipe, account_type, normal_balance, is_postable, is_active")
    .eq("id", orviaAccountId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .eq("is_active", true)
    .eq("is_postable", true)
    .maybeSingle();

  if (liabilityAccountError || !liabilityAccount) {
    throw new Error(
      liabilityAccountError?.message ||
        "Akun kewajiban ORVIA tidak ditemukan atau tidak aktif."
    );
  }

  const accountType = String(liabilityAccount.account_type ?? "").toUpperCase();
  const tipe = String(liabilityAccount.tipe ?? "").toLowerCase();
  const normalBalance = String(liabilityAccount.normal_balance ?? "").toLowerCase();

  if (accountType !== "KEWAJIBAN" && tipe !== "kewajiban") {
    throw new Error("Akun yang dipilih bukan akun kewajiban.");
  }

  if (normalBalance !== "credit") {
    throw new Error("Akun kewajiban harus memiliki normal balance credit.");
  }

  const { error } = await supabase
    .from("unit_cutoff_migration_liability_lines")
    .insert({
      cutoff_migration_id: cutoffMigrationId,
      old_account_code: oldAccountCode || null,
      old_account_name: oldAccountName || null,
      liability_name: liabilityName,
      orvia_account_id: liabilityAccount.id,
      counterparty_name: counterpartyName || null,
      amount,
      due_date: dueDate || null,
      notes:
        notes ||
        `Auto mapping ke ${liabilityAccount.kode} - ${liabilityAccount.nama}.`,
    });

  if (error) {
    throw new Error(error.message || "Gagal menambahkan kewajiban cut-off.");
  }

  revalidatePath(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);

  redirect(`/unit/dashboard/cutoff-migrasi/${cutoffMigrationId}`);
}
