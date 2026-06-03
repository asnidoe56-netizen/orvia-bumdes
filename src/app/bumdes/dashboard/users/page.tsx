import {
  KeyRound,
  LockKeyhole,

  ShieldCheck,
  Store,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AddUserDialog } from "./add-user-dialog";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";

type UserRoleRow = {
  id: string;
  user_id: string;
  role: string;
  tenant_id: string | null;
  unit_id: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  default_tenant_id: string | null;
};

type UnitAccessCredentialRow = {
  id: string;
  user_id: string;
  tenant_id: string;
  unit_id: string;
  login_code: string;
  email_virtual: string;
  role: string;
  must_change_password: boolean;
  access_status: string;
  generated_at: string;
};

type BusinessUnitRow = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
};

type TenantUserRow = {
  roleId: string;
  userId: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  unitId: string | null;
  unitCode: string | null;
  unitName: string | null;
  loginCode: string | null;
  emailVirtual: string | null;
  accessStatus: string | null;
  mustChangePassword: boolean | null;
  createdAt: string;
};

function formatRole(role: string) {
  const roleMap: Record<string, string> = {
    direktur_bumdes: "Direktur BUMDes",
    admin_bumdes: "Admin BUMDes",
    manager_unit: "Manager Unit",
    operator_unit: "Operator Unit",
    viewer_unit: "Viewer Unit",
    super_admin_platform: "Super Admin Platform",
    pengawas: "Pengawas",
    pendamping_kecamatan: "Pendamping Kecamatan",
    dinas_pmd: "Dinas PMD",
    inspektorat: "Inspektorat",
    bupati: "Bupati",
  };

  return roleMap[role] ?? role.replace(/_/g, " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getAccessBadgeVariant(status?: string | null) {
  const normalized = (status ?? "").toLowerCase();

  if (normalized === "active" || normalized === "aktif") {
    return "success" as const;
  }

  if (
    normalized.includes("inactive") ||
    normalized.includes("blocked") ||
    normalized.includes("suspend") ||
    normalized.includes("nonaktif")
  ) {
    return "danger" as const;
  }

  return "warning" as const;
}

function getInitials(name?: string | null) {
  if (!name) return "U";

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function buildCredentialKey(userId: string, unitId: string | null, role: string) {
  return `${userId}:${unitId ?? "tenant"}:${role}`;
}

export default async function BumdesUsersPage() {
  const context = await getLoginContext();
  const tenantId = context?.tenant_id ?? null;
  const supabase = await createClient();

  const userRolesResult = tenantId
    ? await supabase
        .from("user_roles")
        .select("id, user_id, role, tenant_id, unit_id, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
    : { data: null, error: null };

  const userRoles = (userRolesResult.data ?? []) as UserRoleRow[];

  const userIds = Array.from(new Set(userRoles.map((row) => row.user_id)));
  const unitIds = Array.from(
    new Set(
      userRoles
        .map((row) => row.unit_id)
        .filter((unitId): unitId is string => Boolean(unitId)),
    ),
  );

  const [profilesResult, credentialsResult, unitsResult] = tenantId
    ? await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, phone, default_tenant_id")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),

        supabase
          .from("unit_access_credentials")
          .select(
            "id, user_id, tenant_id, unit_id, login_code, email_virtual, role, must_change_password, access_status, generated_at",
          )
          .eq("tenant_id", tenantId),

        unitIds.length
          ? supabase
              .from("business_units")
              .select("id, kode_unit, nama_unit, jenis_unit, status")
              .in("id", unitIds)
          : Promise.resolve({ data: [], error: null }),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
        { data: [], error: null },
      ];

  const profiles = (profilesResult.data ?? []) as ProfileRow[];
  const credentials = (credentialsResult.data ?? []) as UnitAccessCredentialRow[];
  const units = (unitsResult.data ?? []) as BusinessUnitRow[];

  const profileByUserId = new Map(profiles.map((profile) => [profile.id, profile]));
  const unitById = new Map(units.map((unit) => [unit.id, unit]));

  const credentialByExactKey = new Map(
    credentials.map((credential) => [
      buildCredentialKey(credential.user_id, credential.unit_id, credential.role),
      credential,
    ]),
  );

  const tenantUsers: TenantUserRow[] = userRoles.map((roleRow) => {
    const profile = profileByUserId.get(roleRow.user_id) ?? null;
    const unit = roleRow.unit_id ? unitById.get(roleRow.unit_id) ?? null : null;
    const credential =
      credentialByExactKey.get(
        buildCredentialKey(roleRow.user_id, roleRow.unit_id, roleRow.role),
      ) ?? null;

    return {
      roleId: roleRow.id,
      userId: roleRow.user_id,
      fullName: profile?.full_name ?? null,
      phone: profile?.phone ?? null,
      role: roleRow.role,
      unitId: roleRow.unit_id,
      unitCode: unit?.kode_unit ?? null,
      unitName: unit?.nama_unit ?? null,
      loginCode: credential?.login_code ?? null,
      emailVirtual: credential?.email_virtual ?? null,
      accessStatus: credential?.access_status ?? null,
      mustChangePassword: credential?.must_change_password ?? null,
      createdAt: roleRow.created_at,
    };
  });

  const unitUsers = tenantUsers.filter((user) => Boolean(user.unitId));
  const tenantLevelUsers = tenantUsers.filter((user) => !user.unitId);
  const activeCredentialCount = credentials.filter(
    (credential) => credential.access_status.toLowerCase() === "active",
  ).length;
  const mustChangePasswordCount = credentials.filter(
    (credential) => credential.must_change_password,
  ).length;

  const errors = [
    userRolesResult.error?.message,
    profilesResult.error?.message,
    credentialsResult.error?.message,
    unitsResult.error?.message,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        breadcrumb="Direktur BUMDes / Pengguna"
        title="Pengguna BUMDes"
        description="Kelola dan pantau pengguna dalam tenant BUMDes, termasuk direktur, admin BUMDes, manager unit, operator unit, dan viewer unit."
        action={tenantId ? <AddUserDialog units={units} /> : null}
      />

      {!tenantId ? (
        <Card>
          <CardHeader
            title="Tenant BUMDes Tidak Ditemukan"
            description="Akun ini belum memiliki tenant aktif sehingga daftar pengguna belum dapat ditampilkan."
            action={<Badge variant="danger">Tidak Ada Tenant</Badge>}
          />
          <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
            Pastikan akun Direktur BUMDes sudah terhubung ke tenant melalui
            data role dan profil pengguna.
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Total Pengguna"
              value={tenantUsers.length.toLocaleString("id-ID")}
              description="Seluruh user yang terhubung ke tenant BUMDes."
              icon={<Users className="h-5 w-5" />}
            />
            <StatCard
              title="Pengguna Level Tenant"
              value={tenantLevelUsers.length.toLocaleString("id-ID")}
              description="Direktur dan admin BUMDes."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <StatCard
              title="Pengguna Unit"
              value={unitUsers.length.toLocaleString("id-ID")}
              description="Manager, operator, dan viewer unit."
              icon={<Store className="h-5 w-5" />}
            />
            <StatCard
              title="Akses Unit Aktif"
              value={activeCredentialCount.toLocaleString("id-ID")}
              description={`${mustChangePasswordCount.toLocaleString("id-ID")} akun wajib ganti password.`}
              icon={<KeyRound className="h-5 w-5" />}
            />
          </div>

          <Card>
            <CardHeader
              title="Daftar Pengguna Tenant"
              description="Data dibaca dari profiles, user_roles, unit_access_credentials, dan business_units sesuai tenant aktif."
              action={
                errors.length ? (
                  <Badge variant="danger">Gagal Memuat</Badge>
                ) : (
                  <Badge variant="success">Database Aktif</Badge>
                )
              }
            />

            {errors.length ? (
              <div className="px-5 pb-5 text-sm leading-7 text-red-600">
                {errors.map((message) => (
                  <p key={message}>{message}</p>
                ))}
              </div>
            ) : tenantUsers.length === 0 ? (
              <div className="px-5 pb-5 text-sm leading-7 text-slate-600">
                Belum ada pengguna tenant. Setelah pengguna dibuat melalui alur
                unit access credential atau role tenant, daftar pengguna akan
                muncul di sini.
              </div>
            ) : (
              <div className="overflow-x-auto px-5 pb-5">
                <table className="min-w-[1040px] w-full border-separate border-spacing-y-3 text-left text-sm">
                  <thead>
                    <tr className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-4">Nama</th>
                      <th className="px-4">Email/Login</th>
                      <th className="px-4">Role</th>
                      <th className="px-4">Unit</th>
                      <th className="px-4">Status Akses</th>
                      <th className="px-4">Password</th>
                      <th className="px-4">Dibuat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantUsers.map((user) => (
                      <tr
                        key={user.roleId}
                        className="bg-white shadow-sm ring-1 ring-slate-100"
                      >
                        <td className="rounded-l-2xl px-4 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-sm font-black text-emerald-700">
                              {getInitials(user.fullName)}
                            </div>
                            <div>
                              <p className="font-black text-slate-950">
                                {user.fullName ?? "Nama belum diisi"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {user.phone ? `HP: ${user.phone}` : `User ID: ${user.userId.slice(0, 8)}`}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-slate-800">
                            {user.emailVirtual ?? "Akun tenant"}
                          </p>
                          <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">
                            {user.loginCode ?? `User ID: ${user.userId}`}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <Badge variant="warning">{formatRole(user.role)}</Badge>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="font-bold text-slate-900">
                            {user.unitName ?? "Tenant BUMDes"}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {user.unitCode ?? "Level BUMDes"}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <Badge variant={getAccessBadgeVariant(user.accessStatus)}>
                            {user.accessStatus ?? "Tenant Role"}
                          </Badge>
                        </td>

                        <td className="px-4 py-4 align-top">
                          {user.mustChangePassword === null ? (
                            <span className="text-xs text-slate-500">
                              Tidak berlaku
                            </span>
                          ) : user.mustChangePassword ? (
                            <div className="flex items-center gap-2 text-orange-700">
                              <LockKeyhole className="h-4 w-4" />
                              <span className="text-xs font-bold">
                                Wajib diganti
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-emerald-700">
                              <UserRoundCheck className="h-4 w-4" />
                              <span className="text-xs font-bold">
                                Sudah aman
                              </span>
                            </div>
                          )}
                        </td>

                        <td className="rounded-r-2xl px-4 py-4 align-top text-slate-600">
                          {formatDate(user.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}


