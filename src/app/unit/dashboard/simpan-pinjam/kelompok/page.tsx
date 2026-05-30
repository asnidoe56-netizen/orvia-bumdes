import {
  AddGroupMemberForm,
  CreateGroupForm,
} from "./_components/group-forms";
import { PageBackButton } from "@/components/ui/page-back-button";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type MemberOption = {
  id: string;
  member_no: string;
  full_name: string;
};

type GroupRow = {
  id: string;
  group_no: string;
  group_name: string;
  leader_member_id: string | null;
  leader_member_no: string | null;
  leader_full_name: string | null;
  formation_date: string | null;
  status: string | null;
  address: string | null;
  notes: string | null;
  active_member_count: number | null;
};

type GroupMemberRow = {
  id: string;
  group_id: string;
  group_no: string;
  group_name: string;
  member_id: string;
  member_no: string;
  full_name: string;
  phone: string | null;
  role_in_group: string | null;
  joined_at: string | null;
  is_active: boolean | null;
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

function GroupMobileCard({
  group,
  members,
}: {
  group: GroupRow;
  members: GroupMemberRow[];
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {group.group_no}
          </p>
          <h3 className="mt-1 break-words text-base font-bold text-slate-950">
            {group.group_name}
          </h3>
        </div>
        <StatusBadge status={group.status} />
      </div>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="font-semibold text-slate-500">Ketua</dt>
          <dd className="mt-1 break-words text-slate-800">
            {group.leader_full_name || "-"}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Tanggal Pembentukan</dt>
          <dd className="mt-1 text-slate-800">
            {formatDate(group.formation_date)}
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Anggota Aktif</dt>
          <dd className="mt-1 text-slate-800">
            {group.active_member_count ?? 0} anggota
          </dd>
        </div>

        <div>
          <dt className="font-semibold text-slate-500">Alamat / Wilayah</dt>
          <dd className="mt-1 break-words text-slate-800">
            {group.address || "-"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Anggota Kelompok
        </p>

        {members.length > 0 ? (
          <div className="mt-3 space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <p className="font-bold text-slate-950">
                  {member.member_no} - {member.full_name}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {member.role_in_group ?? "-"} · {formatDate(member.joined_at)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            Belum ada anggota aktif.
          </p>
        )}
      </div>
    </article>
  );
}

export default async function SavingsLoanGroupsPage() {
  const context = await getLoginContext();

  if (!context?.tenant_id || !context.unit_id) {
    return (
      <div className="mx-auto max-w-7xl rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700">
        Konteks tenant/unit tidak ditemukan. Silakan login ulang.
      </div>
    );
  }

  const supabase = await createClient();

  const [membersResult, groupsResult, groupMembersResult] = await Promise.all([
    supabase
      .from("v_savings_loan_members")
      .select("id, member_no, full_name")
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("status", "active")
      .order("member_no", { ascending: true }),

    supabase
      .from("v_savings_loan_groups")
      .select(
        "id, group_no, group_name, leader_member_id, leader_member_no, leader_full_name, formation_date, status, address, notes, active_member_count",
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .order("group_no", { ascending: true }),

    supabase
      .from("v_savings_loan_group_members")
      .select(
        "id, group_id, group_no, group_name, member_id, member_no, full_name, phone, role_in_group, joined_at, is_active",
      )
      .eq("tenant_id", context.tenant_id)
      .eq("unit_id", context.unit_id)
      .eq("is_active", true)
      .order("group_no", { ascending: true })
      .order("role_in_group", { ascending: true })
      .order("member_no", { ascending: true }),
  ]);

  const members = (membersResult.data ?? []) as MemberOption[];
  const groups = (groupsResult.data ?? []) as GroupRow[];
  const groupMembers = (groupMembersResult.data ?? []) as GroupMemberRow[];

  const groupOptions = groups.map((group) => ({
    id: group.id,
    group_no: group.group_no,
    group_name: group.group_name,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageBackButton fallbackHref="/unit/dashboard/simpan-pinjam" />

      <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
          Unit Simpan Pinjam / Front Office
        </p>
        <h1 className="mt-2 text-xl font-bold text-slate-950 sm:text-2xl">
          Kelompok Anggota
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Kelola kelompok, ketua kelompok, dan relasi anggota kelompok. Data ini
          menjadi dasar pengajuan pinjaman kelompok dan kontrol tanggung renteng.
        </p>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <CreateGroupForm members={members} />
          <AddGroupMemberForm groups={groupOptions} members={members} />
        </div>

        <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-950">
                Daftar Kelompok
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Total kelompok terbaca: {groups.length}
              </p>
            </div>
            <span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              View: v_savings_loan_groups
            </span>
          </div>

          {membersResult.error || groupsResult.error || groupMembersResult.error ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-700">
              Gagal membaca data kelompok:{" "}
              {membersResult.error?.message ||
                groupsResult.error?.message ||
                groupMembersResult.error?.message}
            </div>
          ) : null}

          {!groupsResult.error && groups.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Belum ada kelompok yang tercatat.
            </div>
          ) : null}

          {!groupsResult.error && groups.length > 0 ? (
            <>
              <div className="mt-4 grid gap-3 md:hidden">
                {groups.map((group) => (
                  <GroupMobileCard
                    key={group.id}
                    group={group}
                    members={groupMembers.filter(
                      (member) => member.group_id === group.id,
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 hidden min-w-0 overflow-x-auto md:block">
                <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
                  <thead>
                    <tr className="text-xs uppercase tracking-wide text-slate-500">
                      <th className="border-b border-slate-200 px-3 py-3">
                        No. Kelompok
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Nama Kelompok
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Ketua
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Tanggal
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Anggota
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Status
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3">
                        Wilayah
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((group) => (
                      <tr key={group.id} className="align-top">
                        <td className="border-b border-slate-100 px-3 py-3 font-semibold text-slate-950">
                          {group.group_no}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {group.group_name}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {group.leader_full_name || "-"}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {formatDate(group.formation_date)}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {group.active_member_count ?? 0}
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3">
                          <StatusBadge status={group.status} />
                        </td>
                        <td className="border-b border-slate-100 px-3 py-3 text-slate-700">
                          {group.address || "-"}
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
