import { createClient } from "@/lib/supabase/server";
import type { LoginContext } from "@/types/auth";

export async function getLoginContext(): Promise<LoginContext | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const { data, error } = await supabase.rpc("get_user_login_context", {
    p_user_id: user.id,
  });

  if (error || !data) {
    return {
      user_id: user.id,
      role: null,
      tenant_id: null,
      unit_id: null,
      redirect_path: "/login",
    };
  }

  const row = Array.isArray(data) ? data[0] : data;

  return {
    user_id: user.id,
    role: row.role ?? null,
    tenant_id: row.tenant_id ?? null,
    unit_id: row.unit_id ?? null,
    redirect_path: row.redirect_path ?? "/login",
    full_name: row.full_name ?? null,
  };
}