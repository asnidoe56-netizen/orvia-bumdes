import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";
import { ApplicantFirstApplicationForm } from "./_components/application-forms";
import { PublicApplicationLinkCard } from "./_components/public-application-link-card";

type GroupOption = {
  id: string;
  group_no: string;
  group_name: string;
};

type PublicApplicationLinkRow = {
  public_slug: string;
  public_token: string;
  title: string | null;
  is_active: boolean;
};

type IntakeApplicationRow = {
  id: string;
  application_no: string;
  application_date: string | null;
  application_method: string | null;
  status: string | null;
  input_mode: string | null;
  verification_status: string | null;
  applicant_full_name: string | null;
  applicant_identity_number: string | null;
  applicant_phone: string | null;
  member_no: string | null;
  member_full_name: string | null;
  group_no: string | null;
  group_name: string | null;
  requested_amount: number | string | null;
  tenor_months: number | null;
  loan_purpose: string | null;
  income_source: string | null;
  estimated_repayment_capacity: number | string | null;
  business_or_job_type: string | null;
  supporting_document_url: string | null;
  supporting_document_name: string | null;
  active_group_member_count: number | null;
  application_group_member_count: number | null;
  group_requested_amount_total: number | string | null;
  declaration_accepted: boolean | null;
  assisted_statement_required: boolean | null;
  assisted_statement_name: string | null;
  has_assisted_statement_text: boolean | null;
  intake_audit_status: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatRupiah(value: number | string | null) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function methodLabel(value: string | null) {
  if (value === "group") return "Kelompok";
  if (value === "individual") return "Perorangan";
  return "-";
}

function inputModeLabel(value: string | null) {
  if (value === "self_service") return "Diisi Pemohon";
  if (value === "assisted_by_officer") return "Dibantu Petugas";
  return "-";
}

function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
      {status ?? "-"}
    </span>
  );
}

function VerificationBadge({ status }: { status: string | null }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
      {status ?? "-"}
    </span>
  );
}

function AuditBadge({ status }: { status: string | null }) {
  const isPass = status === "PASS";

  return (
    <span
      className={[
        "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
        isPass
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700",
      ].join(" ")}
    >
      {status ?? "-"}
    </span>
  );
}

