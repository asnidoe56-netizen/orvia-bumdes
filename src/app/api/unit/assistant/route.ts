import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { generateOrviaAiText, getSafeOrviaAiErrorMessage } from "@/lib/orvia-ai/provider";
import {
  getCashPurchaseAssistantOptions,
  getCapitalDebtPaymentAssistantOptions,
  getCustomerPaymentAssistantOptions,
  getCapitalExpenditureAssistantOptions,
  getCashSaleAssistantOptions,
  getSupplierDebtPaymentAssistantOptions,
  getOperationalExpenseAssistantOptions,
  getRevenueReceiptAssistantOptions,
  type AssistantCashBankAccountOption,
  type AssistantCapitalPayableOption,
  type AssistantCapitalExpenditureCategoryOption,
  type AssistantSupplierOption,
  type AssistantExpenseAccountOption,
  type AssistantPurchaseInventoryItemOption,
  type AssistantPurchaseSupplierOption,
  type AssistantRevenueAccountOption,
  type AssistantSaleCustomerOption,
  type AssistantSaleInventoryItemOption,
  type AssistantSupplierPayableInvoiceOption,
  type AssistantCustomerReceivableInvoiceOption,
} from "@/lib/assistant/unit-assistant-tools";

type AssistantModule =
  | "operational_expense"
  | "revenue_receipt"
  | "cash_purchase"
  | "credit_purchase"
  | "cash_sale"
  | "credit_sale"
  | "supplier_debt_payment"
  | "capital_debt_payment"
  | "capital_expenditure"
  | "customer_payment";

type ExpenseAccountOption = AssistantExpenseAccountOption;
type RevenueAccountOption = AssistantRevenueAccountOption;
type CashBankAccountOption = AssistantCashBankAccountOption;
type CapitalPayableOption = AssistantCapitalPayableOption;
type CapitalExpenditureCategoryOption = AssistantCapitalExpenditureCategoryOption;
type SupplierOption = AssistantSupplierOption;
type PurchaseSupplierOption = AssistantPurchaseSupplierOption;
type PurchaseInventoryItemOption = AssistantPurchaseInventoryItemOption;
type SaleCustomerOption = AssistantSaleCustomerOption;
type SaleInventoryItemOption = AssistantSaleInventoryItemOption;
type SupplierPayableInvoiceOption = AssistantSupplierPayableInvoiceOption;
type CustomerReceivableInvoiceOption = AssistantCustomerReceivableInvoiceOption;


function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}
function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isValidDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseAmountFromText(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/\brp\.?\s?/g, "")
    .replace(/(\d)(juta|jt|jta|ribu|rb)\b/g, "$1 $2")
    .replace(/\b(juta|jt|jta|ribu|rb)(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const jutaRibuMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(juta|jt|jta)(?:\s*(\d+(?:[.,]\d+)?)(?:\s*(ribu|rb))?)?/
  );

  if (jutaRibuMatch?.[1]) {
    const jutaPart = Number(jutaRibuMatch[1].replace(",", "."));
    const tailRaw = jutaRibuMatch[3];
    const tailUnit = jutaRibuMatch[4] ?? "";

    if (!Number.isFinite(jutaPart) || jutaPart <= 0) {
      return 0;
    }

    let tailAmount = 0;

    if (tailRaw) {
      const tailNumber = Number(tailRaw.replace(",", "."));

      if (Number.isFinite(tailNumber) && tailNumber > 0) {
        tailAmount =
          tailUnit === "ribu" || tailUnit === "rb" || tailNumber < 1000
            ? tailNumber * 1_000
            : tailNumber;
      }
    }

    return Math.round(jutaPart * 1_000_000 + tailAmount);
  }

  const ribuMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb)/);

  if (ribuMatch?.[1]) {
    const ribuPart = Number(ribuMatch[1].replace(",", "."));

    if (!Number.isFinite(ribuPart) || ribuPart <= 0) {
      return 0;
    }

    return Math.round(ribuPart * 1_000);
  }

  const numberMatch = normalized.match(
    /\b\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?\b|\b\d+\b/
  );

  if (!numberMatch?.[0]) {
    return 0;
  }

  const amount = Number(
    numberMatch[0].replace(/\s/g, "").replace(/\./g, "").replace(",", ".")
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    return 0;
  }

  return Math.round(amount);
}
function parseTransactionDateFromText(text: string, today: string) {
  const normalized = normalizeText(text);
  const todayDate = parseDateInput(today);

  if (normalized.includes("hari ini")) {
    return {
      date: today,
      operator_reason: "",
      warning: "",
    };
  }

  if (normalized.includes("kemarin")) {
    const yesterday = new Date(todayDate);
    yesterday.setDate(todayDate.getDate() - 1);

    return {
      date: formatDateInput(yesterday),
      operator_reason: "Transaksi terjadi kemarin dan baru dicatat hari ini.",
      warning: "Tanggal transaksi dibaca sebagai kemarin.",
    };
  }

  const dayOnlyMatch = normalized.match(/\b(?:tanggal|tgl)\s+(\d{1,2})\b/);

  if (dayOnlyMatch?.[1]) {
    const day = Number(dayOnlyMatch[1]);

    if (day >= 1 && day <= 31) {
      const parsedDate = new Date(todayDate);
      const todayDay = todayDate.getDate();

      if (day > todayDay) {
        parsedDate.setMonth(todayDate.getMonth() - 1);
      }

      parsedDate.setDate(day);

      const parsedInputDate = formatDateInput(parsedDate);
      const isPreviousMonth = day > todayDay;

      return {
        date: parsedInputDate,
        operator_reason:
          parsedInputDate === today
            ? ""
            : isPreviousMonth
              ? `Transaksi disebut terjadi pada tanggal ${day} bulan sebelumnya dan baru dicatat hari ini.`
              : `Transaksi disebut terjadi pada tanggal ${day} dan baru dicatat hari ini.`,
        warning: isPreviousMonth
          ? `Tanggal ${day} lebih besar dari tanggal hari ini, maka sistem membaca transaksi ini sebagai tanggal ${day} bulan sebelumnya.`
          : "",
      };
    }
  }

  return {
    date: today,
    operator_reason: "",
    warning: "",
  };
}

