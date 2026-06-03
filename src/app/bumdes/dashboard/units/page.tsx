export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { UnitsClient } from "./units-client";

export type UnitTemplate = {
  id: string;
  kode_template: string;
  nama_template: string;
  deskripsi: string | null;
};

export type BusinessUnit = {
  id: string;
  kode_unit: string;
  nama_unit: string;
  jenis_unit: string;
  status: string;
};

export type UnitAccessCredential = {
  id: string;
  unit_id: string;
  login_code: string;
  email_virtual: string;
  role: "manager_unit" | "operator_unit" | string;
  access_status: string;
  must_change_password: boolean;
  generated_at: string;
};

export default async function BumdesUnitsPage() {
  const context = await getLoginContext();

  if (!context || !context.tenant_id) {
    redirect("/login");
  }

  const supabase = await createClient();

  const { data: templates, error: templateError } = await supabase
    .from("unit_templates")
    .select("id, kode_template, nama_template, deskripsi")
    .eq("is_active", true)
    .order("kode_template", { ascending: true });

  const { data: units, error: unitError } = await supabase
    .from("business_units")
    .select("id, kode_unit, nama_unit, jenis_unit, status")
    .eq("tenant_id", context.tenant_id)
    .order("created_at", { ascending: false });

  const { data: credentials, error: credentialError } = await supabase
    .from("unit_access_credentials")
    .select(
      "id, unit_id, login_code, email_virtual, role, access_status, must_change_password, generated_at"
    )
    .eq("tenant_id", context.tenant_id)
    .order("generated_at", { ascending: true });

  return (
    <UnitsClient
      templates={(templates ?? []) as UnitTemplate[]}
      units={(units ?? []) as BusinessUnit[]}
      credentials={(credentials ?? []) as UnitAccessCredential[]}
      errorMessage={
        templateError?.message || unitError?.message || credentialError?.message || null
      }
    />
  );
}