function IntakeMobileCard({ application }: { application: IntakeApplicationRow }) {
  const borrower =
    application.application_method === "group"
      ? application.group_name || "-"
      : application.applicant_full_name ||
        application.member_full_name ||
        "-";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-xs font-semibold uppercase tracking-wide text-slate-500">
            {application.application_no}
          </p>
          <h3 className="mt-1 break-words text-base font-bold text-slate-950">
            {borrower}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {methodLabel(application.application_method)} ·{" "}
            {inputModeLabel(application.input_mode)}
          </p>
        </div>

        <AuditBadge status={application.intake_audit_status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-500">Tanggal</dt>
          <dd className="mt-1 text-slate-800">
            {formatDate(application.application_date)}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Nilai Dimohon</dt>
          <dd className="mt-1 font-bold text-slate-950">
            {formatRupiah(application.requested_amount)}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Tenor</dt>
          <dd className="mt-1 text-slate-800">
            {application.tenor_months ?? 0} bulan
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Status Verifikasi</dt>
          <dd className="mt-1">
            <VerificationBadge status={application.verification_status} />
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Tujuan</dt>
          <dd className="mt-1 break-words text-slate-800">
            {application.loan_purpose || "-"}
          </dd>
        </div>
      </dl>

      {application.application_method === "group" ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Ringkasan Kelompok
          </p>
          <div className="mt-2 grid gap-2">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Anggota aktif</span>
              <span className="font-bold text-slate-950">
                {application.active_group_member_count ?? 0}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Anggota pengajuan</span>
              <span className="font-bold text-slate-950">
                {application.application_group_member_count ?? 0}
              </span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Total porsi</span>
              <span className="font-bold text-slate-950">
                {formatRupiah(application.group_requested_amount_total)}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={application.status} />

        {application.assisted_statement_required ? (
          <span className="inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            Surat Pernyataan
          </span>
        ) : (
          <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Deklarasi Pemohon
          </span>
        )}
      </div>

      {application.supporting_document_url ? (
        <a
          href={application.supporting_document_url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-2xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          Lihat Dokumen PDF
        </a>
      ) : null}
    </article>
  );
}

export default async function SavingsLoanApplicationsPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="mx-auto max-w-7xl rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        Konteks tenant/unit tidak ditemukan. Silakan login ulang.
      </div>
    );
  }

  const supabase = await createClient();

  const [groupsResult, applicationsResult, publicLinkResult] = await Promise.all([
    supabase
      .from("v_savings_loan_groups")
      .select("id, group_no, group_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("status", "active")
      .order("group_no", { ascending: true }),

    supabase
      .from("v_savings_loan_applicant_intake_applications")
      .select(
        "id, application_no, application_date, application_method, status, input_mode, verification_status, applicant_full_name, applicant_identity_number, applicant_phone, member_no, member_full_name, group_no, group_name, requested_amount, tenor_months, loan_purpose, income_source, estimated_repayment_capacity, business_or_job_type, supporting_document_url, supporting_document_name, active_group_member_count, application_group_member_count, group_requested_amount_total, declaration_accepted, assisted_statement_required, assisted_statement_name, has_assisted_statement_text, intake_audit_status",
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("created_at", { ascending: false }),

    supabase
      .from("savings_loan_public_application_links")
      .select("public_slug, public_token, title, is_active")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const groups = (groupsResult.data ?? []) as GroupOption[];
  const applications = (applicationsResult.data ?? []) as IntakeApplicationRow[];
  const publicLink = publicLinkResult.data as PublicApplicationLinkRow | null;
  const publicUrlPath = publicLink
    ? `/ajukan-pinjaman/${publicLink.public_slug}/${publicLink.public_token}`
    : null;
  const readError =
    groupsResult.error || applicationsResult.error || publicLinkResult.error;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam / Applicant Intake
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
          Pengajuan Pinjaman
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Pengajuan menjadi pintu masuk utama. Data anggota dan kelompok dibuat
          atau dicocokkan otomatis oleh engine. Jika input dibantu petugas,
          sistem mencatat alasan dan metadata surat pernyataan.
        </p>
      </section>

      <PublicApplicationLinkCard
        publicUrlPath={publicUrlPath}
        title={publicLink?.title ?? null}
        isActive={Boolean(publicLink?.is_active)}
      />

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <ApplicantFirstApplicationForm groups={groups} />
        </div>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950">
                Daftar Pengajuan
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Total pengajuan terbaca: {applications.length}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              View: v_savings_loan_applicant_intake_applications
            </span>
          </div>

          {readError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
              Gagal membaca data pengajuan: {readError.message}
            </div>
          ) : null}

          {!readError && applications.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Belum ada pengajuan pinjaman yang tercatat.
            </div>
          ) : null}

          {!readError && applications.length > 0 ? (
            <>
              <div className="mt-4 grid gap-3 md:hidden">
                {applications.map((application) => (
                  <IntakeMobileCard
                    key={application.id}
                    application={application}
                  />
                ))}
              </div>

              <div className="mt-4 hidden min-w-0 overflow-x-auto md:block">
                <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-3">
                        No. Pengajuan
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Metode
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Mode Input
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Pemohon/Kelompok
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Tanggal
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Nilai
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Verifikasi
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Intake Audit
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Bukti
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Dokumen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((application) => {
                      const borrower =
                        application.application_method === "group"
                          ? application.group_name || "-"
                          : application.applicant_full_name ||
                            application.member_full_name ||
                            "-";

                      return (
                        <tr key={application.id} className="align-top">
                          <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                            {application.application_no}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                            {methodLabel(application.application_method)}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                            {inputModeLabel(application.input_mode)}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                            <div className="max-w-[240px]">
                              <p className="font-semibold text-slate-950">
                                {borrower}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {application.application_method === "group"
                                  ? `${application.application_group_member_count ?? 0} anggota · total porsi ${formatRupiah(application.group_requested_amount_total)}`
                                  : application.member_no || "Anggota otomatis"}
                              </p>
                            </div>
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                            {formatDate(application.application_date)}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                            {formatRupiah(application.requested_amount)}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <VerificationBadge
                              status={application.verification_status}
                            />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            <AuditBadge
                              status={application.intake_audit_status}
                            />
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                            {application.assisted_statement_required
                              ? application.assisted_statement_name ||
                                "Surat pernyataan"
                              : application.declaration_accepted
                                ? "Deklarasi pemohon"
                                : "-"}
                          </td>
                          <td className="border-b border-slate-100 px-3 py-3">
                            {application.supporting_document_url ? (
                              <a
                                href={application.supporting_document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-emerald-700 hover:text-emerald-800"
                              >
                                PDF
                              </a>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </section>
    </div>
  );
}
