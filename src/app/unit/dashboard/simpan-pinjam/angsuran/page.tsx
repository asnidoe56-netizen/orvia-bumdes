import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

import { RepaymentActionPanel } from "./_components/repayment-action-panel";

type RepaymentFlowRow = {
  tenant_id: string;
  unit_id: string;
  application_id: string;
  application_no: string;
  application_date: string | null;
  application_method: string | null;
  application_status: string | null;
  verification_status: string | null;
  requested_amount: number | string | null;
  tenor_months: number | null;
  member_name: string | null;
  group_name: string | null;
  disbursed_principal: number | string | null;
  paid_principal: number | string | null;
  outstanding_principal: number | string | null;
  total_service_income: number | string | null;
  total_cash_received: number | string | null;
  posted_repayment_count: number | null;
  last_repayment_date: string | null;
  repayment_flow_status: string | null;
  audit_result: string | null;
};

type ScheduleFlowRow = {
  application_id: string;
  schedule_id: string;
  installment_no: number | null;
  due_date: string | null;
  principal_amount: number | string | null;
  service_amount: number | string | null;
  total_amount: number | string | null;
  paid_principal_amount: number | string | null;
  paid_service_amount: number | string | null;
  paid_total_amount: number | string | null;
  remaining_principal_amount: number | string | null;
  remaining_service_amount: number | string | null;
  remaining_admin_amount: number | string | null;
  remaining_penalty_amount: number | string | null;
  remaining_total_amount: number | string | null;
  schedule_status: string | null;
  is_overdue: boolean | null;
  overdue_days: number | null;
  schedule_row_audit: string | null;
};

type CashBankAccountRow = {
  id: string;
  account_code: string | null;
  account_name: string | null;
  account_kind: string | null;
};

