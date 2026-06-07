import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type AssistantModule = "operational_expense";

type ExpenseAccountOption = {
  id: string;
  kode: string;
  nama: string;
};

type CashBankAccountOption = {
  id: string;
  account_code: string;
  account_name: string;
  account_kind: string;
  current_balance: number;
};

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
    .replace(/\s+/g, " ");

  const jutaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*juta/);
  if (jutaMatch?.[1]) {
    return Math.round(Number(jutaMatch[1].replace(",", ".")) * 1_000_000);
  }

  const ribuMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb)/);
  if (ribuMatch?.[1]) {
    return Math.round(Number(ribuMatch[1].replace(",", ".")) * 1_000);
  }

  const numberMatch = normalized.match(
    /\b\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?\b|\b\d+\b/
  );

  if (!numberMatch?.[0]) {
    return 0;
  }

  const amount = Number(
    numberMatch[0]
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
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
      expense_date: today,
      operator_reason: "",
      warning: "",
    };
  }

  if (normalized.includes("kemarin")) {
    const yesterday = new Date(todayDate);
    yesterday.setDate(todayDate.getDate() - 1);

    return {
      expense_date: formatDateInput(yesterday),
      operator_reason: "Transaksi terjadi kemarin dan baru dicatat hari ini.",
      warning: "",
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

      const expenseDate = formatDateInput(parsedDate);
      const isPreviousMonth = day > todayDay;

      return {
        expense_date: expenseDate,
        operator_reason:
          expenseDate === today
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
    expense_date: today,
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    const assistantModule = String(body?.module ?? "") as AssistantModule;
    const prompt = String(body?.prompt ?? "").trim();
    const clientToday = String(body?.client_today ?? "").trim();

    if (assistantModule !== "operational_expense") {
      return NextResponse.json(
        {
          success: false,
          module: assistantModule,
          draft: null,
          summary: "Modul assistant belum tersedia.",
          warnings: ["Untuk tahap awal, endpoint baru mendukung Beban Operasional."],
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

    const { data: expenseAccounts, error: expenseAccountsError } =
      await supabase
        .from("chart_of_accounts")
        .select("id, kode, nama")
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .eq("tipe", "beban")
        .eq("account_type", "BEBAN")
        .eq("normal_balance", "debit")
        .eq("is_active", true)
        .eq("is_postable", true)
        .order("kode", { ascending: true });

    if (expenseAccountsError) {
      throw new Error(expenseAccountsError.message);
    }

    const { data: cashBankAccounts, error: cashBankAccountsError } =
      await supabase
        .from("v_cash_bank_balance")
        .select("cash_bank_account_id, account_code, account_name, account_kind, current_balance")
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .order("account_code", { ascending: true });

    if (cashBankAccountsError) {
      throw new Error(cashBankAccountsError.message);
    }

    const safeExpenseAccounts = (expenseAccounts ?? []) as ExpenseAccountOption[];
    const safeCashBankAccounts = (cashBankAccounts ?? [])
      .filter((account) => Boolean(account.cash_bank_account_id))
      .map((account) => ({
        id: account.cash_bank_account_id as string,
        account_code: account.account_code ?? "",
        account_name: account.account_name ?? "",
        account_kind: account.account_kind ?? "",
        current_balance: Number(account.current_balance ?? 0),
      })) as CashBankAccountOption[];

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

    const today = isValidDateInput(clientToday)
      ? clientToday
      : formatDateInput(new Date());

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

    return NextResponse.json({
      success: true,
      module: assistantModule,
      draft: {
        expense_date: parsedDate.expense_date,
        expense_account_id: pickedExpenseAccount.id,
        cash_bank_account_id: pickedCashBankAccount.id,
        total_amount: amount > 0 ? amount : "",
        description: buildDescription(prompt),
        operator_reason: parsedDate.operator_reason,
      },
      summary: `Assistant backend membaca ini sebagai ${pickedExpenseAccount.kode} - ${pickedExpenseAccount.nama} melalui ${pickedCashBankAccount.account_name}.`,
      warnings,
      requires_user_confirmation: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        module: "operational_expense",
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


