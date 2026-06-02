"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLoginContext } from "@/lib/auth/get-login-context";

function clean(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

async function createAuthUnitUser(params: {
  role: "manager_unit" | "operator_unit";
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
      source: "business_unit_atomic_creation",
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

async function deleteAuthUserIfExists(userId: string | null) {
  if (!userId) return;

  const admin = createAdminClient();

  await admin.auth.admin.deleteUser(userId);
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
      throw new Error(
        "Email Operator Unit tidak boleh sama dengan Email Manager Unit."
      );
    }
  }

  let managerUserId: string | null = null;
  let operatorUserId: string | null = null;

  try {
    managerUserId = await createAuthUnitUser({
      role: "manager_unit",
      fullName: managerName,
      email: managerEmail,
      password: managerPassword,
      tenantId: context.tenant_id,
    });

    if (createOperator) {
      operatorUserId = await createAuthUnitUser({
        role: "operator_unit",
        fullName: operatorName,
        email: operatorEmail,
        password: operatorPassword,
        tenantId: context.tenant_id,
      });
    }

    const supabase = await createClient();

    const { error } = await supabase.rpc(
      "create_business_unit_with_existing_access",
      {
        p_tenant_id: context.tenant_id,
        p_template_id: templateId,
        p_kode_unit: kodeUnit,
        p_nama_unit: namaUnit,
        p_jenis_unit: jenisUnit,
        p_manager_user_id: managerUserId,
        p_manager_email: managerEmail,
        p_manager_full_name: managerName,
        p_manager_login_code: null,
        p_operator_user_id: operatorUserId,
        p_operator_email: createOperator ? operatorEmail : null,
        p_operator_full_name: createOperator ? operatorName : null,
        p_operator_login_code: null,
      }
    );

    if (error) {
      throw new Error(error.message || "Unit usaha dan kredensial gagal dibuat.");
    }

    revalidatePath("/bumdes/dashboard");
    revalidatePath("/bumdes/dashboard/units");
  } catch (error) {
    await deleteAuthUserIfExists(operatorUserId);
    await deleteAuthUserIfExists(managerUserId);

    throw error;
  }
}