function buildDescription(text: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return "";
  }

  return `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

function parseQuantityFromText(text: string) {
  const normalized = normalizeText(text);

  const keywordMatch = normalized.match(
    /\b(jumlah|sebanyak|satuan|qty|kuantitas)\s*(?:barang|item|produk)?\s*(\d+(?:[.,]\d+)?)\b/
  );

  if (keywordMatch?.[2]) {
    return Number(keywordMatch[2].replace(",", "."));
  }

  const unitMatch = normalized.match(
    /\b(\d+(?:[.,]\d+)?)\s*(sak|karung|dus|dos|box|pcs|buah|unit|kg|kilo|liter|ltr|botol|ikat|pak|pack)\b/
  );

  if (unitMatch?.[1]) {
    return Number(unitMatch[1].replace(",", "."));
  }

  return 0;
}
function pickPurchaseSupplier(
  text: string,
  suppliers: PurchaseSupplierOption[]
) {
  const normalized = normalizeText(text);
  const afterFromMatch = normalized.match(/\b(?:dari|di|ke)\s+(.+)$/);
  const afterFrom = afterFromMatch?.[1] ?? "";

  const scoredSuppliers = suppliers
    .map((supplier) => {
      const supplierName = normalizeText(supplier.supplier_name);
      const supplierLabel = normalizeText(
        `${supplier.supplier_code} ${supplier.supplier_name}`
      );

      let score = 0;

      if (normalized.includes(supplierLabel)) score += 6;
      if (normalized.includes(supplierName)) score += 5;
      if (afterFrom && supplierName.includes(afterFrom)) score += 4;
      if (afterFrom && afterFrom.includes(supplierName)) score += 4;

      for (const word of supplierName.split(" ")) {
        if (word.length >= 3 && normalized.includes(word)) {
          score += 1;
        }
      }

      return { supplier, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredSuppliers[0]?.score > 0 ? scoredSuppliers[0].supplier : null;
}

function pickPurchaseItem(text: string, items: PurchaseInventoryItemOption[]) {
  const normalized = normalizeText(text);

  const scoredItems = items
    .map((item) => {
      const itemName = normalizeText(item.item_name);
      const itemLabel = normalizeText(`${item.item_code} ${item.item_name}`);

      let score = 0;

      if (normalized.includes(itemLabel)) score += 6;
      if (normalized.includes(itemName)) score += 5;

      for (const word of itemName.split(" ")) {
        if (word.length >= 3 && normalized.includes(word)) {
          score += 1;
        }
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredItems[0]?.score > 0 ? scoredItems[0].item : null;
}
function pickExpenseAccount(
  text: string,
  expenseAccounts: ExpenseAccountOption[]
) {
  const normalized = normalizeText(text);

  const rules: Array<{ keywords: string[]; accountName: string }> = [
    {
      keywords: [
        "bensin",
        "solar",
        "transport",
        "ongkos",
        "jalan",
        "perjalanan",
        "kendaraan",
        "motor",
        "mobil",
      ],
      accountName: "transportasi",
    },
    {
      keywords: ["gaji", "honor", "upah", "pegawai", "karyawan"],
      accountName: "gaji",
    },
    {
      keywords: [
        "materai",
        "fotokopi",
        "print",
        "atk",
        "pulpen",
        "kertas",
        "administrasi",
        "admin",
        "listrik",
        "token",
        "pulsa",
        "internet",
      ],
      accountName: "administrasi",
    },
    {
      keywords: ["penyusutan", "depresiasi"],
      accountName: "penyusutan",
    },
    {
      keywords: ["cadangan", "kerugian pinjaman"],
      accountName: "cadangan",
    },
    {
      keywords: ["lain-lain", "lain lain", "lainnya"],
      accountName: "lain",
    },
  ];

  for (const rule of rules) {
    const hasKeyword = rule.keywords.some((keyword) =>
      normalized.includes(keyword)
    );

    if (!hasKeyword) {
      continue;
    }

    const matched = expenseAccounts.find((account) =>
      normalizeText(`${account.kode} ${account.nama}`).includes(rule.accountName)
    );

    if (matched) {
      return matched;
    }
  }

  const operationalFallback = expenseAccounts.find((account) =>
    normalizeText(`${account.kode} ${account.nama}`).includes("operasional")
  );

  return operationalFallback ?? expenseAccounts[0] ?? null;
}

function pickRevenueAccount(
  text: string,
  revenueAccounts: RevenueAccountOption[]
) {
  const normalized = normalizeText(text);

  const rules: Array<{ keywords: string[]; accountName: string }> = [
    {
      keywords: ["jasa", "sewa", "layanan", "servis", "service"],
      accountName: "jasa",
    },
    {
      keywords: ["jual", "penjualan", "dagang", "barang"],
      accountName: "penjualan",
    },
    {
      keywords: ["lain-lain", "lain lain", "lainnya", "denda", "bonus"],
      accountName: "lain",
    },
  ];

  for (const rule of rules) {
    const hasKeyword = rule.keywords.some((keyword) =>
      normalized.includes(keyword)
    );

    if (!hasKeyword) {
      continue;
    }

    const matched = revenueAccounts.find((account) =>
      normalizeText(`${account.kode} ${account.nama}`).includes(rule.accountName)
    );

    if (matched) {
      return matched;
    }
  }

  const jasaFallback = revenueAccounts.find((account) =>
    normalizeText(`${account.kode} ${account.nama}`).includes("jasa")
  );

  return jasaFallback ?? revenueAccounts[0] ?? null;
}

function pickCashBankAccount(
  text: string,
  cashBankAccounts: CashBankAccountOption[],
  amount: number
) {
  const normalized = normalizeText(text);
  const hasAmount = Number.isFinite(amount) && amount > 0;

  const preferredKind = normalized.includes("bank")
    ? "bank"
    : normalized.includes("kas")
      ? "cash"
      : "";

  const candidates = cashBankAccounts.filter((account) => {
    if (!preferredKind) {
      return true;
    }

    return normalizeText(account.account_kind) === preferredKind;
  });

  const source = candidates.length > 0 ? candidates : cashBankAccounts;

  if (hasAmount) {
    const enoughBalance = source.find(
      (account) => Number(account.current_balance ?? 0) >= amount
    );

    if (enoughBalance) {
      return enoughBalance;
    }

    const anyEnoughBalance = cashBankAccounts.find(
      (account) => Number(account.current_balance ?? 0) >= amount
    );

    if (anyEnoughBalance) {
      return anyEnoughBalance;
    }
  }

  return source[0] ?? cashBankAccounts[0] ?? null;
}

async function handleOperationalExpense({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const {
    expenseAccounts: safeExpenseAccounts,
    cashBankAccounts: safeCashBankAccounts,
  } = await getOperationalExpenseAssistantOptions(supabase, context);

  if (safeExpenseAccounts.length === 0 || safeCashBankAccounts.length === 0) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data referensi belum lengkap.",
        warnings: ["Periksa akun beban dan akun kas/bank unit."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const amount = parseAmountFromText(prompt);
  const pickedExpenseAccount = pickExpenseAccount(prompt, safeExpenseAccounts);
  const pickedCashBankAccount = pickCashBankAccount(
    prompt,
    safeCashBankAccounts,
    amount
  );
  const parsedDate = parseTransactionDateFromText(prompt, today);

  if (!pickedExpenseAccount || !pickedCashBankAccount) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Assistant belum bisa menentukan akun.",
        warnings: ["Silakan pilih akun secara manual."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const warnings: string[] = [];

  if (!amount) {
    warnings.push("Nominal belum terbaca. Isi nominal secara manual sebelum posting.");
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  if (
    amount > 0 &&
    Number(pickedCashBankAccount.current_balance ?? 0) < amount
  ) {
    warnings.push(
      `Saldo ${pickedCashBankAccount.account_name} belum cukup untuk nominal yang dibaca.`
    );
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      expense_date: parsedDate.date,
      expense_account_id: pickedExpenseAccount.id,
      cash_bank_account_id: pickedCashBankAccount.id,
      total_amount: amount > 0 ? amount : "",
      description: buildDescription(prompt),
      operator_reason: parsedDate.operator_reason,
    },
    summary: `Assistant backend membaca ini sebagai ${pickedExpenseAccount.kode} - ${pickedExpenseAccount.nama} melalui ${pickedCashBankAccount.account_name}.`,
    warnings,
    requires_user_confirmation: true,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "operational_expense_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Beban Operasional.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getOperationalExpenseAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}

async function handleRevenueReceipt({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const {
    revenueAccounts: safeRevenueAccounts,
    cashBankAccounts: safeCashBankAccounts,
  } = await getRevenueReceiptAssistantOptions(supabase, context);

  if (safeRevenueAccounts.length === 0 || safeCashBankAccounts.length === 0) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data referensi belum lengkap.",
        warnings: ["Periksa akun pendapatan dan akun kas/bank unit."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const amount = parseAmountFromText(prompt);
  const pickedRevenueAccount = pickRevenueAccount(prompt, safeRevenueAccounts);
  const pickedCashBankAccount = pickCashBankAccount(
    prompt,
    safeCashBankAccounts,
    amount
  );
  const parsedDate = parseTransactionDateFromText(prompt, today);

  if (!pickedRevenueAccount || !pickedCashBankAccount) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Assistant belum bisa menentukan akun.",
        warnings: ["Silakan pilih akun secara manual."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const warnings: string[] = [];

  if (!amount) {
    warnings.push("Nominal belum terbaca. Isi nominal secara manual sebelum posting.");
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      receipt_date: parsedDate.date,
      revenue_account_id: pickedRevenueAccount.id,
      cash_bank_account_id: pickedCashBankAccount.id,
      total_amount: amount > 0 ? amount : "",
      description: buildDescription(prompt),
    },
    summary: `Assistant backend membaca ini sebagai ${pickedRevenueAccount.kode} - ${pickedRevenueAccount.nama} diterima ke ${pickedCashBankAccount.account_name}.`,
    warnings,
    requires_user_confirmation: true,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "revenue_receipt_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Terima Pendapatan.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getRevenueReceiptAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}

function parseCreditDueDateFromText(text: string, today: string) {
  const normalized = normalizeText(text);
  const todayDate = parseDateInput(today);

  if (!todayDate) {
    return "";
  }

  const dayOffsetMatch = normalized.match(
    /\b(?:jatuh tempo|tempo|bayar)\s*(\d{1,3})\s*(?:hari)\b/
  );

  if (dayOffsetMatch?.[1]) {
    const offset = Number(dayOffsetMatch[1]);

    if (Number.isFinite(offset) && offset > 0) {
      const dueDate = new Date(todayDate);
      dueDate.setDate(dueDate.getDate() + offset);

      return formatDateInput(dueDate);
    }
  }

  const nextMonthDateMatch = normalized.match(
    /\b(?:bulan depan)\s*(?:tanggal|tgl)?\s*(\d{1,2})\b/
  );

  if (nextMonthDateMatch?.[1]) {
    const day = Number(nextMonthDateMatch[1]);

    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      const dueDate = new Date(todayDate);
      dueDate.setMonth(dueDate.getMonth() + 1, day);

      return formatDateInput(dueDate);
    }
  }

  const dateMatch = normalized.match(
    /\b(?:jatuh tempo|tempo|bayar)\s*(?:tanggal|tgl)?\s*(\d{1,2})\b/
  );

  if (dateMatch?.[1]) {
    const day = Number(dateMatch[1]);

    if (Number.isFinite(day) && day >= 1 && day <= 31) {
      const dueDate = new Date(todayDate);
      dueDate.setDate(day);

      if (dueDate < todayDate) {
        dueDate.setMonth(dueDate.getMonth() + 1);
      }

      return formatDateInput(dueDate);
    }
  }

  return "";
}



function pickCapitalExpenditureCategory(
  text: string,
  categories: CapitalExpenditureCategoryOption[]
) {
  const normalized = normalizeText(text);

  const byName = categories.find((category) =>
    normalized.includes(normalizeText(category.category_name))
  );

  if (byName) {
    return byName;
  }

  const fallbackKeywords: Array<{
    keywords: string[];
    matcher: (category: CapitalExpenditureCategoryOption) => boolean;
  }> = [
    {
      keywords: ["laptop", "komputer", "printer", "mesin", "peralatan", "alat"],
      matcher: (category) =>
        normalizeText(category.category_name).includes("peralatan") ||
        normalizeText(category.category_name).includes("mesin"),
    },
    {
      keywords: ["motor", "mobil", "kendaraan"],
      matcher: (category) =>
        normalizeText(category.category_name).includes("kendaraan"),
    },
    {
      keywords: ["bangunan", "gedung", "kios", "ruko", "renovasi"],
      matcher: (category) =>
        normalizeText(category.category_name).includes("bangunan"),
    },
    {
      keywords: ["tanah", "lahan"],
      matcher: (category) => normalizeText(category.category_name).includes("tanah"),
    },
  ];

  for (const fallback of fallbackKeywords) {
    if (!fallback.keywords.some((keyword) => normalized.includes(keyword))) {
      continue;
    }

    const match = categories.find(fallback.matcher);

    if (match) {
      return match;
    }
  }

  return categories[0] ?? null;
}

function pickSupplier(text: string, suppliers: SupplierOption[]) {
  const normalized = normalizeText(text);

  return (
    suppliers.find((supplier) =>
      normalized.includes(normalizeText(supplier.supplier_name))
    ) ?? null
  );
}

function inferCapitalExpenditurePaymentType(text: string) {
  const normalized = normalizeText(text);

  if (
    normalized.includes("kredit") ||
    normalized.includes("hutang") ||
    normalized.includes("utang") ||
    normalized.includes("belum bayar") ||
    normalized.includes("bayar nanti")
  ) {
    return "credit";
  }

  return "cash";
}

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function inferCapitalAssetName(text: string) {
  const normalized = normalizeText(text);

  const explicitAssetNameMatch = normalized.match(
    /nama\s*aset\s+(.+?)(?:\s+(?:harga|senilai|sebesar|seharga|tunai|kredit|dari|jatuh|tempo|umur)\b|$)/
  );

  if (explicitAssetNameMatch?.[1]) {
    return toTitleCase(explicitAssetNameMatch[1]);
  }

  const boughtAssetMatch = normalized.match(
    /(?:beli|membeli|belanja|pengadaan)\s+(.+?)(?:\s+(?:harga|senilai|sebesar|seharga|tunai|kredit|dari|jatuh|tempo|umur)\b|$)/
  );

  if (boughtAssetMatch?.[1]) {
    const candidate = boughtAssetMatch[1]
      .replace(/\baset\b/g, "")
      .replace(/\bbarang\b/g, "")
      .replace(/\bnama\s*aset\b/g, "")
      .trim();

    if (candidate) {
      return toTitleCase(candidate);
    }
  }

  const knownAssets = [
    "laptop",
    "komputer",
    "printer",
    "mesin",
    "motor",
    "mobil",
    "etalase",
    "kulkas",
    "freezer",
    "bangunan",
    "tanah",
    "gerobak",
    "meja",
    "kursi",
    "lemari",
    "rak",
    "meubelair",
    "furniture",
  ];

  const matchedAsset = knownAssets.find((asset) => normalized.includes(asset));

  if (matchedAsset) {
    return toTitleCase(matchedAsset);
  }

  return "";
}


function addDaysToDate(dateText: string, days: number) {
  const date = new Date(`${dateText}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return dateText;
  }

  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}