type LoanProductRow = {
  id: string;
  product_code: string | null;
  product_name: string | null;
  interest_method: string | null;
  service_rate: number | string | null;
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

const badgeClass = (status: string | null | undefined) => {
  if (
    status === "PASS" ||
    status === "PAID_OFF_PASS" ||
    status === "PARTIAL_PAID_PASS" ||
    status === "PASS_PAID"
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "READY_FOR_REPAYMENT" || status === "PASS_SCHEDULED") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (status?.startsWith("CHECK") || status === "FAIL") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
};

function groupSchedulesByApplication(rows: ScheduleFlowRow[]) {
  return rows.reduce<Record<string, ScheduleFlowRow[]>>((acc, row) => {
    if (!acc[row.application_id]) {
      acc[row.application_id] = [];
    }

    acc[row.application_id].push(row);
    return acc;
  }, {});
}

function getNextSchedule(rows: ScheduleFlowRow[]) {
  return (
    rows.find((row) => Number(row.remaining_total_amount ?? 0) > 0) ?? null
  );
}

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

  const [
    { data: repaymentRows, error: repaymentError },
    { data: scheduleRows, error: scheduleError },
    { data: cashBankAccounts },
    { data: products },
  ] = await Promise.all([
    supabase
      .from("v_savings_loan_repayment_flow")
      .select(
        [
          "tenant_id",
          "unit_id",
          "application_id",
          "application_no",
          "application_date",
          "application_method",
          "application_status",
          "verification_status",
          "requested_amount",
          "tenor_months",
          "member_name",
          "group_name",
          "disbursed_principal",
          "paid_principal",
          "outstanding_principal",
          "total_service_income",
          "total_cash_received",
          "posted_repayment_count",
          "last_repayment_date",
          "repayment_flow_status",
          "audit_result",
        ].join(","),
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .in("repayment_flow_status", [
        "READY_FOR_REPAYMENT",
        "PARTIAL_PAID_PASS",
        "PAID_OFF_PASS",
      ])
      .order("application_date", { ascending: false })
      .returns<RepaymentFlowRow[]>(),
    supabase
      .from("v_savings_loan_repayment_schedule_flow")
      .select(
        [
          "application_id",
          "schedule_id",
          "installment_no",
          "due_date",
          "principal_amount",
          "service_amount",
          "total_amount",
          "paid_principal_amount",
          "paid_service_amount",
          "paid_total_amount",
          "remaining_principal_amount",
          "remaining_service_amount",
          "remaining_admin_amount",
          "remaining_penalty_amount",
          "remaining_total_amount",
          "schedule_status",
          "is_overdue",
          "overdue_days",
          "schedule_row_audit",
        ].join(","),
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("due_date", { ascending: true })
      .returns<ScheduleFlowRow[]>(),
    supabase
      .from("cash_bank_accounts")
      .select("id, account_code, account_name, account_kind")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("account_code", { ascending: true })
      .returns<CashBankAccountRow[]>(),
    supabase
      .from("savings_loan_products")
      .select("id, product_code, product_name, interest_method, service_rate")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("product_code", { ascending: true })
      .returns<LoanProductRow[]>(),
  ]);

  const rows = repaymentRows ?? [];
  const schedulesByApplication = groupSchedulesByApplication(scheduleRows ?? []);
  const accountOptions = cashBankAccounts ?? [];
  const productOptions = products ?? [];

  const activeRows = rows.filter(
    (row) => Number(row.outstanding_principal ?? 0) > 0,
  );
  const paidOffRows = rows.filter(
    (row) => row.repayment_flow_status === "PAID_OFF_PASS",
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
              Angsuran Pinjaman
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Menerima pembayaran pokok, jasa, admin, dan denda pinjaman.
              Perhitungan jadwal dibaca dari engine database, sedangkan posting
              angsuran otomatis membentuk kas-bank receipt, jurnal, status
              pinjaman, dan audit timeline.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-lg font-bold text-amber-700">
                {activeRows.length}
              </p>
              <p className="text-[11px] font-medium text-amber-700">
                Berjalan
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-lg font-bold text-emerald-700">
                {paidOffRows.length}
              </p>
              <p className="text-[11px] font-medium text-emerald-700">
                Lunas
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-lg font-bold text-slate-700">{rows.length}</p>
              <p className="text-[11px] font-medium text-slate-600">
                Total
              </p>
            </div>
          </div>
        </div>
      </section>

      {repaymentError || scheduleError ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {repaymentError ? (
            <p>Gagal membaca flow angsuran: {repaymentError.message}</p>
          ) : null}
          {scheduleError ? (
            <p>Gagal membaca jadwal angsuran: {scheduleError.message}</p>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Pinjaman Berjalan
          </h2>
          <p className="text-sm text-slate-600">
            Pinjaman yang sudah dicairkan dan masih memiliki sisa pokok.
          </p>
        </div>

        {activeRows.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            Belum ada pinjaman berjalan yang perlu ditagih.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {activeRows.map((row) => {
              const schedules = schedulesByApplication[row.application_id] ?? [];
              const nextSchedule = getNextSchedule(schedules);
              const hasSchedule = schedules.length > 0;
              const outstandingPrincipal = Number(
                row.outstanding_principal ?? 0,
              );

              return (
                <article
                  key={row.application_id}
                  className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        {methodLabel(row.application_method)}
                      </p>
                      <h3 className="mt-1 truncate text-base font-bold text-slate-950">
                        {row.application_no}
                      </h3>
                      <p className="mt-1 text-sm text-slate-600">
                        {row.member_name ?? row.group_name ?? "-"}
                      </p>
                    </div>
                    <span
                      className={[
                        "w-fit rounded-full border px-3 py-1 text-xs font-semibold",
                        badgeClass(row.repayment_flow_status),
                      ].join(" ")}
                    >
                      {row.repayment_flow_status ?? "-"}
                    </span>
                  </div>

                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Pokok Cair</dt>
                      <dd className="font-semibold text-slate-950">
                        {formatCurrency(row.disbursed_principal)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Sisa Pokok</dt>
                      <dd className="font-semibold text-slate-950">
                        {formatCurrency(row.outstanding_principal)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Jasa Diterima</dt>
                      <dd className="font-semibold text-slate-950">
                        {formatCurrency(row.total_service_income)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <dt className="text-xs text-slate-500">Tenor</dt>
                      <dd className="font-semibold text-slate-950">
                        {row.tenor_months ?? "-"} bulan
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4">
                    <RepaymentActionPanel
                      applicationId={row.application_id}
                      applicationNo={row.application_no}
                      canRepay={outstandingPrincipal > 0}
                      hasSchedule={hasSchedule}
                      outstandingPrincipal={outstandingPrincipal}
                      nextSchedule={nextSchedule}
                      cashBankAccounts={accountOptions}
                      products={productOptions}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Jadwal Angsuran
          </h2>
          <p className="text-sm text-slate-600">
            Jadwal pokok dan jasa yang dibentuk oleh engine skema pinjaman.
          </p>
        </div>

        <div className="grid gap-3 lg:hidden">
          {(scheduleRows ?? []).map((schedule) => (
            <article
              key={schedule.schedule_id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Angsuran ke-{schedule.installment_no}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-slate-950">
                    {formatDate(schedule.due_date)}
                  </h3>
                </div>
                <span
                  className={[
                    "rounded-full border px-3 py-1 text-xs font-semibold",
                    badgeClass(schedule.schedule_row_audit),
                  ].join(" ")}
                >
                  {schedule.schedule_status ?? "-"}
                </span>
              </div>

              <dl className="mt-4 grid gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Tagihan</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(schedule.total_amount)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Dibayar</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(schedule.paid_total_amount)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Sisa</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(schedule.remaining_total_amount)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="min-w-[1080px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Aplikasi</th>
                <th className="px-4 py-3 text-left">Ke</th>
                <th className="px-4 py-3 text-left">Jatuh Tempo</th>
                <th className="px-4 py-3 text-right">Pokok</th>
                <th className="px-4 py-3 text-right">Jasa</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Dibayar</th>
                <th className="px-4 py-3 text-right">Sisa</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(scheduleRows ?? []).length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                    Belum ada jadwal angsuran.
                  </td>
                </tr>
              ) : (
                (scheduleRows ?? []).map((schedule) => {
                  const parentRow = rows.find(
                    (row) => row.application_id === schedule.application_id,
                  );

                  return (
                    <tr key={schedule.schedule_id}>
                      <td className="px-4 py-3 font-semibold text-slate-950">
                        {parentRow?.application_no ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {schedule.installment_no}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDate(schedule.due_date)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(schedule.principal_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(schedule.service_amount)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-950">
                        {formatCurrency(schedule.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(schedule.paid_total_amount)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatCurrency(schedule.remaining_total_amount)}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {schedule.schedule_status ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "rounded-full border px-3 py-1 text-xs font-semibold",
                            badgeClass(schedule.schedule_row_audit),
                          ].join(" ")}
                        >
                          {schedule.schedule_row_audit ?? "-"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Riwayat Pinjaman Lunas
          </h2>
          <p className="text-sm text-slate-600">
            Pinjaman yang sudah selesai dibayar penuh.
          </p>
        </div>

        <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm lg:block">
          <table className="min-w-[980px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Pengajuan</th>
                <th className="px-4 py-3 text-left">Pemohon</th>
                <th className="px-4 py-3 text-left">Metode</th>
                <th className="px-4 py-3 text-right">Pokok Cair</th>
                <th className="px-4 py-3 text-right">Pokok Dibayar</th>
                <th className="px-4 py-3 text-right">Jasa</th>
                <th className="px-4 py-3 text-right">Total Diterima</th>
                <th className="px-4 py-3 text-left">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paidOffRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                    Belum ada pinjaman yang lunas.
                  </td>
                </tr>
              ) : (
                paidOffRows.map((row) => (
                  <tr key={row.application_id}>
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {row.application_no}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {row.member_name ?? row.group_name ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {methodLabel(row.application_method)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(row.disbursed_principal)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(row.paid_principal)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-700">
                      {formatCurrency(row.total_service_income)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-950">
                      {formatCurrency(row.total_cash_received)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-semibold",
                          badgeClass(row.audit_result),
                        ].join(" ")}
                      >
                        {row.audit_result ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 lg:hidden">
          {paidOffRows.map((row) => (
            <article
              key={row.application_id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Lunas
              </p>
              <h3 className="mt-1 text-base font-bold text-slate-950">
                {row.application_no}
              </h3>
              <p className="text-sm text-slate-600">
                {row.member_name ?? row.group_name ?? "-"}
              </p>

              <dl className="mt-4 grid gap-3 text-sm">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Pokok Dibayar</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(row.paid_principal)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Jasa</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(row.total_service_income)}
                  </dd>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">Total Diterima</dt>
                  <dd className="font-semibold text-slate-950">
                    {formatCurrency(row.total_cash_received)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
