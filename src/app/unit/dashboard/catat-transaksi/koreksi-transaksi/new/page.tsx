import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { CorrectionRequestForm } from "./correction-request-form";

type EligibleEntry = {
  journal_entry_id: string;
  tenant_id: string;
  unit_id: string | null;
  journal_no: string;
  journal_date: string;
  source_type: string;
  description: string | null;
  total_debit: number | string | null;
  total_credit: number | string | null;
};

type EntryLine = {
  journal_line_id: string;
  line_no: number | string;
  account_id: string;
  account_code: string;
  account_name: string;
  line_description: string | null;
  debit: number | string;
  credit: number | string;
};

type AccountOption = {
  account_id: string;
  account_code: string;
  account_name: string;
  account_tipe: string;
  account_type: string;
  normal_balance: string;
  unit_id: string | null;
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatRupiah(value: number | string | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(toNumber(value));
}

function dedupeAccountOptions(
  accounts: AccountOption[],
  unitId: string
): AccountOption[] {
  const map = new Map<string, AccountOption>();

  for (const account of accounts) {
    const existing = map.get(account.account_code);

    if (!existing) {
      map.set(account.account_code, account);
      continue;
    }

    if (account.unit_id === unitId && existing.unit_id !== unitId) {
      map.set(account.account_code, account);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.account_code.localeCompare(b.account_code)
  );
}

export default async function NewUnitKoreksiTransaksiPage({
  searchParams,
}: {
  searchParams: Promise<{ journal_entry_id?: string }>;
}) {
  const { journal_entry_id: journalEntryId } = await searchParams;
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id || !context.unit_id) {
    redirect("/login");
  }

  if (!journalEntryId) {
    redirect("/unit/dashboard/catat-transaksi/koreksi-transaksi");
  }

  const supabase = await createClient();

  const { data: entryData, error: entryError } = await supabase
    .from("v_journal_correction_eligible_entries")
    .select("*")
    .eq("journal_entry_id", journalEntryId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .maybeSingle();

  if (entryError) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        Gagal membaca transaksi lama: {entryError.message}
      </div>
    );
  }

  if (!entryData) {
    notFound();
  }

  const entry = entryData as unknown as EligibleEntry;

  const { data: lineData } = await supabase
    .from("v_journal_correction_eligible_entry_lines")
    .select("*")
    .eq("journal_entry_id", journalEntryId)
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("line_no", { ascending: true });

  const { data: accountData } = await supabase
    .from("v_journal_correction_account_options")
    .select("*")
    .eq("tenant_id", context.tenant_id)
    .or(`unit_id.eq.${context.unit_id},unit_id.is.null`)
    .order("account_code", { ascending: true });

  const originalLines = ((lineData ?? []) as unknown) as EntryLine[];
  const rawAccounts = ((accountData ?? []) as unknown) as AccountOption[];
  const accountOptions = dedupeAccountOptions(rawAccounts, context.unit_id);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/unit/dashboard/catat-transaksi/koreksi-transaksi"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali ke daftar transaksi
        </Link>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
          Admin Unit / Pengajuan Koreksi
        </p>

        <h1 className="mt-2 text-2xl font-bold text-slate-950">
          Ajukan Koreksi Transaksi
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Periksa transaksi lama, lalu susun transaksi pengganti. Setelah
          diajukan, Pengawas akan melakukan review sebelum Admin BUMDes memposting.
        </p>
      </section>

      <Card>
        <CardHeader
          title="Transaksi Lama"
          description="Transaksi posted yang akan diajukan koreksi."
          action={<Badge variant="neutral">{entry.source_type}</Badge>}
        />

        <div className="grid gap-4 px-5 pb-5 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Nomor Transaksi
            </p>
            <p className="mt-2 font-bold text-slate-950">{entry.journal_no}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Tanggal
            </p>
            <p className="mt-2 font-bold text-slate-950">{entry.journal_date}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Nilai
            </p>
            <p className="mt-2 font-bold text-slate-950">
              {formatRupiah(entry.total_debit)}
            </p>
          </div>
        </div>

        <div className="px-5 pb-5">
          <DataTable
            columns={["Akun", "Keterangan", "Debit", "Kredit"]}
            emptyText="Detail transaksi lama tidak ditemukan."
          >
            {originalLines.length > 0
              ? originalLines.map((line) => (
                  <tr key={line.journal_line_id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-bold text-slate-950">
                        {line.account_code} · {line.account_name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-600">
                      {line.line_description ?? "-"}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      {formatRupiah(line.debit)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      {formatRupiah(line.credit)}
                    </td>
                  </tr>
                ))
              : null}
          </DataTable>
        </div>
      </Card>

      <CorrectionRequestForm
        journalEntryId={journalEntryId}
        originalJournalDate={entry.journal_date}
        originalDescription={entry.description ?? entry.journal_no}
        originalLines={originalLines}
        accountOptions={accountOptions}
      />
    </div>
  );
}