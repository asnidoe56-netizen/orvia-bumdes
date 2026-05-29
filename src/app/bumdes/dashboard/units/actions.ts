"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginContext } from "@/lib/auth/get-login-context";

function makeLoginCode(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function createUnitUserAccess(params: {
  tenantId: string;
  unitId: string;
  role: "manager_unit" | "operator_unit";
  fullName: string;
  email: string;
  password: string;
  generatedBy: string;
  unitCode: string;
  unitName: string;
}) {
  const admin = createAdminClient();

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      user_metadata: {
        full_name: params.fullName,
        tenant_id: params.tenantId,
        unit_id: params.unitId,
        role: params.role,
        source: "business_unit_creation",
      },
    });

  if (createUserError || !createdUser.user) {
    const message = createUserError?.message ?? "";

    if (message.toLowerCase().includes("already been registered")) {
      throw new Error(
        `Email ${params.email} sudah terdaftar sebagai akun login. Gunakan email lain, atau reset password akun tersebut dari Supabase Auth.`
      );
    }

    throw new Error(
      createUserError?.message || `Akun ${params.role} gagal dibuat.`
    );
  }

  await admin
    .from("profiles")
    .upsert(
      {
        id: createdUser.user.id,
        full_name: params.fullName,
        default_tenant_id: params.tenantId,
      },
      {
        onConflict: "id",
      }
    );

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: createdUser.user.id,
    role: params.role,
    tenant_id: params.tenantId,
    unit_id: params.unitId,
  });

  if (roleError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);

    throw new Error(
      roleError.message || `Role ${params.role} gagal disimpan.`
    );
  }

  const { error: credentialError } = await admin
    .from("unit_access_credentials")
    .insert({
      user_id: createdUser.user.id,
      tenant_id: params.tenantId,
      unit_id: params.unitId,
      login_code: makeLoginCode(`${params.unitCode}-${params.role}`),
      email_virtual: params.email,
      role: params.role,
      must_change_password: false,
      access_status: "active",
      generated_by: params.generatedBy,
    });

  if (credentialError) {
    await admin.auth.admin.deleteUser(createdUser.user.id);

    throw new Error(
      credentialError.message ||
        `Credential akses ${params.role} gagal disimpan.`
    );
  }
}

export async function createBusinessUnitWithAccess(formData: FormData) {
  const context = await getLoginContext();

  if (!context || !context.user_id || !context.tenant_id) {
    throw new Error("Sesi login tidak valid.");
  }

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

  if (!templateId) throw new Error("Template unit wajib dipilih.");
  if (!kodeUnit) throw new Error("Kode unit wajib diisi.");
  if (!namaUnit) throw new Error("Nama unit wajib diisi.");
  if (!jenisUnit) throw new Error("Jenis unit wajib diisi.");
  if (!managerName) throw new Error("Nama Manager Unit wajib diisi.");
  if (!managerEmail) throw new Error("Email Manager Unit wajib diisi.");

  if (managerPassword.length < 8) {
    throw new Error("Password Manager Unit minimal 8 karakter.");
  }

  if (managerPassword !== managerConfirmPassword) {
    throw new Error("Konfirmasi password Manager Unit tidak sama.");
  }

  if (createOperator) {
    if (!operatorName || !operatorEmail) {
      throw new Error(
        "Nama dan email Operator Unit wajib diisi jika operator dibuat."
      );
    }

    if (operatorPassword.length < 8) {
      throw new Error("Password Operator Unit minimal 8 karakter.");
    }

    if (operatorPassword !== operatorConfirmPassword) {
      throw new Error("Konfirmasi password Operator Unit tidak sama.");
    }

    if (operatorEmail === managerEmail) {
      throw new Error("Email Operator Unit tidak boleh sama dengan Email Manager Unit.");
    }
  }

  const supabase = await createClient();

  const { data: unitId, error: unitError } = await supabase.rpc(
    "create_business_unit",
    {
      p_tenant_id: context.tenant_id,
      p_template_id: templateId,
      p_kode_unit: kodeUnit,
      p_nama_unit: namaUnit,
      p_jenis_unit: jenisUnit,
    }
  );

  if (unitError || !unitId) {
    throw new Error(unitError?.message || "Unit usaha gagal dibuat.");
  }

  await createUnitUserAccess({
    tenantId: context.tenant_id,
    unitId,
    role: "manager_unit",
    fullName: managerName,
    email: managerEmail,
    password: managerPassword,
    generatedBy: context.user_id,
    unitCode: kodeUnit,
    unitName: namaUnit,
  });

  if (createOperator) {
    await createUnitUserAccess({
      tenantId: context.tenant_id,
      unitId,
      role: "operator_unit",
      fullName: operatorName,
      email: operatorEmail,
      password: operatorPassword,
      generatedBy: context.user_id,
      unitCode: kodeUnit,
      unitName: namaUnit,
    });
  }

  revalidatePath("/bumdes/dashboard");
  revalidatePath("/bumdes/dashboard/units");
}
