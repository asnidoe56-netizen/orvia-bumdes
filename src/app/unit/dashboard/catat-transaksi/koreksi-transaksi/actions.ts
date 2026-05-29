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

function parseMoney(value: FormDataEntryValue | null) {
  const raw = String(value ?? "")
    .replace(/\./g, "")
    .replace(/,/g, ".")
    .trim();

  if (!raw) return 0;

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Nilai debit/kredit tidak valid.");
  }

  return parsed;
}

function assertUnitCorrectionRole(role: string) {
  if (!["manager_unit", "operator_unit", "admin_bumdes"].includes(role)) {
    throw new Error("Akses koreksi transaksi unit tidak valid.");
  }
}

export async function createJournalCorrectionRequestAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCorrectionRole(role);

  const originalJournalEntryId = getRequiredString(
    formData,
    "journal_entry_id",
    "Transaksi lama belum dipilih."
  );

  const reason = getRequiredString(
    formData,
    "reason",
    "Alasan koreksi wajib diisi."
  );

  const correctedJournalDate = getRequiredString(
    formData,
    "corrected_journal_date",
    "Tanggal transaksi pengganti wajib diisi."
  );

  const correctedDescription = getRequiredString(
    formData,
    "corrected_description",
    "Keterangan transaksi pengganti wajib diisi."
  );

  const accountIds = formData.getAll("account_id").map((value) => String(value).trim());
  const descriptions = formData.getAll("line_description").map((value) => String(value ?? "").trim());
  const debits = formData.getAll("debit");
  const credits = formData.getAll("credit");

  const lines = accountIds
    .map((accountId, index) => {
      const debit = parseMoney(debits[index] ?? null);
      const credit = parseMoney(credits[index] ?? null);

      return {
        account_id: accountId,
        debit,
        credit,
        description: descriptions[index] || correctedDescription,
      };
    })
    .filter((line) => line.account_id && (line.debit > 0 || line.credit > 0));

  if (lines.length < 2) {
    throw new Error("Transaksi pengganti minimal memiliki dua baris akun.");
  }

  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.round(totalDebit) !== Math.round(totalCredit)) {
    throw new Error("Total debit dan kredit transaksi pengganti harus seimbang.");
  }

  const supabase = await createClient();

  const { data: draftId, error: draftError } = await supabase.rpc(
    "create_journal_correction_draft",
    {
      p_original_journal_entry_id: originalJournalEntryId,
      p_reason: reason,
      p_correction_date: correctedJournalDate,
    }
  );

  if (draftError || !draftId) {
    throw new Error(draftError?.message || "Gagal membuat draft koreksi transaksi.");
  }

  const correctionId = String(draftId);

  const { error: replacementError } = await supabase.rpc(
    "prepare_journal_correction_replacement",
    {
      p_correction_id: correctionId,
      p_corrected_journal_date: correctedJournalDate,
      p_description: correctedDescription,
      p_lines: lines,
    }
  );

  if (replacementError) {
    throw new Error(
      replacementError.message || "Gagal menyiapkan transaksi pengganti."
    );
  }

  const { error: requestError } = await supabase.rpc(
    "request_journal_correction",
    {
      p_correction_id: correctionId,
    }
  );

  if (requestError) {
    throw new Error(requestError.message || "Gagal mengajukan koreksi ke Pengawas.");
  }

  revalidatePath("/unit/dashboard/catat-transaksi/koreksi-transaksi");
  redirect(`/unit/dashboard/catat-transaksi/koreksi-transaksi?submitted=${correctionId}`);
}

export async function postJournalCorrectionByRequesterAction(formData: FormData) {
  const context = await getLoginContext();
  const role = context?.role ?? "";

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    throw new Error("Konteks login unit tidak valid.");
  }

  assertUnitCorrectionRole(role);

  const correctionId = getRequiredString(
    formData,
    "correction_id",
    "ID koreksi transaksi tidak ditemukan."
  );

  const supabase = await createClient();

  const { error } = await supabase.rpc("post_journal_correction", {
    p_correction_id: correctionId,
  });

  if (error) {
    throw new Error(error.message || "Posting koreksi transaksi gagal.");
  }

  revalidatePath("/unit/dashboard/catat-transaksi/koreksi-transaksi");
  revalidatePath("/unit/dashboard/reports");
  revalidatePath("/unit/dashboard/reports/laba-rugi");
  revalidatePath("/unit/dashboard/reports/neraca");
  revalidatePath("/unit/dashboard/cek-alur-transaksi");

  redirect(`/unit/dashboard/catat-transaksi/koreksi-transaksi?posted=${correctionId}`);
}