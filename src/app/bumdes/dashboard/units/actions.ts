"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { generateTemporaryPassword } from "@/lib/auth/generate-temporary-password";

function makeLoginCode(prefix: string) {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

async function createUnitUserAccess(params: {
  tenantId: string;
  unitId: string;
  role: "manager_unit" | "operator_unit";
  fullName: string;
  email: string;
  generatedBy: string;
  unitCode: string;
  unitName: string;
}) {
  const admin = createAdminClient();
  const temporaryPassword = generateTemporaryPassword();

  const { data: createdUser, error: createUserError } =
    await admin.auth.admin.createUser({
      email: params.email,
      password: temporaryPassword,
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
    throw new Error(
      createUserError?.message ||
        `Akun ${params.role} gagal dibuat.`
    );
  }

  await admin
    .from("profiles")
    .update({
      full_name: params.fullName,
      default_tenant_id: params.tenantId,
    })
    .eq("id", createdUser.user.id);

  const { error: roleError } = await admin.from("user_roles").insert({
    user_id: createdUser.user.id,
    role: params.role,
    tenant_id: params.tenantId,
    unit_id: params.unitId,
  });

  if (roleError) {
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
      must_change_password: true,
      access_status: "active",
      generated_by: params.generatedBy,
    });

  if (credentialError) {
    throw new Error(
      credentialError.message ||
        `Credential akses ${params.role} gagal disimpan.`
    );
  }

  console.log("AKSES UNIT BARU", {
    unit: params.unitName,
    role: params.role,
    email: params.email,
    temporaryPassword,
    tenantId: params.tenantId,
    unitId: params.unitId,
  });
}

export async function createBusinessUnitWithAccess(formData: FormData) {
  const context = await getLoginContext();

  if (!context || !context.user_id || !context.tenant_id) {
    throw new Error("Sesi login tidak valid.");
  }

  const templateId = String(formData.get("template_id") ?? "");
  const kodeUnit = String(formData.get("kode_unit") ?? "").trim().toUpperCase();
  const namaUnit = String(formData.get("nama_unit") ?? "").trim();
  const jenisUnit = String(formData.get("jenis_unit") ?? "").trim();

  const managerName = String(formData.get("manager_name") ?? "").trim();
  const managerEmail = String(formData.get("manager_email") ?? "").trim();

  const createOperator = String(formData.get("create_operator") ?? "") === "on";
  const operatorName = String(formData.get("operator_name") ?? "").trim();
  const operatorEmail = String(formData.get("operator_email") ?? "").trim();

  if (!templateId) throw new Error("Template unit wajib dipilih.");
  if (!kodeUnit) throw new Error("Kode unit wajib diisi.");
  if (!namaUnit) throw new Error("Nama unit wajib diisi.");
  if (!jenisUnit) throw new Error("Jenis unit wajib diisi.");
  if (!managerName) throw new Error("Nama Manager Unit wajib diisi.");
  if (!managerEmail) throw new Error("Email Manager Unit wajib diisi.");

  if (createOperator && (!operatorName || !operatorEmail)) {
    throw new Error("Nama dan email Operator Unit wajib diisi jika operator dibuat.");
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
      generatedBy: context.user_id,
      unitCode: kodeUnit,
      unitName: namaUnit,
    });
  }

  revalidatePath("/bumdes/dashboard");
  revalidatePath("/bumdes/dashboard/units");
}
