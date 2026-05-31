import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

import { DisbursementActionPanel } from "./_components/disbursement-action-panel";

type DisbursementFlowRow = {
  application_id: string;
  application_no: string;
  application_date: string | null;
  application_method: string | null;
  application_status: string | null;
  application_status_label: string | null;
  verification_status: string | null;
  verification_status_label: string | null;
  applicant_name: string | null;
  group_name: string | null;
  requested_amount: number | string | null;
  tenor_months: number | null;
  loan_purpose: string | null;
  disbursement_id: string | null;
  disbursement_no: string | null;
  disbursement_date: string | null;
  principal_amount: number | string | null;
  cash_bank_account_code: string | null;
  cash_bank_account_name: string | null;
  journal_status: string | null;
  cash_bank_transaction_status: string | null;
  can_disburse: boolean | null;
  disbursement_audit_status: string | null;
};

type CashBankAccountRow = {
  id: string;
  account_code: string | null;
  account_name: string | null;
  account_kind: string | null;
};

const formatCurrency = (value: number | string | null | undefined) => {
  const numeric = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const methodLabel = (value: string | null | undefined) => {
  if (value === "group") return "Kelompok";
  if (value === "individual") return "Perorangan";
  return "-";
};

const auditBadgeClass = (status: string | null | undefined) => {
  if (status === "PASS") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "READY_TO_DISBURSE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status === "CHECK_REQUIRED") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
};

export default async function Page() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context?.unit_id) {
    return (
      <div className="space-y-5">
        <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-rose-700">
            Konteks tenant/unit tidak ditemukan.
          </p>
          <p className="mt-2 text-sm text-rose-600">
            Silakan login ulang dengan akun unit Simpan Pinjam yang valid.
          </p>
        </section>
      </div>
    );
  }

  const supabase = await createClient();

  const [{ data: rows, error: flowError }, { data: cashBankAccounts }] =
    await Promise.all([
      supabase
        .from("v_savings_loan_disbursement_flow")
        .select(
          [
            "application_id",
            "application_no",
            "application_date",
            "application_method",
            "application_status",
            "application_status_label",
            "verification_status",
            "verification_status_label",
            "applicant_name",
            "group_name",
            "requested_amount",
            "tenor_months",
            "loan_purpose",
            "disbursement_id",
            "disbursement_no",
            "disbursement_date",
            "principal_amount",
            "cash_bank_account_code",
            "cash_bank_account_name",
            "journal_status",
            "cash_bank_transaction_status",
            "can_disburse",
            "disbursement_audit_status",
          ].join(","),
        )
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .order("application_date", { ascending: false })
        .returns<DisbursementFlowRow[]>(),
      supabase
        .from("cash_bank_accounts")
        .select("id, account_code, account_name, account_kind")
        .eq("tenant_id", context.tenant_id)
        .eq("unit_id", context.unit_id)
        .eq("is_active", true)
        .order("account_code", { ascending: true })
        .returns<CashBankAccountRow[]>(),
    ]);

  const flowRows = rows ?? [];
  const accountOptions = cashBankAccounts ?? [];

  const readyRows = flowRows.filter(
    (row) => row.disbursement_audit_status === "READY_TO_DISBURSE",
  );
  const postedRows = flowRows.filter(
    (row) => row.disbursement_audit_status === "PASS",
  );
  const otherRows = flowRows.filter(
    (row) =>
      row.disbursement_audit_status !== "READY_TO_DISBURSE" &&
      row.disbursement_audit_status !== "PASS",
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-3 pb-8 sm:px-4 lg:px-6">
      <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam
        </p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-950">
              Pencairan Dana Pinjaman
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Mencairkan pengajuan yang sudah diverifikasi dan disetujui.
              Sistem otomatis mencatat piutang pinjaman, transaksi kas-bank,
              jurnal, dan audit timeline melalui engine database.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-lg font-bold text-amber-700">
                {readyRows.length}
              </p>
              <p className="text-[11px] font-medium text-amber-700">
                Siap Cair
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-lg font-bold text-emerald-700">
                {postedRows.length}
              </p>
              <p className="text-[11px] font-medium text-emerald-700">
                Sudah Cair
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-lg font-bold text-slate-700">
                {otherRows.length}
              </p>
              <p className="text-[11px] font-medium text-slate-600">
                Lainnya
              </p>
            </div>
          </div>
        </div>
      </section>

      {flowError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          Gagal membaca data pencairan: {flowError.message}
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Pengajuan Siap Dicairkan
          </h2>
          <p className="text-sm text-slate-600">
            Hanya pengajuan dengan status disetujui dan terverifikasi yang dapat dicairkan.
          </p>
        </div>

        {readyRows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Belum ada pengajuan yang siap dicairkan.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {readyRows.map((row) => (
              <article
                key={row.application_id}
                className="min-w-0 rounded-3xl border border-amber-100 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      {methodLabel(row.application_method)}
                    </p>
                    <h3 className="mt-1 truncate text-base font-bold text-slate-950">
                      {row.application_no}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {row.applicant_name ?? row.group_name ?? "-"}
                    </p>
                  </div>
                  <span
                    className={[
                      "w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                      auditBadgeClass(row.disbursement_audit_status),
                    ].join(" ")}
                  >
                    Siap Cair
                  </span>
                </div>

                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Nilai</dt>
                    <dd className="font-semibold text-slate-950">
                      {formatCurrency(row.requested_amount)}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <dt className="text-xs text-slate-500">Tenor</dt>
                    <dd className="font-semibold text-slate-950">
                      {row.tenor_months ?? "-"} bulan
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3 sm:col-span-2">
                    <dt className="text-xs text-slate-500">Tujuan</dt>
                    <dd className="font-semibold text-slate-950">
                      {row.loan_purpose ?? "-"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4">
                  <DisbursementActionPanel
                    applicationId={row.application_id}
                    applicationNo={row.application_no}
                    requestedAmount={Number(row.requested_amount ?? 0)}
                    canDisburse={Boolean(row.can_disburse)}
                    cashBankAccounts={accountOptions}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Riwayat Pencairan
          </h2>
          <p className="text-sm text-slate-600">
            Daftar pencairan yang sudah diposting oleh sistem.
          </p>
        </div>

        <div className="grid gap-3 lg:hidden">
          {postedRows.map((row) => (
            <article
              key={row.disbursement_id ?? row.application_id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    {row.disbursement_no}
                  </p>
                  <h3 className="mt-1 truncate text-base font-bold text-slate-950">
                    {row.application_no}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {row.applicant_name ?? row.group_name ?? "-"}
                  </p>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  PASS
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Nilai Cair</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(row.principal_amount)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Kas/Bank</dt>
                  <dd className="font-semibold text-slate-950">
                    {row.cash_bank_account_code ?? "-"} -{" "}
                    {row.cash_bank_account_name ?? "-"}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Tanggal</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatDate(row.disbursement_date)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">No. Pencairan</th>
                <th className="px-4 py-3 text-left">Pengajuan</th>
                <th className="px-4 py-3 text-left">Pemohon</th>
                <th className="px-4 py-3 text-left">Metode</th>
                <th className="px-4 py-3 text-right">Nilai</th>
                <th className="px-4 py-3 text-left">Kas/Bank</th>
                <th className="px-4 py-3 text-left">Jurnal</th>
                <th className="px-4 py-3 text-left">Kas-Bank</th>
                <th className="px-4 py-3 text-left">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {postedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                    Belum ada pencairan yang diposting.
                  </td>
                </tr>
              ) : (
                postedRows.map((row) => (
                  <tr key={row.disbursement_id ?? row.application_id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {row.disbursement_no}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.application_no}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.applicant_name ?? row.group_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {methodLabel(row.application_method)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">
                      {formatCurrency(row.principal_amount)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.cash_bank_account_code ?? "-"} -{" "}
                      {row.cash_bank_account_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.journal_status ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.cash_bank_transaction_status ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          auditBadgeClass(row.disbursement_audit_status),
                        ].join(" ")}
                      >
                        {row.disbursement_audit_status ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

