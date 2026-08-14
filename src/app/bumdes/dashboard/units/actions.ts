"use server";

import { revalidatePath } from "next/cache";
import type { PostgrestError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginContext } from "@/lib/auth/get-login-context";

export type CreateUnitState = {
  status: "idle" | "success" | "error";
  message: string;
};

type UnitRole = "manager_unit" | "operator_unit";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function fail(message: string): CreateUnitState {
  return { status: "error", message };
}

function buildLoginCode(role: UnitRole) {
  const prefix = role === "manager_unit" ? "MGR" : "OPR";
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${randomPart}`;
}

/** RPC yang dipanggil tidak ada di database ini. */
function isMissingFunction(error: PostgrestError | null) {
  if (!error) return false;

  return error.code === "PGRST202" || /schema cache/i.test(error.message ?? "");
}

/**
 * Pesan Postgres/PostgREST mentah tidak berguna untuk Direktur BUMDes. Kode yang
 * sudah pasti artinya diterjemahkan; sisanya tetap ditampilkan apa adanya supaya
 * penyebab nyata tidak hilang di layar error kosong seperti sebelumnya.
 */
function describeDatabaseError(
  error: PostgrestError | null,
  fallback: string
): string {
  if (!error) return fallback;

  const message = error.message ?? "";

  if (error.code === "23505") {
    return "Kode unit sudah dipakai. Ganti kode unit lalu simpan lagi.";
  }

  if (error.code === "42501") {
    return "Akun Anda tidak memiliki izin untuk membuat unit usaha di database.";
  }

  return message || fallback;
}

async function createAuthUnitUser(params: {
  role: UnitRole;
  fullName: string;
  email: string;
  password: string;
  tenantId: string;
}) {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: params.email,
    password: params.password,
    email_confirm: true,
    user_metadata: {
      full_name: params.fullName,
      tenant_id: params.tenantId,
      role: params.role,
      source: "business_unit_creation",
    },
  });

  if (error || !data.user) {
    const message = error?.message ?? "";

    if (message.toLowerCase().includes("already been registered")) {
      throw new Error(
        `Email ${params.email} sudah terdaftar sebagai akun login. Gunakan email lain atau reset password akun tersebut.`
      );
    }

    throw new Error(error?.message || `Akun ${params.role} gagal dibuat.`);
  }

  return data.user.id;
}

/**
 * Profil, role, dan kredensial akses unit. Urutannya sama dengan penambahan
 * pengguna unit di `../users/actions.ts` supaya satu unit hanya punya satu pola
 * pembuatan akses.
 */
async function grantUnitAccess(params: {
  userId: string;
  tenantId: string;
  unitId: string;
  role: UnitRole;
  fullName: string;
  email: string;
  generatedBy: string;
}) {
  const admin = createAdminClient();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: params.userId,
      full_name: params.fullName,
      default_tenant_id: params.tenantId,
    },
    {
      onConflict: "id",
    }
  );

  if (profileError) {
    throw new Error(
      describeDatabaseError(profileError, "Profil pengguna gagal disimpan.")
    );
  }

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: params.userId,
    role: params.role,
    tenant_id: params.tenantId,
    unit_id: params.unitId,
  });

  if (roleError) {
    throw new Error(
      describeDatabaseError(roleError, `Role ${params.role} gagal disimpan.`)
    );
  }

  // login_code punya keunikan sendiri di database, jadi tabrakan acak diulang.
  const maxAttempts = 5;
  let lastCredentialError: PostgrestError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { error: credentialError } = await admin
      .from("unit_access_credentials")
      .insert({
        user_id: params.userId,
        tenant_id: params.tenantId,
        unit_id: params.unitId,
        login_code: buildLoginCode(params.role),
        email_virtual: params.email,
        role: params.role,
        must_change_password: false,
        access_status: "active",
        generated_by: params.generatedBy,
      });

    if (!credentialError) return;

    lastCredentialError = credentialError;

    if (credentialError.code !== "23505") break;
  }

  throw new Error(
    describeDatabaseError(
      lastCredentialError,
      `Kredensial akses ${params.role} gagal dibuat.`
    )
  );
}

type UnitCreationOutcome = {
  /** null kalau unit dibuat lewat RPC atomik yang tidak mengembalikan id. */
  unitId: string | null;
  /** RPC atomik sekalian menulis role dan kredensial; jalur lama tidak. */
  accessAlreadyGranted: boolean;
};

/**
 * Skema database proyek ini tidak ada di repo (lihat AUDIT_KESIAPAN_123_DESA.md
 * T-04), jadi tidak bisa dipastikan dari kode fungsi mana yang benar-benar ada di
 * Supabase produksi. Dua-duanya dicoba: yang atomik dulu karena ia membuat unit,
 * role, dan kredensial dalam satu transaksi; kalau fungsinya memang tidak ada,
 * baru turun ke RPC lama dan akses ditulis dari sisi aplikasi.
 *
 * Yang dijadikan pemicu turun jalur hanya "fungsi tidak ditemukan". Error lain —
 * kode unit bentrok, izin ditolak, aturan bisnis — tetap dilempar apa adanya,
 * supaya kegagalan nyata tidak tersamarkan oleh percobaan kedua.
 */
async function createUnitInDatabase(params: {
  tenantId: string;
  templateId: string;
  kodeUnit: string;
  namaUnit: string;
  jenisUnit: string;
  managerUserId: string;
  managerEmail: string;
  managerName: string;
  operatorUserId: string | null;
  operatorEmail: string | null;
  operatorName: string | null;
}): Promise<UnitCreationOutcome> {
  const supabase = await createClient();

  const { error: atomicError } = await supabase.rpc(
    "create_business_unit_with_existing_access",
    {
      p_tenant_id: params.tenantId,
      p_template_id: params.templateId,
      p_kode_unit: params.kodeUnit,
      p_nama_unit: params.namaUnit,
      p_jenis_unit: params.jenisUnit,
      p_manager_user_id: params.managerUserId,
      p_manager_email: params.managerEmail,
      p_manager_full_name: params.managerName,
      p_manager_login_code: null,
      p_operator_user_id: params.operatorUserId,
      p_operator_email: params.operatorEmail,
      p_operator_full_name: params.operatorName,
      p_operator_login_code: null,
    }
  );

  if (!atomicError) {
    return { unitId: null, accessAlreadyGranted: true };
  }

  if (!isMissingFunction(atomicError)) {
    throw new Error(
      describeDatabaseError(
        atomicError,
        "Unit usaha dan kredensial gagal dibuat."
      )
    );
  }

  const { data: unitId, error: unitError } = await supabase.rpc(
    "create_business_unit",
    {
      p_tenant_id: params.tenantId,
      p_template_id: params.templateId,
      p_kode_unit: params.kodeUnit,
      p_nama_unit: params.namaUnit,
      p_jenis_unit: params.jenisUnit,
    }
  );

  if (unitError || !unitId) {
    if (isMissingFunction(unitError)) {
      throw new Error(
        "Database BUMDes ini tidak memiliki fungsi pembuat unit usaha " +
          "(create_business_unit_with_existing_access maupun create_business_unit). " +
          "Hubungi tim teknis untuk menambahkannya di Supabase."
      );
    }

    throw new Error(describeDatabaseError(unitError, "Unit usaha gagal dibuat."));
  }

  return { unitId: String(unitId), accessAlreadyGranted: false };
}

async function deleteAuthUserIfExists(userId: string | null) {
  if (!userId) return;

  const admin = createAdminClient();

  await admin.auth.admin.deleteUser(userId);
}

/**
 * Kompensasi kalau salah satu langkah gagal: akun login yang terlanjur dibuat
 * dihapus supaya emailnya bisa dipakai lagi saat mencoba ulang, lalu unit yang
 * masih kosong ikut dihapus. Kegagalan pembersihan dilaporkan ke pengguna, tidak
 * ditelan diam-diam.
 */
async function rollbackPartialUnit(params: {
  userIds: string[];
  unitId: string | null;
  tenantId: string;
}) {
  const notes: string[] = [];

  for (const userId of params.userIds) {
    try {
      await deleteAuthUserIfExists(userId);
    } catch {
      notes.push("akun login yang terlanjur dibuat gagal dihapus otomatis");
    }
  }

  if (params.unitId) {
    const admin = createAdminClient();

    const { error } = await admin
      .from("business_units")
      .delete()
      .eq("id", params.unitId)
      .eq("tenant_id", params.tenantId);

    if (error) {
      notes.push("unit yang terlanjur dibuat gagal dihapus otomatis");
    }
  }

  if (!notes.length) return "";

  return ` Catatan: ${notes.join(" dan ")}, mohon periksa manual sebelum mencoba lagi.`;
}

export async function createBusinessUnitWithAccess(
  _prevState: CreateUnitState,
  formData: FormData
): Promise<CreateUnitState> {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    return fail("Sesi login tidak valid. Silakan login ulang.");
  }

  const tenantId = context.tenant_id;
  const actorId = context.user_id;

  const templateId = clean(formData.get("template_id"));
  const kodeUnit = clean(formData.get("kode_unit")).toUpperCase();
  const namaUnit = clean(formData.get("nama_unit"));
  const jenisUnit = clean(formData.get("jenis_unit"));

  const managerName = clean(formData.get("manager_name"));
  const managerEmail = clean(formData.get("manager_email")).toLowerCase();
  const managerPassword = String(formData.get("manager_password") ?? "");
  const managerConfirmPassword = String(
    formData.get("manager_confirm_password") ?? ""
  );

  const createOperator = String(formData.get("create_operator") ?? "") === "on";
  const operatorName = clean(formData.get("operator_name"));
  const operatorEmail = clean(formData.get("operator_email")).toLowerCase();
  const operatorPassword = String(formData.get("operator_password") ?? "");
  const operatorConfirmPassword = String(
    formData.get("operator_confirm_password") ?? ""
  );

  if (!templateId) return fail("Template unit wajib dipilih.");
  if (!kodeUnit) return fail("Kode unit wajib diisi.");
  if (!namaUnit) return fail("Nama unit wajib diisi.");
  if (!jenisUnit) return fail("Jenis unit wajib diisi.");
  if (!managerName) return fail("Nama Manager Unit wajib diisi.");
  if (!managerEmail) return fail("Email Manager Unit wajib diisi.");

  if (managerPassword.length < 8) {
    return fail("Password Manager Unit minimal 8 karakter.");
  }

  if (managerPassword !== managerConfirmPassword) {
    return fail("Konfirmasi password Manager Unit tidak sama.");
  }

  if (createOperator) {
    if (!operatorName || !operatorEmail) {
      return fail(
        "Nama dan email Operator Unit wajib diisi jika operator dibuat."
      );
    }

    if (operatorPassword.length < 8) {
      return fail("Password Operator Unit minimal 8 karakter.");
    }

    if (operatorPassword !== operatorConfirmPassword) {
      return fail("Konfirmasi password Operator Unit tidak sama.");
    }

    if (operatorEmail === managerEmail) {
      return fail(
        "Email Operator Unit tidak boleh sama dengan Email Manager Unit."
      );
    }
  }

  const createdUserIds: string[] = [];
  let createdUnitId: string | null = null;

  try {
    const admin = createAdminClient();

    // Akses unit ditulis dengan service-role (lewat RLS), jadi izin pemanggil
    // harus dicek sendiri di sini — layout dashboard tidak menjaga Server Action.
    const { data: permissionRows, error: permissionError } = await admin
      .from("user_roles")
      .select("id")
      .eq("user_id", actorId)
      .eq("tenant_id", tenantId)
      .in("role", ["direktur_bumdes", "admin_bumdes"])
      .limit(1);

    if (permissionError) {
      return fail(
        describeDatabaseError(permissionError, "Izin pengguna gagal diperiksa.")
      );
    }

    if (!permissionRows?.length) {
      return fail("Anda tidak memiliki izin untuk membuat unit usaha.");
    }

    const { data: existingUnit, error: existingUnitError } = await admin
      .from("business_units")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("kode_unit", kodeUnit)
      .maybeSingle();

    if (existingUnitError) {
      return fail(
        describeDatabaseError(existingUnitError, "Kode unit gagal diperiksa.")
      );
    }

    if (existingUnit) {
      return fail(`Kode unit ${kodeUnit} sudah dipakai di BUMDes ini.`);
    }

    // Akun login dibuat lebih dulu karena inilah langkah yang paling bersih
    // dibatalkan kalau ada yang gagal setelahnya.
    const managerUserId = await createAuthUnitUser({
      role: "manager_unit",
      fullName: managerName,
      email: managerEmail,
      password: managerPassword,
      tenantId,
    });
    createdUserIds.push(managerUserId);

    let operatorUserId: string | null = null;

    if (createOperator) {
      operatorUserId = await createAuthUnitUser({
        role: "operator_unit",
        fullName: operatorName,
        email: operatorEmail,
        password: operatorPassword,
        tenantId,
      });
      createdUserIds.push(operatorUserId);
    }

    const outcome = await createUnitInDatabase({
      tenantId,
      templateId,
      kodeUnit,
      namaUnit,
      jenisUnit,
      managerUserId,
      managerEmail,
      managerName,
      operatorUserId,
      operatorEmail: operatorUserId ? operatorEmail : null,
      operatorName: operatorUserId ? operatorName : null,
    });

    createdUnitId = outcome.unitId;

    if (!outcome.accessAlreadyGranted) {
      await grantUnitAccess({
        userId: managerUserId,
        tenantId,
        unitId: outcome.unitId as string,
        role: "manager_unit",
        fullName: managerName,
        email: managerEmail,
        generatedBy: actorId,
      });

      if (operatorUserId) {
        await grantUnitAccess({
          userId: operatorUserId,
          tenantId,
          unitId: outcome.unitId as string,
          role: "operator_unit",
          fullName: operatorName,
          email: operatorEmail,
          generatedBy: actorId,
        });
      }
    }

    revalidatePath("/bumdes/dashboard");
    revalidatePath("/bumdes/dashboard/units");

    return {
      status: "success",
      message: createOperator
        ? `Unit ${namaUnit} dibuat beserta akun Manager dan Operator Unit.`
        : `Unit ${namaUnit} dibuat beserta akun Manager Unit.`,
    };
  } catch (error) {
    console.error("[bumdes/units] pembuatan unit usaha gagal", error);

    const cleanupNote = await rollbackPartialUnit({
      userIds: createdUserIds,
      unitId: createdUnitId,
      tenantId,
    });

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Terjadi kesalahan tak terduga saat membuat unit usaha.";

    return fail(`${message}${cleanupNote}`);
  }
}
