import { NextResponse } from "next/server";
import { getLoginContext } from "@/lib/auth/get-login-context";
import { createClient } from "@/lib/supabase/server";

type TenantAccessFeature = "orvia_ai" | "transaction_assistant";

type TenantAccessBody = {
  tenantId?: string;
  feature?: TenantAccessFeature;
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
  transaction_assistant_enabled: boolean | null;
  notes: string | null;
  transaction_assistant_notes: string | null;
  enabled_at: string | null;
  disabled_at: string | null;
  transaction_assistant_enabled_at: string | null;
  transaction_assistant_disabled_at: string | null;
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
        .select(
          "tenant_id,is_enabled,transaction_assistant_enabled,notes,transaction_assistant_notes,enabled_at,disabled_at,transaction_assistant_enabled_at,transaction_assistant_disabled_at,updated_at"
        )
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
        transaction_assistant_enabled:
          access?.transaction_assistant_enabled ?? true,
        notes: access?.notes ?? null,
        transaction_assistant_notes:
          access?.transaction_assistant_notes ?? null,
        enabled_at: access?.enabled_at ?? null,
        disabled_at: access?.disabled_at ?? null,
        transaction_assistant_enabled_at:
          access?.transaction_assistant_enabled_at ?? null,
        transaction_assistant_disabled_at:
          access?.transaction_assistant_disabled_at ?? null,
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
  const feature: TenantAccessFeature =
    body?.feature === "transaction_assistant"
      ? "transaction_assistant"
      : "orvia_ai";
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

  const rpcName =
    feature === "transaction_assistant"
      ? "set_transaction_assistant_tenant_access"
      : "set_orvia_ai_tenant_access";

  const { data, error } = await supabase.rpc(rpcName, {
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
    feature,
    message:
      feature === "transaction_assistant"
        ? isEnabled
          ? "Asisten Catat Transaksi diaktifkan untuk BUMDes terpilih."
          : "Asisten Catat Transaksi dinonaktifkan untuk BUMDes terpilih."
        : isEnabled
          ? "ORVIA AI diaktifkan untuk BUMDes terpilih."
          : "ORVIA AI dinonaktifkan untuk BUMDes terpilih.",
    access: data,
  });
}