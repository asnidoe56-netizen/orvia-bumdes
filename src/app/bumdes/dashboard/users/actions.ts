"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginContext } from "@/lib/auth/get-login-context";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return clean(value).toLowerCase();
}

function buildLoginCode() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OPR-${randomPart}`;
}

async function deleteAuthUserIfExists(userId: string | null) {
  if (!userId) return;

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(userId);
}

export async function createBumdesUnitUser(formData: FormData) {
  const context = await getLoginContext();

  if (!context?.user_id || !context.tenant_id) {
    throw new Error("Sesi login tidak valid.");
  }

  const fullName = clean(formData.get("full_name"));
  const unitId = clean(formData.get("unit_id"));
  const email = normalizeEmail(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!fullName) {
    throw new Error("Nama wajib diisi.");
  }

  if (!unitId) {
    throw new Error("Unit usaha wajib dipilih.");
  }

  if (!email) {
    throw new Error("Email wajib diisi.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Format email tidak valid.");
  }

  if (password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  if (password !== confirmPassword) {
    throw new Error("Konfirmasi password tidak sama.");
  }

  const admin = createAdminClient();

  const { data: permissionRows, error: permissionError } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", context.user_id)
    .eq("tenant_id", context.tenant_id)
    .in("role", ["direktur_bumdes", "admin_bumdes"])
    .limit(1);

  if (permissionError) {
    throw new Error(permissionError.message);
  }

  if (!permissionRows?.length) {
    throw new Error("Anda tidak memiliki izin untuk menambah pengguna BUMDes.");
  }

  const { data: unit, error: unitError } = await admin
    .from("business_units")
    .select("id, tenant_id, status")
    .eq("id", unitId)
    .eq("tenant_id", context.tenant_id)
    .maybeSingle();

  if (unitError) {
    throw new Error(unitError.message);
  }

  if (!unit) {
    throw new Error("Unit usaha tidak ditemukan pada tenant aktif.");
  }

  if (!["aktif", "active"].includes(String(unit.status).toLowerCase())) {
    throw new Error("Unit usaha tidak aktif.");
  }

  const { data: existingCredential, error: credentialCheckError } = await admin
    .from("unit_access_credentials")
    .select("id")
    .eq("tenant_id", context.tenant_id)
    .eq("unit_id", unitId)
    .eq("email_virtual", email)
    .maybeSingle();

  if (credentialCheckError) {
    throw new Error(credentialCheckError.message);
  }

  if (existingCredential) {
    throw new Error("Email sudah terdaftar sebagai akses unit pada unit ini.");
  }

  let createdUserId: string | null = null;

  try {
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: context.tenant_id,
        unit_id: unitId,
        role: "operator_unit",
        source: "bumdes_users_add_dialog",
      },
    });

    if (authError || !authData.user) {
      const message = authError?.message ?? "";

      if (message.toLowerCase().includes("already been registered")) {
        throw new Error(
          `Email ${email} sudah terdaftar sebagai akun login. Gunakan email lain atau reset password akun tersebut.`,
        );
      }

      throw new Error(authError?.message || "Akun login gagal dibuat.");
    }

    createdUserId = authData.user.id;

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: createdUserId,
        full_name: fullName,
        default_tenant_id: context.tenant_id,
      },
      {
        onConflict: "id",
      },
    );

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: roleError } = await admin.from("user_roles").insert({
      user_id: createdUserId,
      role: "operator_unit",
      tenant_id: context.tenant_id,
      unit_id: unitId,
    });

    if (roleError) {
      throw new Error(roleError.message);
    }

    const maxAttempts = 5;
    let credentialCreated = false;
    let lastCredentialError: string | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const loginCode = buildLoginCode();

      const { error: credentialError } = await admin
        .from("unit_access_credentials")
        .insert({
          user_id: createdUserId,
          tenant_id: context.tenant_id,
          unit_id: unitId,
          login_code: loginCode,
          email_virtual: email,
          role: "operator_unit",
          must_change_password: false,
          access_status: "active",
          generated_by: context.user_id,
        });

      if (!credentialError) {
        credentialCreated = true;
        break;
      }

      lastCredentialError = credentialError.message;

      if (!credentialError.message.toLowerCase().includes("duplicate")) {
        break;
      }
    }

    if (!credentialCreated) {
      throw new Error(lastCredentialError || "Kredensial akses unit gagal dibuat.");
    }

    revalidatePath("/bumdes/dashboard/users");

    return {
      ok: true,
      message: "Pengguna berhasil ditambahkan.",
    };
  } catch (error) {
    await deleteAuthUserIfExists(createdUserId);

    throw error;
  }
}
