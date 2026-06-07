import { MemberCreateForm } from "./_components/member-create-form";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type SavingsLoanMember = {
  id: string;
  member_no: string;
  full_name: string;
  identity_number: string | null;
  phone: string | null;
  address: string | null;
  join_date: string | null;
  status: string | null;
  notes: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function StatusBadge({ status }: { status: string | null }) {
  return (
    <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      {status ?? "-"}
    </span>
  );
}

function MemberMobileCard({ member }: { member: SavingsLoanMember }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {member.member_no}
          </p>
          <h3 className="mt-1 break-words text-base font-bold text-slate-950">
            {member.full_name}
          </h3>
        </div>
        <StatusBadge status={member.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-500">Nomor Identitas</dt>
          <dd className="mt-1 break-words text-slate-800">
            {member.identity_number || "-"}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Nomor HP</dt>
          <dd className="mt-1 break-words text-slate-800">
            {member.phone || "-"}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Tanggal Bergabung</dt>
          <dd className="mt-1 text-slate-800">{formatDate(member.join_date)}</dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Alamat</dt>
          <dd className="mt-1 break-words text-slate-800">
            {member.address || "-"}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export default async function SavingsLoanMembersPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="mx-auto max-w-7xl rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        Konteks tenant/unit tidak ditemukan. Silakan login ulang.
      </div>
    );
  }

  const supabase = await createClient();

  const { data: members, error } = await supabase
    .from("v_savings_loan_members")
    .select(
      "id, member_no, full_name, identity_number, phone, address, join_date, status, notes",
    )
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", context.unit_id)
    .order("member_no", { ascending: true });

  const memberRows = (members ?? []) as SavingsLoanMember[];

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam / Front Office
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
          Data Anggota
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Kelola anggota/nasabah unit simpan pinjam. Data ini menjadi dasar
          pembentukan kelompok dan pengajuan pinjaman. Penyimpanan dilakukan
          melalui RPC database agar scope tenant dan unit tetap terkendali.
        </p>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0">
          <MemberCreateForm />
        </div>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950">
                Daftar Anggota
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Total anggota terbaca: {memberRows.length}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              View: v_savings_loan_members
            </span>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
              Gagal membaca data anggota: {error.message}
            </div>
          ) : null}

          {!error && memberRows.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Belum ada anggota yang tercatat.
            </div>
          ) : null}

          {!error && memberRows.length > 0 ? (
            <>
              <div className="mt-4 grid gap-3 xl:hidden">
                {memberRows.map((member) => (
                  <MemberMobileCard key={member.id} member={member} />
                ))}
              </div>

              <div className="mt-4 hidden min-w-0 overflow-x-auto xl:block">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-3">
                        No. Anggota
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Nama
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Identitas
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        HP
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Bergabung
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Status
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Alamat
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberRows.map((member) => (
                      <tr key={member.id} className="align-top">
                        <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                          {member.member_no}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {member.full_name}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {member.identity_number || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {member.phone || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {formatDate(member.join_date)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <StatusBadge status={member.status} />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {member.address || "-"}
                        </td>
                      </tr>
                    ))}
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

