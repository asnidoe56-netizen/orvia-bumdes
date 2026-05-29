"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { createJournalCorrectionRequestAction } from "../actions";

type AccountOption = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_tipe: string;
  account_type: string;
  normal_balance: string;
  unit_id: string | null;
};

type OriginalLine = {
  journal_line_id: string;
  line_no: number | string;
  account_id: string;
  account_code: string;
  account_name: string;
  line_description: string | null;
  debit: number | string;
  credit: number | string;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatNumberInput(value: number | string | null | undefined) {
  const numberValue = toNumber(value);
  if (numberValue === 0) return "";
  return String(Math.round(numberValue));
}

function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function CorrectionRequestForm({
  journalEntryId,
  originalJournalDate,
  originalDescription,
  originalLines,
  accountOptions,
}: {
  journalEntryId: string;
  originalJournalDate: string;
  originalDescription: string;
  originalLines: OriginalLine[];
  accountOptions: AccountOption[];
}) {
  const [lineCount, setLineCount] = useState(Math.max(originalLines.length, 2));

  const initialLines = useMemo(() => {
    return Array.from({ length: lineCount }).map((_, index) => {
      const original = originalLines[index];

      return {
        key: `${index}-${original?.journal_line_id ?? "new"}`,
        accountId: original?.account_id ?? "",
        description: original?.line_description ?? originalDescription,
        debit: formatNumberInput(original?.debit),
        credit: formatNumberInput(original?.credit),
      };
    });
  }, [lineCount, originalDescription, originalLines]);

  const [lines, setLines] = useState(initialLines);

  const totalDebit = lines.reduce((sum, line) => sum + toNumber(line.debit), 0);
  const totalCredit = lines.reduce((sum, line) => sum + toNumber(line.credit), 0);
  const activeLines = lines.filter(
    (line) =>
      line.accountId &&
      (toNumber(line.debit) > 0 || toNumber(line.credit) > 0)
  );
  const distinctAccountCount = new Set(activeLines.map((line) => line.accountId)).size;
  const hasLineWithDebitAndCredit = lines.some(
    (line) => toNumber(line.debit) > 0 && toNumber(line.credit) > 0
  );
  const hasEmptyActiveLine = lines.some(
    (line) =>
      line.accountId &&
      toNumber(line.debit) === 0 &&
      toNumber(line.credit) === 0
  );
  const hasAmountWithoutAccount = lines.some(
    (line) =>
      !line.accountId &&
      (toNumber(line.debit) > 0 || toNumber(line.credit) > 0)
  );
  const isBalanced = Math.round(totalDebit) === Math.round(totalCredit) && totalDebit > 0;
  const canSubmit =
    isBalanced &&
    activeLines.length >= 2 &&
    distinctAccountCount >= 2 &&
    !hasLineWithDebitAndCredit &&
    !hasEmptyActiveLine &&
    !hasAmountWithoutAccount;

  function updateLine(index: number, key: "accountId" | "description" | "debit" | "credit", value: string) {
    setLines((current) =>
      current.map((line, lineIndex) => {
        if (lineIndex !== index) return line;

        if (key === "debit" && toNumber(value) > 0) {
          return { ...line, debit: value, credit: "" };
        }

        if (key === "credit" && toNumber(value) > 0) {
          return { ...line, credit: value, debit: "" };
        }

        return { ...line, [key]: value };
      })
    );
  }

  function addLine() {
    setLineCount((current) => current + 1);
    setLines((current) => [
      ...current,
      {
        key: `new-${Date.now()}`,
        accountId: "",
        description: originalDescription,
        debit: "",
        credit: "",
      },
    ]);
  }

  function removeLine(index: number) {
    setLineCount((current) => Math.max(current - 1, 2));
    setLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  return (
    <form action={createJournalCorrectionRequestAction} className="space-y-5">
      <input type="hidden" name="journal_entry_id" value={journalEntryId} />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Alasan Koreksi</h2>
        <p className="mt-1 text-sm text-slate-600">
          Jelaskan kenapa transaksi ini perlu dikoreksi. Alasan ini akan dibaca Pengawas.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">
              Tanggal Transaksi Pengganti
            </span>
            <input
              type="date"
              name="corrected_journal_date"
              defaultValue={originalJournalDate}
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-bold text-slate-700">
              Keterangan Transaksi Pengganti
            </span>
            <input
              type="text"
              name="corrected_description"
              defaultValue={`Koreksi: ${originalDescription}`}
              required
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm font-bold text-slate-700">Alasan Koreksi</span>
          <textarea
            name="reason"
            required
            rows={4}
            placeholder="Contoh: Akun pendapatan yang dipilih keliru, sehingga perlu diganti ke akun pendapatan jasa."
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
          />
        </label>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Susun Transaksi Pengganti
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Baris awal disalin dari transaksi lama. Ubah akun, debit, kredit, atau keterangan sesuai koreksi.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-bold text-slate-950">
              Debit: {formatRupiah(totalDebit)}
            </div>
            <div className="font-bold text-slate-950">
              Kredit: {formatRupiah(totalCredit)}
            </div>
            <div className={isBalanced ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
              {isBalanced ? "Seimbang" : "Belum seimbang"}
            </div>
            <div className={distinctAccountCount >= 2 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
              {distinctAccountCount >= 2 ? "Akun valid" : "Minimal 2 akun berbeda"}
            </div>
            <div className={distinctAccountCount >= 2 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
              {distinctAccountCount >= 2 ? "Akun valid" : "Minimal 2 akun berbeda"}
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {lines.map((line, index) => (
            <div
              key={line.key}
              className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-700">
                  Baris {index + 1}
                </p>

                {lines.length > 2 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-600 shadow-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_0.7fr_0.7fr]">
                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Akun
                  </span>
                  <select
                    name="account_id"
                    value={line.accountId}
                    onChange={(event) => updateLine(index, "accountId", event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  >
                    <option value="">Pilih akun</option>
                    {accountOptions.map((account) => (
                      <option key={account.account_id} value={account.account_id}>
                        {account.account_code} - {account.account_name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Keterangan Baris
                  </span>
                  <input
                    type="text"
                    name="line_description"
                    value={line.description}
                    onChange={(event) => updateLine(index, "description", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Debit
                  </span>
                  <input
                    type="number"
                    name="debit"
                    min="0"
                    step="1"
                    value={line.debit}
                    onChange={(event) => updateLine(index, "debit", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Kredit
                  </span>
                  <input
                    type="number"
                    name="credit"
                    min="0"
                    step="1"
                    value={line.credit}
                    onChange={(event) => updateLine(index, "credit", event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addLine}
          className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          Tambah Baris
        </button>

        {!canSubmit ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
            Pastikan total debit dan kredit seimbang, minimal memakai dua akun
            berbeda, dan satu baris hanya berisi debit atau kredit saja.
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
        Pengajuan ini belum mengubah pembukuan. Setelah dikirim, Pengawas akan
        mereview. Jika disetujui, pengaju dapat memposting koreksi final dari
        halaman Koreksi Transaksi Unit.
      </section>

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        <CheckCircle2 className="h-4 w-4" />
        Ajukan Koreksi ke Pengawas
      </button>
    </form>
  );
}

