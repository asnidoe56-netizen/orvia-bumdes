import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import {
  getCashPurchaseAssistantOptions,
  getOperationalExpenseAssistantOptions,
  getRevenueReceiptAssistantOptions,
  type AssistantCashBankAccountOption,
  type AssistantExpenseAccountOption,
  type AssistantPurchaseInventoryItemOption,
  type AssistantPurchaseSupplierOption,
  type AssistantRevenueAccountOption,
} from "@/lib/assistant/unit-assistant-tools";

type AssistantModule =
  | "operational_expense"
  | "revenue_receipt"
  | "cash_purchase"
  | "credit_purchase";

type ExpenseAccountOption = AssistantExpenseAccountOption;
type RevenueAccountOption = AssistantRevenueAccountOption;
type CashBankAccountOption = AssistantCashBankAccountOption;
type PurchaseSupplierOption = AssistantPurchaseSupplierOption;
type PurchaseInventoryItemOption = AssistantPurchaseInventoryItemOption;

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
    .replace(/(\d)(juta|ribu|rb)\b/g, "$1 $2")
    .replace(/\b(juta|ribu|rb)(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  const jutaRibuMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*juta(?:\s*(\d+(?:[.,]\d+)?)(?:\s*(ribu|rb))?)?/
  );

  if (jutaRibuMatch?.[1]) {
    const jutaPart = Number(jutaRibuMatch[1].replace(",", "."));
    const tailRaw = jutaRibuMatch[2];
    const tailUnit = jutaRibuMatch[3] ?? "";

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
      assistantModule !== "credit_purchase"
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
  } catch (error) {
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







