"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createAndPostOperationalExpense,
  type OperationalExpenseActionState,
} from "../_actions/expense-actions";
import type {
  CashBankAccountOption,
  ExpenseAccountOption,
} from "./expense-entry-section";

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

const initialState: OperationalExpenseActionState = {
  success: false,
  message: "",
};

type AssistantResult = {
  message: string;
  tone: "success" | "warning" | "info";
};

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function parseAmountFromText(text: string) {
  const normalized = text
    .toLowerCase()
    .replace(/\brp\.?\s?/g, "")
    .replace(/\s+/g, " ");

  const jutaMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*juta/);
  if (jutaMatch?.[1]) {
    return String(Math.round(Number(jutaMatch[1].replace(",", ".")) * 1_000_000));
  }

  const ribuMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ribu|rb)/);
  if (ribuMatch?.[1]) {
    return String(Math.round(Number(ribuMatch[1].replace(",", ".")) * 1_000));
  }

  const numberMatch = normalized.match(/\b\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?\b|\b\d+\b/);
  if (!numberMatch?.[0]) {
    return "";
  }

  const amount = Number(
    numberMatch[0]
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(",", ".")
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    return "";
  }

  return String(Math.round(amount));
}

function pickExpenseAccount(
  text: string,
  expenseAccounts: ExpenseAccountOption[]
) {
  const normalized = normalizeText(text);

  const rules: Array<{
    keywords: string[];
    accountName: string;
  }> = [
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
  amountText: string
) {
  const normalized = normalizeText(text);
  const amount = Number(amountText || 0);
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

function buildDescription(text: string) {
  const cleaned = text.trim().replace(/\s+/g, " ");

  if (!cleaned) {
    return "";
  }

  const firstLetter = cleaned.charAt(0).toUpperCase();
  return `${firstLetter}${cleaned.slice(1)}`;
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

function parseTransactionDateFromText(text: string, today: string) {
  const normalized = normalizeText(text);
  const todayDate = parseDateInput(today);

  if (normalized.includes("hari ini")) {
    return {
      expenseDate: today,
      operatorReason: "",
      warning: "",
    };
  }

  if (normalized.includes("kemarin")) {
    const yesterday = new Date(todayDate);
    yesterday.setDate(todayDate.getDate() - 1);

    return {
      expenseDate: formatDateInput(yesterday),
      operatorReason: "Transaksi terjadi kemarin dan baru dicatat hari ini.",
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
        expenseDate,
        operatorReason:
          expenseDate === today
            ? ""
            : isPreviousMonth
              ? `Transaksi disebut terjadi pada tanggal ${day} bulan sebelumnya dan baru dicatat hari ini.`
              : `Transaksi disebut terjadi pada tanggal ${day} dan baru dicatat hari ini.`,
        warning: isPreviousMonth
          ? `Tanggal ${day} lebih besar dari tanggal hari ini, maka sistem membaca transaksi ini sebagai tanggal ${day} bulan sebelumnya. Silakan periksa kembali sebelum posting.`
          : "",
      };
    }
  }

  return {
    expenseDate: today,
    operatorReason: "",
    warning: "",
  };
}

export function ExpenseEntryForm({
  expenseAccounts,
  cashBankAccounts,
}: {
  expenseAccounts: ExpenseAccountOption[];
  cashBankAccounts: CashBankAccountOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    createAndPostOperationalExpense,
    initialState
  );

  const today = formatDateInput(new Date());

  const [expenseDate, setExpenseDate] = useState(today);
  const [expenseNo, setExpenseNo] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [cashBankAccountId, setCashBankAccountId] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [description, setDescription] = useState("");
  const [operatorReason, setOperatorReason] = useState("");
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantResult, setAssistantResult] = useState<AssistantResult | null>(
    null
  );

  const selectedCashBankAccount = useMemo(
    () =>
      cashBankAccounts.find((account) => account.id === cashBankAccountId) ??
      null,
    [cashBankAccountId, cashBankAccounts]
  );

  function handleAssistantFill() {
    const prompt = assistantPrompt.trim();

    if (!prompt) {
      setAssistantResult({
        tone: "warning",
        message:
          "Tulis dulu transaksi dengan bahasa biasa. Contoh: Bayar bensin motor Rp50.000 dari kas hari ini.",
      });
      return;
    }

    const parsedAmount = parseAmountFromText(prompt);
    const pickedExpenseAccount = pickExpenseAccount(prompt, expenseAccounts);
    const pickedCashBankAccount = pickCashBankAccount(
      prompt,
      cashBankAccounts,
      parsedAmount
    );

    if (!pickedExpenseAccount) {
      setAssistantResult({
        tone: "warning",
        message:
          "Akun beban belum tersedia. Silakan cek master akun sebelum mencatat transaksi.",
      });
      return;
    }

    if (!pickedCashBankAccount) {
      setAssistantResult({
        tone: "warning",
        message:
          "Akun kas/bank belum tersedia. Silakan cek menu Kas & Bank sebelum mencatat transaksi.",
      });
      return;
    }

    const parsedDate = parseTransactionDateFromText(prompt, today);

    setExpenseDate(parsedDate.expenseDate);
    setOperatorReason(parsedDate.operatorReason);
    setExpenseAccountId(pickedExpenseAccount.id);
    setCashBankAccountId(pickedCashBankAccount.id);

    if (parsedAmount) {
      setTotalAmount(parsedAmount);
    }

    setDescription(buildDescription(prompt));

    const amount = Number(parsedAmount || 0);
    const balance = Number(pickedCashBankAccount.current_balance ?? 0);

    if (amount > 0 && balance < amount) {
      setAssistantResult({
        tone: "warning",
        message: `Form sudah dibantu isi, tetapi saldo ${pickedCashBankAccount.account_name} hanya ${formatRupiah(balance)}. Silakan periksa kembali sumber dana sebelum menekan tombol posting.`,
      });
      return;
    }

    setAssistantResult({
      tone: parsedDate.warning ? "warning" : "success",
      message: parsedDate.warning
        ? `Form sudah dibantu isi. ${parsedDate.warning}`
        : "Form sudah dibantu isi. Silakan periksa tanggal, jenis beban, sumber dana, nominal, dan keterangan sebelum menekan tombol posting.",
    });
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.message ? (
        <div
          className={
            state.success
              ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800"
              : "rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-700"
          }
        >
          {state.message}
        </div>
      ) : null}

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-emerald-950">
            Asisten Isi Transaksi
          </p>
          <p className="text-sm leading-6 text-emerald-800">
            Tulis pengeluaran dengan bahasa biasa. Asisten hanya membantu mengisi
            form. Posting tetap dilakukan oleh petugas melalui tombol resmi.
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <textarea
            value={assistantPrompt}
            onChange={(event) => setAssistantPrompt(event.target.value)}
            rows={3}
            placeholder="Contoh: Bayar bensin motor operasional Rp50.000 dari kas hari ini"
            className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleAssistantFill}
              disabled={
                expenseAccounts.length === 0 || cashBankAccounts.length === 0
              }
              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Gunakan Asisten untuk Isi Form
            </button>

            <p className="text-xs leading-5 text-emerald-800">
              Asisten tidak menyimpan, tidak memposting, dan tidak mengubah data
              database.
            </p>
          </div>

          {assistantResult ? (
            <div
              className={
                assistantResult.tone === "success"
                  ? "rounded-xl border border-emerald-300 bg-white p-3 text-sm leading-6 text-emerald-800"
                  : assistantResult.tone === "warning"
                    ? "rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm leading-6 text-amber-900"
                    : "rounded-xl border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-700"
              }
            >
              {assistantResult.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="expense_date"
            className="text-sm font-medium text-slate-700"
          >
            Tanggal Transaksi
          </label>
          <input
            id="expense_date"
            name="expense_date"
            type="date"
            value={expenseDate}
            onChange={(event) => setExpenseDate(event.target.value)}
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense_no"
            className="text-sm font-medium text-slate-700"
          >
            Nomor Transaksi
          </label>
          <input
            id="expense_no"
            name="expense_no"
            type="text"
            value={expenseNo}
            onChange={(event) => setExpenseNo(event.target.value)}
            placeholder="Otomatis jika dikosongkan"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="expense_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Jenis Beban
          </label>
          <select
            id="expense_account_id"
            name="expense_account_id"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={expenseAccountId}
            onChange={(event) => setExpenseAccountId(event.target.value)}
            required
          >
            <option value="" disabled>
              Pilih jenis beban
            </option>

            {expenseAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.kode} - {account.nama}
              </option>
            ))}
          </select>

          {expenseAccounts.length === 0 ? (
            <p className="text-xs text-rose-600">
              Belum ada akun beban aktif untuk unit ini.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="cash_bank_account_id"
            className="text-sm font-medium text-slate-700"
          >
            Dibayar Dari
          </label>
          <select
            id="cash_bank_account_id"
            name="cash_bank_account_id"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            value={cashBankAccountId}
            onChange={(event) => setCashBankAccountId(event.target.value)}
            required
          >
            <option value="" disabled>
              Pilih kas/bank
            </option>

            {cashBankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.account_code} - {account.account_name} (
                {formatRupiah(account.current_balance)})
              </option>
            ))}
          </select>

          {cashBankAccounts.length === 0 ? (
            <p className="text-xs text-rose-600">
              Belum ada akun kas/bank aktif untuk unit ini.
            </p>
          ) : null}

          {selectedCashBankAccount ? (
            <p className="text-xs leading-5 text-slate-500">
              Saldo saat ini:{" "}
              <span className="font-semibold text-slate-700">
                {formatRupiah(selectedCashBankAccount.current_balance)}
              </span>
            </p>
          ) : null}
        </div>

        <div className="space-y-2 md:col-span-2">
          <label
            htmlFor="total_amount"
            className="text-sm font-medium text-slate-700"
          >
            Nominal
          </label>
          <input
            id="total_amount"
            name="total_amount"
            type="number"
            min="1"
            step="1"
            value={totalAmount}
            onChange={(event) => setTotalAmount(event.target.value)}
            placeholder="Contoh: 50000"
            className="h-11 w-full rounded-xl border border-slate-900 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="description"
          className="text-sm font-medium text-slate-700"
        >
          Keterangan
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Contoh: Bayar listrik kantor unit bulan Mei"
          className="w-full rounded-xl border border-slate-900 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="space-y-2">
          <label
            htmlFor="operator_reason"
            className="text-sm font-medium text-amber-900"
          >
            Alasan tanggal input berbeda
          </label>
          <textarea
            id="operator_reason"
            name="operator_reason"
            rows={3}
            value={operatorReason}
            onChange={(event) => setOperatorReason(event.target.value)}
            placeholder="Contoh: Nota baru diterima dari lapangan hari ini."
            className="w-full rounded-xl border border-amber-400 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-100"
          />
          <p className="text-xs leading-5 text-amber-800">
            Isi bagian ini jika tanggal transaksi berbeda dari tanggal input hari ini.
            Sistem tetap mencatat transaksi sesuai tanggal transaksi, dan menyimpan
            catatan ini untuk transparansi administrasi.
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
        Setelah disimpan, engine database akan otomatis membuat jurnal beban,
        transaksi kas/bank keluar, audit log, dan validasi saldo kas/bank.
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isPending ||
            expenseAccounts.length === 0 ||
            cashBankAccounts.length === 0
          }
          className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Menyimpan..." : "Simpan & Posting Beban Operasional"}
        </button>
      </div>
    </form>
  );
}