function inferDueDateForCapitalExpenditure(text: string, today: string) {
  const normalized = normalizeText(text);

  if (normalized.includes("besok")) {
    return addDaysToDate(today, 1);
  }

  const dayMatch = normalized.match(/(\d+)\s*hari/);
  if (dayMatch?.[1]) {
    return addDaysToDate(today, Number(dayMatch[1]));
  }

  const monthMatch = normalized.match(/(\d+)\s*bulan/);
  if (monthMatch?.[1]) {
    return addDaysToDate(today, Number(monthMatch[1]) * 30);
  }

  return addDaysToDate(today, 30);
}

function inferUsefulLifeMonths(
  category: CapitalExpenditureCategoryOption | null,
  text: string
) {
  const normalized = normalizeText(text);
  const monthMatch = normalized.match(/umur\s*(\d+)\s*bulan/);

  if (monthMatch?.[1]) {
    return Number(monthMatch[1]);
  }

  const yearMatch = normalized.match(/umur\s*(\d+)\s*tahun/);

  if (yearMatch?.[1]) {
    return Number(yearMatch[1]) * 12;
  }

  return category?.default_useful_life_months ?? "";
}
function pickCapitalPayable(text: string, payables: CapitalPayableOption[]) {
  const normalized = normalizeText(text);

  const byTransactionNo = payables.find((item) =>
    normalized.includes(normalizeText(item.transaction_no))
  );

  if (byTransactionNo) {
    return byTransactionNo;
  }

  const bySupplier = payables.find((item) => {
    if (!item.supplier_name) {
      return false;
    }

    return normalized.includes(normalizeText(item.supplier_name));
  });

  return bySupplier ?? null;
}
function pickCustomerReceivableInvoice(
  text: string,
  receivables: CustomerReceivableInvoiceOption[]
) {
  const normalized = normalizeText(text);

  const byInvoiceNo = receivables.find((invoice) =>
    normalized.includes(normalizeText(invoice.invoice_no))
  );

  if (byInvoiceNo) {
    return byInvoiceNo;
  }

  const scoredReceivables = receivables
    .map((invoice) => {
      const customerName = normalizeText(invoice.customer_name ?? "");
      const invoiceLabel = normalizeText(
        `${invoice.invoice_no} ${invoice.customer_name ?? ""}`
      );

      let score = 0;

      if (invoiceLabel && normalized.includes(invoiceLabel)) score += 8;
      if (customerName && normalized.includes(customerName)) score += 6;

      for (const word of customerName.split(" ")) {
        if (word.length >= 3 && normalized.includes(word)) {
          score += 1;
        }
      }

      return { invoice, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;

      return (
        Number(b.invoice.outstanding_amount ?? 0) -
        Number(a.invoice.outstanding_amount ?? 0)
      );
    });

  return scoredReceivables[0]?.score > 0
    ? scoredReceivables[0].invoice
    : null;
}
function pickSupplierPayableInvoice(
  text: string,
  payables: SupplierPayableInvoiceOption[]
) {
  const normalized = normalizeText(text);

  const byInvoiceNo = payables.find((invoice) =>
    normalized.includes(normalizeText(invoice.invoice_no))
  );

  if (byInvoiceNo) {
    return byInvoiceNo;
  }

  const bySupplier = payables.find((invoice) => {
    if (!invoice.supplier_name) {
      return false;
    }

    return normalized.includes(normalizeText(invoice.supplier_name));
  });

  return bySupplier ?? null;
}
function pickSaleCustomer(text: string, customers: SaleCustomerOption[]) {
  const normalized = normalizeText(text);

  const scoredCustomers = customers
    .map((customer) => {
      const customerName = normalizeText(customer.customer_name);
      const customerLabel = normalizeText(
        `${customer.customer_code} ${customer.customer_name}`
      );

      let score = 0;

      if (normalized.includes(customerLabel)) score += 6;
      if (normalized.includes(customerName)) score += 5;

      for (const word of customerName.split(" ")) {
        if (word.length >= 3 && normalized.includes(word)) {
          score += 1;
        }
      }

      return { customer, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredCustomers[0]?.score > 0 ? scoredCustomers[0].customer : null;
}

function pickSaleItem(text: string, items: SaleInventoryItemOption[]) {
  const normalized = normalizeText(text);

  const scoredItems = items
    .map((item) => {
      const itemName = normalizeText(item.item_name);
      const itemLabel = normalizeText(`${item.item_code} ${item.item_name}`);

      let score = 0;

      if (normalized.includes(itemLabel)) score += 6;
      if (normalized.includes(itemName)) score += 5;

      for (const word of itemName.split(" ")) {
        if (word.length >= 3 && normalized.includes(word)) {
          score += 1;
        }
      }

      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scoredItems[0]?.score > 0 ? scoredItems[0].item : null;
}

function parseDiscountPercentFromText(text: string) {
  const normalized = normalizeText(text);
  const discountMatch = normalized.match(
    /\b(?:diskon|potongan)\s*(\d+(?:[.,]\d+)?)\s*(?:persen|%)?\b/
  );

  if (!discountMatch?.[1]) {
    return 0;
  }

  const value = Number(discountMatch[1].replace(",", "."));

  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return 0;
  }

  return value;
}

function parseTaxAmountFromText(text: string) {
  const normalized = normalizeText(text);

  const taxMatch = normalized.match(
    /\b(?:pajak|ppn)\s*(rp\.?\s*)?(\d+(?:[.,]\d+)?(?:\s*(?:ribu|rb|juta))?)\b/
  );

  if (!taxMatch?.[2]) {
    return 0;
  }

  return parseAmountFromText(taxMatch[2]);
}
async function handleCashPurchase({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { suppliers, items } = await getCashPurchaseAssistantOptions(
    supabase,
    context
  );

  if (suppliers.length === 0 || items.length === 0) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data referensi belum lengkap.",
        warnings: ["Periksa supplier dan barang persediaan aktif unit."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const quantity = parseQuantityFromText(prompt);
  const unitCost = parseAmountFromText(prompt);
  const pickedSupplier = pickPurchaseSupplier(prompt, suppliers);
  const pickedItem = pickPurchaseItem(prompt, items);
  const warnings: string[] = [];

  if (!pickedSupplier) {
    warnings.push("Supplier belum terbaca. Pilih supplier secara manual.");
  }

  if (!pickedItem) {
    warnings.push("Barang belum terbaca. Pilih barang secara manual.");
  }

  if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
    warnings.push("Jumlah barang belum terbaca. Isi jumlah secara manual.");
  }

  if (!unitCost || !Number.isFinite(unitCost) || unitCost <= 0) {
    warnings.push("Harga beli belum terbaca. Isi harga secara manual.");
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      invoice_date: parsedDate.date,
      supplier_id: pickedSupplier?.id ?? "",
      item_id: pickedItem?.id ?? "",
      quantity: quantity > 0 ? quantity : "",
      unit_cost: unitCost > 0 ? unitCost : "",
      discount_amount: 0,
      tax_amount: 0,
      notes: buildDescription(prompt),
    },
    summary: `Assistant backend membaca pembelian tunai sebagai ${
      pickedItem
        ? `${pickedItem.item_code} - ${pickedItem.item_name}`
        : "barang belum dipilih"
    }, jumlah ${quantity > 0 ? quantity : "belum terbaca"}, harga ${
      unitCost > 0 ? unitCost : "belum terbaca"
    }, supplier ${
      pickedSupplier ? pickedSupplier.supplier_name : "belum dipilih"
    }.`,
    warnings,
    requires_user_confirmation: true,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "cash_purchase_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Pembelian Tunai.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCashPurchaseAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}
async function handleCreditPurchase({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { suppliers, items } = await getCashPurchaseAssistantOptions(
    supabase,
    context
  );

  if (!suppliers.length || !items.length) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data referensi belum lengkap.",
        warnings: ["Periksa supplier dan barang persediaan aktif unit."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const dueDate = parseCreditDueDateFromText(prompt, today);
  const quantity = parseQuantityFromText(prompt);
  const unitCost = parseAmountFromText(prompt);
  const pickedSupplier = pickPurchaseSupplier(prompt, suppliers);
  const pickedItem = pickPurchaseItem(prompt, items);
  const warnings: string[] = [];

  if (!pickedSupplier) {
    warnings.push("Supplier belum terbaca. Pilih supplier secara manual.");
  }

  if (!pickedItem) {
    warnings.push("Barang belum terbaca. Pilih barang secara manual.");
  }

  if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
    warnings.push("Jumlah barang belum terbaca. Isi jumlah secara manual.");
  }

  if (!unitCost || !Number.isFinite(unitCost) || unitCost <= 0) {
    warnings.push("Harga beli belum terbaca. Isi harga secara manual.");
  }

  if (!dueDate) {
    warnings.push(
      "Tanggal jatuh tempo belum terbaca. Isi tanggal jatuh tempo secara manual."
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      invoice_date: parsedDate.date,
      due_date: dueDate,
      supplier_id: pickedSupplier?.id ?? "",
      item_id: pickedItem?.id ?? "",
      quantity: quantity > 0 ? quantity : "",
      unit_cost: unitCost > 0 ? unitCost : "",
      discount_amount: 0,
      tax_amount: 0,
      notes: buildDescription(prompt),
    },
    summary: `Assistant backend membaca pembelian kredit sebagai ${
      pickedItem
        ? `${pickedItem.item_code} - ${pickedItem.item_name}`
        : "barang belum dipilih"
    }, jumlah ${quantity > 0 ? quantity : "belum terbaca"}, harga ${
      unitCost > 0 ? unitCost : "belum terbaca"
    }, supplier ${
      pickedSupplier ? pickedSupplier.supplier_name : "belum dipilih"
    }, jatuh tempo ${dueDate || "belum terbaca"}.`,
    warnings,
    requires_user_confirmation: true,
  };

  await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "credit_purchase_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Pembelian Kredit.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCashPurchaseAssistantOptions",
    },
  });

  return NextResponse.json(responsePayload);
}
async function handleCashSale({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { customers, items } = await getCashSaleAssistantOptions(
    supabase,
    context
  );

  if (items.length === 0) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data barang penjualan belum tersedia.",
        warnings: ["Periksa barang stok aktif unit terlebih dahulu."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const quantity = parseQuantityFromText(prompt);
  const discountPercent = parseDiscountPercentFromText(prompt);
  const taxAmount = parseTaxAmountFromText(prompt);
  const pickedCustomer = pickSaleCustomer(prompt, customers);
  const pickedItem = pickSaleItem(prompt, items);
  const warnings: string[] = [];

  if (!pickedItem) {
    warnings.push("Barang belum terbaca. Pilih barang secara manual.");
  }

  if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
    warnings.push("Jumlah barang belum terbaca. Isi jumlah secara manual.");
  }

  if (pickedItem && pickedItem.current_stock <= 0) {
    warnings.push(
      "Stok barang yang terbaca sedang kosong. Periksa stok sebelum posting."
    );
  }

  if (pickedItem && quantity > pickedItem.current_stock) {
    warnings.push(
      "Jumlah penjualan melebihi stok terbaca. Database akan memvalidasi ulang saat posting."
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      invoice_date: parsedDate.date,
      customer_id: pickedCustomer?.id ?? "",
      item_id: pickedItem?.id ?? "",
      quantity: quantity > 0 ? quantity : "",
      discount_percent: discountPercent,
      tax_amount: taxAmount,
      notes: buildDescription(prompt),
    },
    summary: `Assistant backend membaca jual tunai sebagai ${
      pickedItem
        ? `${pickedItem.item_code} - ${pickedItem.item_name}`
        : "barang belum dipilih"
    }, jumlah ${quantity > 0 ? quantity : "belum terbaca"}, pelanggan ${
      pickedCustomer ? pickedCustomer.customer_name : "umum / belum dipilih"
    }. Harga jual tetap mengikuti database.`,
    warnings,
    requires_user_confirmation: true,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "cash_sale_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Jual Tunai.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCashSaleAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}
async function handleCreditSale({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { customers, items } = await getCashSaleAssistantOptions(
    supabase,
    context
  );

  if (items.length === 0) {
    return NextResponse.json(
      {
        success: false,
        module: assistantModule,
        draft: null,
        summary: "Data barang penjualan belum tersedia.",
        warnings: ["Periksa barang stok aktif unit terlebih dahulu."],
        requires_user_confirmation: true,
      },
      { status: 422 }
    );
  }

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const dueDate = parseCreditDueDateFromText(prompt, today);
  const quantity = parseQuantityFromText(prompt);
  const discountPercent = parseDiscountPercentFromText(prompt);
  const taxAmount = parseTaxAmountFromText(prompt);
  const pickedCustomer = pickSaleCustomer(prompt, customers);
  const pickedItem = pickSaleItem(prompt, items);
  const warnings: string[] = [];

  if (!pickedItem) {
    warnings.push("Barang belum terbaca. Pilih barang secara manual.");
  }

  if (!quantity || !Number.isFinite(quantity) || quantity <= 0) {
    warnings.push("Jumlah barang belum terbaca. Isi jumlah secara manual.");
  }

  if (pickedItem && pickedItem.current_stock <= 0) {
    warnings.push(
      "Stok barang yang terbaca sedang kosong. Periksa stok sebelum posting."
    );
  }

  if (pickedItem && quantity > pickedItem.current_stock) {
    warnings.push(
      "Jumlah penjualan melebihi stok terbaca. Database akan memvalidasi ulang saat posting."
    );
  }

  if (!dueDate) {
    warnings.push(
      "Tanggal jatuh tempo belum terbaca. Isi tanggal jatuh tempo secara manual."
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    draft: {
      invoice_date: parsedDate.date,
      due_date: dueDate,
      customer_id: pickedCustomer?.id ?? "",
      item_id: pickedItem?.id ?? "",
      quantity: quantity > 0 ? quantity : "",
      discount_percent: discountPercent,
      tax_amount: taxAmount,
      notes: buildDescription(prompt),
    },
    summary: `Assistant backend membaca jual kredit sebagai ${
      pickedItem
        ? `${pickedItem.item_code} - ${pickedItem.item_name}`
        : "barang belum dipilih"
    }, jumlah ${quantity > 0 ? quantity : "belum terbaca"}, pelanggan ${
      pickedCustomer ? pickedCustomer.customer_name : "umum / belum dipilih"
    }, jatuh tempo ${dueDate || "belum terbaca"}. Harga jual tetap mengikuti database.`,
    warnings,
    requires_user_confirmation: true,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "credit_sale_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Jual Kredit.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCashSaleAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}



async function handleCapitalExpenditure({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { categories, suppliers, cashBanks } =
    await getCapitalExpenditureAssistantOptions(supabase, context);

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const amount = parseAmountFromText(prompt);
  const paymentType = inferCapitalExpenditurePaymentType(prompt);
  const pickedSupplier = pickSupplier(prompt, suppliers);
  const pickedCategory = pickCapitalExpenditureCategory(prompt, categories);
  const pickedCashBank =
    paymentType === "cash" ? pickCashBankAccount(prompt, cashBanks, amount) : null;
  const assetName = inferCapitalAssetName(prompt);
  const dueDate =
    paymentType === "credit"
      ? inferDueDateForCapitalExpenditure(prompt, parsedDate.date)
      : "";
  const usefulLifeMonths = inferUsefulLifeMonths(pickedCategory, prompt);

  const warnings: string[] = [];

  if (!pickedCategory) {
    warnings.push("Kategori aset belum terbaca. Pilih kategori aset secara manual.");
  }

  if (!assetName) {
    warnings.push("Nama aset belum terbaca. Isi nama aset secara manual.");
  }

  if (amount <= 0) {
    warnings.push("Harga aset belum terbaca. Isi harga aset secara manual.");
  }

  if (paymentType === "cash" && !pickedCashBank) {
    warnings.push("Kas/bank belum terbaca. Pilih kas/bank secara manual.");
  }

  if (
    paymentType === "cash" &&
    pickedCashBank &&
    amount > pickedCashBank.current_balance
  ) {
    warnings.push(
      `Nominal lebih besar dari saldo ${pickedCashBank.account_name} ${formatCurrency(
        pickedCashBank.current_balance
      )}. Database akan menolak jika saldo tidak cukup.`
    );
  }

  if (!pickedSupplier) {
    warnings.push(
      "Supplier belum terbaca. Boleh dipilih manual atau dikosongkan jika belum didaftarkan."
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    mode: "read_only_form_draft",
    requires_user_confirmation: true,
    draft: {
      transaction_date: parsedDate.date,
      payment_type: paymentType,
      supplier_id: pickedSupplier?.id ?? "",
      cash_bank_account_id: paymentType === "cash" ? pickedCashBank?.id ?? "" : "",
      asset_category_id: pickedCategory?.id ?? "",
      asset_name: assetName,
      quantity: 1,
      unit_price: amount > 0 ? amount : "",
      residual_value: 0,
      useful_life_months: usefulLifeMonths,
      due_date: dueDate,
      description: prompt,
      notes: prompt,
    },
    matched: {
      category: pickedCategory
        ? `${pickedCategory.category_code} - ${pickedCategory.category_name}`
        : null,
      supplier: pickedSupplier
        ? `${pickedSupplier.supplier_code} - ${pickedSupplier.supplier_name}`
        : null,
      cash_bank_account: pickedCashBank
        ? `${pickedCashBank.account_code} - ${pickedCashBank.account_name}`
        : null,
    },
    warnings,
    summary: `Assistant backend membaca belanja modal sebagai ${
      assetName || "nama aset belum terbaca"
    } senilai ${
      amount > 0 ? formatCurrency(amount) : "harga belum terbaca"
    } dengan cara bayar ${
      paymentType === "credit" ? "kredit" : "tunai"
    }. Posting tetap dilakukan oleh tombol resmi dan engine database.`,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "capital_expenditure_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Belanja Modal.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCapitalExpenditureAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}
async function handleCustomerPayment({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { receivables, cashBankAccounts } =
    await getCustomerPaymentAssistantOptions(supabase, context);

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const amount = parseAmountFromText(prompt);
  const pickedInvoice = pickCustomerReceivableInvoice(prompt, receivables);
  const pickedCashBankAccount = pickCashBankAccount(
    prompt,
    cashBankAccounts,
    amount
  );

  const outstandingAmount = Number(pickedInvoice?.outstanding_amount ?? 0);

  const warnings: string[] = [];

  if (!pickedInvoice) {
    warnings.push(
      "Invoice piutang pelanggan belum terbaca. Pilih invoice secara manual."
    );
  }

  if (!pickedCashBankAccount) {
    warnings.push("Kas/bank tujuan belum terbaca. Pilih kas/bank secara manual.");
  }

  if (!amount || amount <= 0) {
    warnings.push("Nominal penerimaan belum terbaca. Isi nominal secara manual.");
  }

  if (amount > 0 && outstandingAmount > 0 && amount > outstandingAmount) {
    warnings.push(
      "Nominal lebih besar dari sisa piutang. Kurangi nominal sebelum posting."
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const draft = {
    payment_date: parsedDate.date,
    sales_invoice_id: pickedInvoice?.sales_invoice_id ?? "",
    cash_bank_account_id: pickedCashBankAccount?.id ?? "",
    amount: amount > 0 ? amount : "",
    notes: buildDescription(prompt),
  };

  const responsePayload = {
    success: true,
    module: assistantModule,
    mode: "read_only_form_draft",
    requires_user_confirmation: true,
    draft,
    matched: {
      invoice_no: pickedInvoice?.invoice_no ?? null,
      customer_name: pickedInvoice?.customer_name ?? null,
      cash_bank_account_name: pickedCashBankAccount?.account_name ?? null,
      outstanding_amount: pickedInvoice?.outstanding_amount ?? null,
    },
    warnings,
    summary: `Assistant backend membaca ini sebagai penerimaan bayar pelanggan ${
      pickedInvoice
        ? `${pickedInvoice.invoice_no} - ${pickedInvoice.customer_name ?? "Pelanggan"}`
        : "invoice belum terbaca"
    } sebesar ${amount > 0 ? amount : "nominal belum terbaca"} ke ${
      pickedCashBankAccount
        ? pickedCashBankAccount.account_name
        : "kas/bank belum dipilih"
    }. Posting tetap dilakukan oleh tombol resmi dan engine database.`,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "customer_payment_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Terima Bayar Pelanggan.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      matched: responsePayload.matched,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCustomerPaymentAssistantOptions",
    },
  });

  if (assistantAuditError) {
    console.error("customer payment assistant audit error", assistantAuditError);
  }

  return NextResponse.json(responsePayload);
}
async function handleCapitalDebtPayment({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { payables, cashBanks } =
    await getCapitalDebtPaymentAssistantOptions(supabase, context);

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const amount = parseAmountFromText(prompt);
  const pickedPayable = pickCapitalPayable(prompt, payables);
  const pickedCashBank = pickCashBankAccount(prompt, cashBanks, amount);

  const warnings: string[] = [];

  if (!pickedPayable) {
    warnings.push(
      "Hutang belanja modal belum terbaca. Pilih hutang belanja modal secara manual."
    );
  }

  if (!pickedCashBank) {
    warnings.push(
      "Kas/bank belum terbaca. Pilih kas/bank pembayaran secara manual."
    );
  }

  if (amount <= 0) {
    warnings.push(
      "Nominal pembayaran belum terbaca. Isi nominal pembayaran secara manual."
    );
  }

  if (pickedPayable && amount > pickedPayable.outstanding_amount) {
    warnings.push(
      `Nominal lebih besar dari sisa hutang ${formatCurrency(
        pickedPayable.outstanding_amount
      )}. Database akan menolak jika melebihi sisa hutang.`
    );
  }

  if (pickedCashBank && amount > pickedCashBank.current_balance) {
    warnings.push(
      `Nominal lebih besar dari saldo ${pickedCashBank.account_name} ${formatCurrency(
        pickedCashBank.current_balance
      )}. Database akan menolak jika saldo tidak cukup.`
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    mode: "read_only_form_draft",
    requires_user_confirmation: true,
    draft: {
      payment_date: parsedDate.date,
      capital_expenditure_id: pickedPayable?.capital_expenditure_id ?? "",
      cash_bank_account_id: pickedCashBank?.id ?? "",
      amount: amount > 0 ? amount : "",
      notes: prompt,
    },
    matched: {
      payable: pickedPayable
        ? `${pickedPayable.transaction_no} - ${
            pickedPayable.supplier_name ?? "Supplier"
          }`
        : null,
      cash_bank_account: pickedCashBank
        ? `${pickedCashBank.account_code} - ${pickedCashBank.account_name}`
        : null,
    },
    warnings,
    summary: `Assistant backend membaca pembayaran hutang belanja modal sebagai ${
      amount > 0 ? formatCurrency(amount) : "nominal belum terbaca"
    }, transaksi ${
      pickedPayable?.transaction_no ?? "belum terbaca"
    }, dari ${
      pickedCashBank?.account_name ?? "kas/bank belum terbaca"
    }. Pelunasan tetap dilakukan oleh tombol resmi dan engine database.`,
  };

  const { error: assistantAuditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "capital_debt_payment_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Bayar Hutang Belanja Modal.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getCapitalDebtPaymentAssistantOptions",
    },
  });

  if (assistantAuditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}
async function handleSupplierDebtPayment({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const { payables, cashBankAccounts } =
    await getSupplierDebtPaymentAssistantOptions(supabase, context);

  const parsedDate = parseTransactionDateFromText(prompt, today);
  const amount = parseAmountFromText(prompt);
  const pickedInvoice = pickSupplierPayableInvoice(prompt, payables);
  const pickedCashBank = pickCashBankAccount(prompt, cashBankAccounts, amount);

  const warnings: string[] = [];

  if (!pickedInvoice) {
    warnings.push(
      "Invoice hutang supplier belum terbaca. Pilih invoice hutang secara manual."
    );
  }

  if (!pickedCashBank) {
    warnings.push(
      "Kas/bank belum terbaca. Pilih kas/bank pembayaran secara manual."
    );
  }

  if (amount <= 0) {
    warnings.push(
      "Nominal pembayaran belum terbaca. Isi nominal pembayaran secara manual."
    );
  }

  if (pickedInvoice && amount > pickedInvoice.outstanding_amount) {
    warnings.push(
      `Nominal lebih besar dari sisa hutang ${formatCurrency(
        pickedInvoice.outstanding_amount
      )}. Database akan menolak jika melebihi sisa hutang.`
    );
  }

  if (pickedCashBank && amount > pickedCashBank.current_balance) {
    warnings.push(
      `Nominal lebih besar dari saldo ${pickedCashBank.account_name} ${formatCurrency(
        pickedCashBank.current_balance
      )}. Database akan menolak jika saldo tidak cukup.`
    );
  }

  if (parsedDate.warning) {
    warnings.push(parsedDate.warning);
  }

  const responsePayload = {
    success: true,
    module: assistantModule,
    mode: "read_only_form_draft",
    requires_user_confirmation: true,
    draft: {
      payment_date: parsedDate.date,
      purchase_invoice_id: pickedInvoice?.purchase_invoice_id ?? "",
      cash_bank_account_id: pickedCashBank?.id ?? "",
      amount: amount > 0 ? amount : "",
      notes: prompt,
    },
    matched: {
      invoice: pickedInvoice
        ? `${pickedInvoice.invoice_no} - ${
            pickedInvoice.supplier_name ?? "Supplier"
          }`
        : null,
      cash_bank_account: pickedCashBank
        ? `${pickedCashBank.account_code} - ${pickedCashBank.account_name}`
        : null,
    },
    warnings,
    summary: `Assistant backend membaca pembayaran hutang supplier sebagai ${
      amount > 0 ? formatCurrency(amount) : "nominal belum terbaca"
    }, invoice ${
      pickedInvoice?.invoice_no ?? "belum terbaca"
    }, dari ${
      pickedCashBank?.account_name ?? "kas/bank belum terbaca"
    }. Pelunasan tetap dilakukan oleh tombol resmi dan engine database.`,
  };

  const { error: auditError } = await supabase.rpc("log_audit_event", {
    p_tenant_id: context.tenant_id,
    p_unit_id: context.unit_id,
    p_actor_id: context.user_id,
    p_actor_role: context.role,
    p_event_type: "assistant_draft_generated",
    p_entity_type: "supplier_debt_payment_assistant",
    p_entity_id: null,
    p_source_type: "unit_assistant_endpoint",
    p_source_id: null,
    p_description:
      "Assistant backend read-only menyusun draft form Bayar Hutang Supplier.",
    p_metadata: {
      module: assistantModule,
      prompt,
      draft: responsePayload.draft,
      warnings,
      requires_user_confirmation: true,
      assistant_mode: "read_only_form_draft",
      tool_name: "getSupplierDebtPaymentAssistantOptions",
    },
  });

  if (auditError) {
    responsePayload.warnings.push(
      "Draft berhasil dibuat, tetapi catatan audit assistant belum berhasil disimpan."
    );
  }

  return NextResponse.json(responsePayload);
}
type UnitAssistantPayload = {
  success?: boolean;
  module?: string;
  draft?: unknown;
  summary?: string;
  warnings?: unknown;
  requires_user_confirmation?: boolean;
  [key: string]: unknown;
};

type UnitAssistantDispatchArgs = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  context: NonNullable<Awaited<ReturnType<typeof getLoginContext>>>;
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
};

async function dispatchUnitAssistantModule({
  supabase,
  context,
  assistantModule,
  prompt,
  today,
}: UnitAssistantDispatchArgs) {
  if (assistantModule === "operational_expense") {
    return handleOperationalExpense({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "revenue_receipt") {
    return handleRevenueReceipt({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "capital_expenditure") {
    return handleCapitalExpenditure({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "customer_payment") {
    return handleCustomerPayment({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "capital_debt_payment") {
    return handleCapitalDebtPayment({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "supplier_debt_payment") {
    return handleSupplierDebtPayment({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "credit_sale") {
    return handleCreditSale({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "cash_sale") {
    return handleCashSale({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  if (assistantModule === "credit_purchase") {
    return handleCreditPurchase({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });
  }

  return handleCashPurchase({
    supabase,
    context,
    assistantModule,
    prompt,
    today,
  });
}

async function readUnitAssistantPayload(response: Response) {
  try {
    const payload = (await response.clone().json()) as UnitAssistantPayload;

    if (!payload || typeof payload !== "object") {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function getWarningsFromPayload(payload: UnitAssistantPayload | null) {
  if (!payload || !Array.isArray(payload.warnings)) {
    return [];
  }

  return payload.warnings.map((warning) => String(warning));
}

function shouldUseAiPromptNormalizer({
  payload,
  prompt,
}: {
  payload: UnitAssistantPayload | null;
  prompt: string;
}) {
  if (!payload?.success) {
    return false;
  }

  const warnings = getWarningsFromPayload(payload);
  const lowerPrompt = prompt.toLowerCase();

  const hasMissingFieldWarning = warnings.some((warning) => {
    const lowerWarning = warning.toLowerCase();

    return (
      lowerWarning.includes("belum terbaca") ||
      lowerWarning.includes("pilih") ||
      lowerWarning.includes("isi")
    );
  });

  const draft =
    payload.draft && typeof payload.draft === "object"
      ? (payload.draft as Record<string, unknown>)
      : null;

  const amountLikeValues = draft
    ? [
        draft.amount,
        draft.unit_cost,
        draft.unit_price,
        draft.total_amount,
        draft.tax_amount,
        draft.discount_amount,
      ]
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  const promptMentionsMoney =
    /\b(harga|senilai|nominal|bayar|dibayar|terima|masuk|keluar|belanja|beli)\b/.test(
      lowerPrompt
    );

  const promptMentionsLargeMoneyUnit =
    /\b(juta|jt|jta|ribu|rb)\b/.test(lowerPrompt);

  const hasSuspiciousSmallMoneyValue =
    promptMentionsMoney &&
    promptMentionsLargeMoneyUnit &&
    amountLikeValues.some((value) => value > 0 && value < 1_000);

  return hasMissingFieldWarning || hasSuspiciousSmallMoneyValue;
}
function getAssistantModuleLabel(assistantModule: AssistantModule) {
  const labels: Record<AssistantModule, string> = {
    operational_expense: "Beban Operasional",
    revenue_receipt: "Terima Pendapatan",
    cash_purchase: "Beli Tunai",
    credit_purchase: "Beli Kredit",
    cash_sale: "Jual Tunai",
    credit_sale: "Jual Kredit",
    supplier_debt_payment: "Bayar Hutang Supplier",
    capital_debt_payment: "Bayar Hutang Belanja Modal",
    capital_expenditure: "Belanja Modal",
    customer_payment: "Terima Bayar Pelanggan",
  };

  return labels[assistantModule];
}

function getAssistantModuleFieldOrder(assistantModule: AssistantModule) {
  const fieldOrders: Record<AssistantModule, string> = {
    operational_expense:
      "tanggal, akun beban, nominal, kas/bank, keterangan, catatan",
    revenue_receipt:
      "tanggal, akun pendapatan, nominal, kas/bank, keterangan, catatan",
    cash_purchase:
      "tanggal pembelian, supplier, barang, jumlah, harga beli per barang, diskon, pajak, catatan",
    credit_purchase:
      "tanggal pembelian, supplier, barang, jumlah, harga beli per barang, tanggal jatuh tempo, diskon, pajak, catatan",
    cash_sale:
      "tanggal penjualan, pelanggan bila ada, barang, jumlah, diskon, pajak, catatan",
    credit_sale:
      "tanggal penjualan, pelanggan, barang, jumlah, tanggal jatuh tempo, diskon, pajak, catatan",
    supplier_debt_payment:
      "tanggal bayar, supplier/invoice hutang, nominal bayar, kas/bank sumber, catatan",
    capital_debt_payment:
      "tanggal bayar, transaksi hutang belanja modal, nominal bayar, kas/bank sumber, catatan",
    capital_expenditure:
      "tanggal belanja, cara bayar tunai/kredit, supplier, kas/bank bila tunai, kategori aset, nama aset, harga, jatuh tempo bila kredit, catatan",
    customer_payment:
      "tanggal terima bayar, pelanggan/invoice piutang, nominal terima, kas/bank tujuan, catatan",
  };

  return fieldOrders[assistantModule];
}

function extractJsonObjectFromAiText(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    throw new Error("ORVIA AI tidak mengembalikan JSON normalisasi.");
  }

  return JSON.parse(text.slice(start, end + 1)) as {
    canonical_prompt?: unknown;
    confidence?: unknown;
    reason?: unknown;
  };
}

async function normalizePromptWithOrviaAi({
  assistantModule,
  prompt,
  today,
}: {
  assistantModule: AssistantModule;
  prompt: string;
  today: string;
}) {
  const moduleLabel = getAssistantModuleLabel(assistantModule);
  const fieldOrder = getAssistantModuleFieldOrder(assistantModule);

  const aiInput = `
Anda adalah ORVIA Transaction AI Normalizer.

Tugas Anda hanya merapikan kalimat transaksi operator agar mudah dibaca parser lokal ERP BUMDes.
Jangan mengisi UUID.
Jangan mengarang nama supplier, pelanggan, barang, invoice, atau akun kas/bank yang tidak ada di kalimat operator.
Jangan memposting transaksi.
Jangan mengubah saldo, stok, hutang, atau piutang.
Jangan menambahkan markdown.
Kembalikan hanya JSON valid.

Modul transaksi: ${moduleLabel}
Tanggal hari ini: ${today}
Urutan field lokal: ${fieldOrder}

Aturan normalisasi utama:
- Tugasmu BUKAN mengisi field, BUKAN membuat daftar, dan BUKAN membuat CSV.
- Tugasmu hanya mengubah kalimat operator menjadi SATU KALIMAT transaksi bahasa Indonesia yang sederhana.
- Jangan pernah mengembalikan canonical_prompt dalam bentuk daftar koma seperti: tanggal, supplier, barang, jumlah, harga, 0, 0.
- Jangan pernah menulis nilai kosong sebagai 0. Jika informasi tidak ada, jangan disebutkan.
- Boleh memperbaiki typo umum dan bahasa operator tanpa mengarang data baru.
- Contoh koreksi yang boleh: "bili" atau "bli" menjadi "beli"; "baras" atau "brs" menjadi "beras"; "pa indra" atau "sama indra" menjadi "dari indra"; "5jta" atau "5jt" menjadi "5 juta".
- Jika operator menyebut jumlah tanpa satuan, tulis dengan pola "jumlah <angka>" agar parser lokal bisa membaca jumlah.
- Jika operator menulis "kemarin", tetap pakai "kemarin". Jika menulis "hari ini", tetap pakai "hari ini".
- Jika ada angka dengan kata "ribu", "rb", "juta", "jt", atau "jta", pertahankan maknanya.
- Jangan mengarang nama supplier, pelanggan, barang, invoice, akun kas/bank, atau nominal yang tidak ada di kalimat operator.

Contoh khusus pembelian:
Input: kemarin dulu kita ada bili baras pa indra 10 harga 5 juta
canonical_prompt: kemarin beli beras jumlah 10 dari indra harga 5 juta

Input: dari indra ambil semen 10 sak kemarin harga 150 ribu
canonical_prompt: kemarin beli semen 10 sak dari indra harga 150 ribu

Format JSON:
{
  "canonical_prompt": "satu kalimat transaksi yang sudah rapi, bukan CSV",
  "confidence": "low|medium|high",
  "reason": "alasan singkat kenapa dirapikan"
}

Kalimat operator:
${prompt}
`.trim();

  const aiResult = await generateOrviaAiText(aiInput);
  const parsed = extractJsonObjectFromAiText(aiResult.text);
  const canonicalPrompt = String(parsed.canonical_prompt ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!canonicalPrompt) {
    throw new Error("ORVIA AI tidak menghasilkan canonical_prompt.");
  }

  const commaParts = canonicalPrompt
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  const looksLikeFieldList =
    commaParts.length >= 4 ||
    /(^|,\s*)0(\s*,|$)/.test(canonicalPrompt) ||
    /^([^.!?]+,\s*){3,}[^.!?]+$/.test(canonicalPrompt);

  const hasTransactionVerb =
    /\b(beli|jual|bayar|terima|belanja|pendapatan|beban|modal|utang|hutang|piutang|setor|masuk|keluar)\b/i.test(
      canonicalPrompt
    );

  if (looksLikeFieldList || !hasTransactionVerb) {
    throw new Error("ORVIA AI menghasilkan normalisasi yang tidak berbentuk kalimat transaksi.");
  }

  return {
    provider: aiResult.provider,
    model: aiResult.model,
    canonicalPrompt,
    confidence: String(parsed.confidence ?? "medium"),
    reason: String(parsed.reason ?? "ORVIA AI merapikan kalimat operator."),
  };
}

async function withAiNormalizerMetadata({
  response,
  originalPrompt,
  normalizedPrompt,
  provider,
  model,
  confidence,
  reason,
}: {
  response: Response;
  originalPrompt: string;
  normalizedPrompt: string;
  provider: string;
  model: string;
  confidence: string;
  reason: string;
}) {
  const payload = await readUnitAssistantPayload(response);

  if (!payload) {
    return response;
  }

  const warnings = getWarningsFromPayload(payload);

  return NextResponse.json(
    {
      ...payload,
      summary:
        typeof payload.summary === "string"
          ? `${payload.summary} ORVIA AI merapikan kalimat operator sebelum parser lokal mengisi form.`
          : "ORVIA AI merapikan kalimat operator sebelum parser lokal mengisi form.",
      warnings: [
        ...warnings,
        `ORVIA AI dipakai karena kalimat awal belum terbaca lengkap. Confidence: ${confidence}.`,
      ],
      assistant_engine: "local_parser_with_ai_prompt_normalizer",
      ai_attempted: true,
      ai_used: true,
      ai_status: "succeeded",
      ai_provider: provider,
      ai_model: model,
      ai_original_prompt: originalPrompt,
      ai_normalized_prompt: normalizedPrompt,
      ai_reason: reason,
      requires_user_confirmation: true,
    },
    { status: response.status }
  );
}

async function withAiNormalizerFailureMetadata({
  response,
  error,
}: {
  response: Response;
  error: unknown;
}) {
  const payload = await readUnitAssistantPayload(response);

  if (!payload) {
    return response;
  }

  const warnings = getWarningsFromPayload(payload);

  return NextResponse.json(
    {
      ...payload,
      warnings: [...warnings, getSafeOrviaAiErrorMessage(error)],
      assistant_engine: "local_parser_with_failed_ai_prompt_normalizer",
      ai_attempted: true,
      ai_used: false,
      ai_status: "failed",
      ai_error: getSafeOrviaAiErrorMessage(error),
      requires_user_confirmation: true,
    },
    { status: response.status }
  );
}
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const assistantModule = String(body?.module ?? "") as AssistantModule;
    const prompt = String(body?.prompt ?? "").trim();
    const clientToday = String(body?.client_today ?? "").trim();

    if (
      assistantModule !== "operational_expense" &&
      assistantModule !== "revenue_receipt" &&
      assistantModule !== "cash_purchase" &&
      assistantModule !== "credit_purchase" &&
      assistantModule !== "cash_sale" &&
      assistantModule !== "credit_sale" &&
      assistantModule !== "supplier_debt_payment" &&
      assistantModule !== "capital_debt_payment" &&
      assistantModule !== "capital_expenditure" &&
      assistantModule !== "customer_payment"
    ) {
      return NextResponse.json(
        {
          success: false,
          module: assistantModule,
          draft: null,
          summary: "Modul assistant belum tersedia.",
          warnings: [
            "Untuk tahap ini, endpoint mendukung Beban Operasional, Terima Pendapatan, dan Pembelian Tunai.",
          ],
          requires_user_confirmation: true,
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          module: assistantModule,
          draft: null,
          summary: "Kalimat transaksi belum diisi.",
          warnings: ["Tulis transaksi dengan bahasa biasa terlebih dahulu."],
          requires_user_confirmation: true,
        },
        { status: 400 }
      );
    }

    const context = await getLoginContext();

    if (!context?.tenant_id || !context.unit_id) {
      return NextResponse.json(
        {
          success: false,
          module: assistantModule,
          draft: null,
          summary: "Sesi unit tidak valid.",
          warnings: ["Silakan login ulang sebagai pengguna unit."],
          requires_user_confirmation: true,
        },
        { status: 401 }
      );
    }

    const supabase = await createClient();
    const today = isValidDateInput(clientToday)
      ? clientToday
      : formatDateInput(new Date());

    const localResponse = await dispatchUnitAssistantModule({
      supabase,
      context,
      assistantModule,
      prompt,
      today,
    });

    const localPayload = await readUnitAssistantPayload(localResponse);

    if (!shouldUseAiPromptNormalizer({ payload: localPayload, prompt })) {
      return localResponse;
    }

    try {
      const normalized = await normalizePromptWithOrviaAi({
        assistantModule,
        prompt,
        today,
      });

      if (
        normalizeText(normalized.canonicalPrompt) === normalizeText(prompt)
      ) {
        return localResponse;
      }

      const aiNormalizedResponse = await dispatchUnitAssistantModule({
        supabase,
        context,
        assistantModule,
        prompt: normalized.canonicalPrompt,
        today,
      });

      return withAiNormalizerMetadata({
        response: aiNormalizedResponse,
        originalPrompt: prompt,
        normalizedPrompt: normalized.canonicalPrompt,
        provider: normalized.provider,
        model: normalized.model,
        confidence: normalized.confidence,
        reason: normalized.reason,
      });
    } catch (aiError) {
      return withAiNormalizerFailureMetadata({
        response: localResponse,
        error: aiError,
      });
    }} catch (error) {
    return NextResponse.json(
      {
        success: false,
        module: "unit_assistant",
        draft: null,
        summary: "Assistant gagal menyusun draft form.",
        warnings: [
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan yang tidak diketahui.",
        ],
        requires_user_confirmation: true,
      },
      { status: 500 }
    );
  }
}

