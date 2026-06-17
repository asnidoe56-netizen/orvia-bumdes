import { NextResponse } from "next/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type TenantAccessBody = {
  tenantId?: string;
  isEnabled?: boolean;
  notes?: string | null;
};

type TenantRow = {
  id: string;
  kode_bumdes: string | null;
  nama_bumdes: string | null;
  nama_desa: string | null;
  nama_kecamatan: string | null;
  status: string | null;
};

type TenantAccessRow = {
  tenant_id: string;
  is_enabled: boolean;
  notes: string | null;
  enabled_at: string | null;
  disabled_at: string | null;
  updated_at: string | null;
};

async function requirePlatformAccess() {
  const context = await getLoginContext();

  if (context?.role !== "super_admin_platform") {
    return NextResponse.json(
      {
        success: false,
        error:
          "Hanya Super Admin Platform yang boleh mengatur akses ORVIA AI BUMDes.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function GET() {
  const denied = await requirePlatformAccess();

  if (denied) {
    return denied;
  }

  const supabase = await createClient();

  const [{ data: tenants, error: tenantError }, { data: accessRows, error: accessError }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id,kode_bumdes,nama_bumdes,nama_desa,nama_kecamatan,status")
        .order("created_at", { ascending: false })
        .returns<TenantRow[]>(),
      supabase
        .from("orvia_ai_tenant_access")
        .select("tenant_id,is_enabled,notes,enabled_at,disabled_at,updated_at")
        .returns<TenantAccessRow[]>(),
    ]);

  if (tenantError) {
    return NextResponse.json(
      {
        success: false,
        error: tenantError.message,
      },
      { status: 500 }
    );
  }

  if (accessError) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Tabel izin ORVIA AI belum dapat dibaca. Pastikan migrasi database sudah dijalankan. Detail: " +
          accessError.message,
      },
      { status: 500 }
    );
  }

  const accessByTenant = new Map(
    (accessRows ?? []).map((row) => [row.tenant_id, row])
  );

  return NextResponse.json({
    success: true,
    tenants: (tenants ?? []).map((tenant) => {
      const access = accessByTenant.get(tenant.id);

      return {
        tenant_id: tenant.id,
        kode_bumdes: tenant.kode_bumdes,
        nama_bumdes: tenant.nama_bumdes,
        nama_desa: tenant.nama_desa,
        nama_kecamatan: tenant.nama_kecamatan,
        status: tenant.status,
        is_enabled: access?.is_enabled ?? false,
        notes: access?.notes ?? null,
        enabled_at: access?.enabled_at ?? null,
        disabled_at: access?.disabled_at ?? null,
        updated_at: access?.updated_at ?? null,
      };
    }),
  });
}

export async function POST(request: Request) {
  const denied = await requirePlatformAccess();

  if (denied) {
    return denied;
  }

  const body = (await request.json().catch(() => null)) as TenantAccessBody | null;
  const tenantId = String(body?.tenantId ?? "").trim();
  const isEnabled = body?.isEnabled === true;
  const notes =
    typeof body?.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

  if (!tenantId) {
    return NextResponse.json(
      {
        success: false,
        error: "Tenant tidak valid.",
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("set_orvia_ai_tenant_access", {
    p_tenant_id: tenantId,
    p_is_enabled: isEnabled,
    p_notes: notes,
  });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: isEnabled
      ? "ORVIA AI diaktifkan untuk BUMDes terpilih."
      : "ORVIA AI dinonaktifkan untuk BUMDes terpilih.",
    access: data,
  });
}