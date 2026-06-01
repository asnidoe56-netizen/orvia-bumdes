-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000010_business_unit_provisioning_engine.sql
--
-- Scope:
-- - Tenant core finance account provisioning
-- - Business unit creation/provisioning engine
--
-- Notes:
-- - Fresh-install baseline.
-- - Depends on:
--   000004 unit template registry
--   000005 chart of accounts engine
--   000006 accounting period/journal engine
--   000007 audit timeline engine
--   000008 cash bank engine
--   000009 equity engine
-- - Master plan capital flow is deferred to governance/capital migrations.
-- - No reporting views in this migration.
-- ============================================================

begin;

-- ============================================================
-- 1. TENANT CORE FINANCE ACCOUNT PROVISIONING
-- ============================================================

create or replace function public.provision_tenant_core_finance_accounts(
  p_tenant_id uuid,
  p_created_by uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_created_coa integer := 0;
  v_created_cash_bank integer := 0;
  v_created_equity integer := 0;
  v_row_count integer := 0;

  v_1000 uuid;
  v_1100 uuid;
  v_1110 uuid;
  v_1120 uuid;
  v_3000 uuid;
  v_3100 uuid;
  v_3200 uuid;
  v_3300 uuid;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.status = 'active'::public.tenant_status
  ) then
    raise exception 'Tenant tidak ditemukan atau tidak aktif';
  end if;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    kode,
    nama,
    account_type,
    tipe,
    normal_balance,
    is_postable,
    is_active
  )
  values
    (p_tenant_id, null, '1000', 'Aset', 'ASET', 'aset', 'debit', true, true),
    (p_tenant_id, null, '3000', 'Ekuitas', 'EKUITAS', 'ekuitas', 'credit', true, true)
  on conflict (tenant_id, unit_id, kode) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_coa := v_created_coa + v_row_count;

  select id into v_1000
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '1000'
  limit 1;

  select id into v_3000
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '3000'
  limit 1;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    parent_id,
    kode,
    nama,
    account_type,
    tipe,
    normal_balance,
    is_postable,
    is_active
  )
  values
    (p_tenant_id, null, v_1000, '1100', 'Kas dan Setara Kas', 'ASET', 'aset', 'debit', true, true),
    (p_tenant_id, null, v_3000, '3100', 'Modal BUMDes', 'EKUITAS', 'ekuitas', 'credit', true, true),
    (p_tenant_id, null, v_3000, '3200', 'Saldo Laba Ditahan', 'EKUITAS', 'ekuitas', 'credit', true, true),
    (p_tenant_id, null, v_3000, '3300', 'Surplus Defisit Tahun Berjalan', 'EKUITAS', 'ekuitas', 'credit', true, true)
  on conflict (tenant_id, unit_id, kode) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_coa := v_created_coa + v_row_count;

  select id into v_1100
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '1100'
  limit 1;

  select id into v_3100
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '3100'
  limit 1;

  select id into v_3200
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '3200'
  limit 1;

  select id into v_3300
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '3300'
  limit 1;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    parent_id,
    kode,
    nama,
    account_type,
    tipe,
    normal_balance,
    is_postable,
    is_active
  )
  values
    (p_tenant_id, null, v_1100, '1110', 'Kas', 'ASET', 'aset', 'debit', true, true),
    (p_tenant_id, null, v_1100, '1120', 'Bank', 'ASET', 'aset', 'debit', true, true)
  on conflict (tenant_id, unit_id, kode) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_coa := v_created_coa + v_row_count;

  select id into v_1110
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '1110'
  limit 1;

  select id into v_1120
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id is null
    and kode = '1120'
  limit 1;

  insert into public.cash_bank_accounts (
    tenant_id,
    unit_id,
    account_id,
    account_code,
    account_name,
    account_kind,
    currency_code,
    opening_balance,
    is_active,
    created_by
  )
  values
    (
      p_tenant_id,
      null,
      v_1110,
      'KAS-PUSAT',
      'Kas BUMDes',
      'cash',
      'IDR',
      0,
      true,
      p_created_by
    ),
    (
      p_tenant_id,
      null,
      v_1120,
      'BANK-PUSAT',
      'Bank BUMDes',
      'bank',
      'IDR',
      0,
      true,
      p_created_by
    )
  on conflict (tenant_id, unit_id, account_code) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_cash_bank := v_created_cash_bank + v_row_count;

  insert into public.equity_accounts (
    tenant_id,
    unit_id,
    account_id,
    equity_code,
    equity_name,
    equity_type,
    opening_balance,
    is_active,
    created_by
  )
  values
    (
      p_tenant_id,
      null,
      v_3100,
      'MODAL-AWAL-DESA',
      'Penyertaan Modal Awal Desa',
      'initial_capital',
      0,
      true,
      p_created_by
    ),
    (
      p_tenant_id,
      null,
      v_3100,
      'MODAL-TAMBAHAN-DESA',
      'Penyertaan Modal Tambahan Desa',
      'additional_capital',
      0,
      true,
      p_created_by
    ),
    (
      p_tenant_id,
      null,
      v_3200,
      'LABA-DITAHAN',
      'Saldo Laba Ditahan',
      'retained_earnings',
      0,
      true,
      p_created_by
    ),
    (
      p_tenant_id,
      null,
      v_3300,
      'SURPLUS-TAHUN-BERJALAN',
      'Surplus Defisit Tahun Berjalan',
      'current_year_surplus',
      0,
      true,
      p_created_by
    )
  on conflict on constraint equity_accounts_scope_code_unique do nothing;

  get diagnostics v_row_count = row_count;
  v_created_equity := v_created_equity + v_row_count;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'created_coa', v_created_coa,
    'created_cash_bank_accounts', v_created_cash_bank,
    'created_equity_accounts', v_created_equity
  );
end;
$function$;

-- ============================================================
-- 2. BUSINESS UNIT CREATION / PROVISIONING ENGINE
-- ============================================================

create or replace function public.create_business_unit(
  p_tenant_id uuid,
  p_template_id uuid,
  p_kode_unit text,
  p_nama_unit text,
  p_jenis_unit text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_unit_id uuid;
  v_actor_role public.app_role;
  v_template public.unit_templates%rowtype;
  v_cash_bank_created_count integer := 0;
  v_equity_created_count integer := 0;
  v_period_created_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  perform public.assert_user_has_permission(
    'unit.manage',
    auth.uid(),
    p_tenant_id,
    null
  );

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.status = 'active'::public.tenant_status
  ) then
    raise exception 'Tenant tidak ditemukan atau belum aktif';
  end if;

  select *
  into v_template
  from public.unit_templates
  where id = p_template_id
    and is_active = true;

  if not found then
    raise exception 'Template unit tidak ditemukan atau tidak aktif';
  end if;

  if nullif(trim(p_kode_unit), '') is null then
    raise exception 'Kode unit wajib diisi';
  end if;

  if nullif(trim(p_nama_unit), '') is null then
    raise exception 'Nama unit wajib diisi';
  end if;

  if nullif(trim(p_jenis_unit), '') is null then
    raise exception 'Jenis unit wajib diisi';
  end if;

  if exists (
    select 1
    from public.business_units bu
    where bu.tenant_id = p_tenant_id
      and bu.kode_unit = upper(trim(p_kode_unit))
  ) then
    raise exception 'Kode unit sudah digunakan dalam tenant ini';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.tenant_id = p_tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end
  limit 1;

  insert into public.business_units (
    tenant_id,
    template_id,
    kode_unit,
    nama_unit,
    jenis_unit,
    status
  )
  values (
    p_tenant_id,
    p_template_id,
    upper(trim(p_kode_unit)),
    trim(p_nama_unit),
    trim(p_jenis_unit),
    'aktif'::public.unit_status
  )
  returning id into v_unit_id;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    is_postable,
    is_active
  )
  select
    p_tenant_id,
    v_unit_id,
    ctu.kode,
    ctu.nama,
    ctu.tipe,
    ctu.account_type,
    ctu.normal_balance,
    true,
    true
  from public.coa_template_unit ctu
  where ctu.template_id = p_template_id
  on conflict (tenant_id, unit_id, kode) do nothing;

  v_cash_bank_created_count := public.provision_default_cash_bank_accounts(
    p_tenant_id,
    v_unit_id,
    auth.uid()
  );

  v_equity_created_count := public.provision_unit_equity_accounts(
    p_tenant_id,
    v_unit_id,
    auth.uid()
  );

  v_period_created_count := public.provision_unit_accounting_periods(
    p_tenant_id,
    v_unit_id,
    auth.uid()
  );

  perform public.log_audit_event(
    p_tenant_id,
    v_unit_id,
    auth.uid(),
    v_actor_role,
    'business_unit_created'::text,
    'business_units'::text,
    v_unit_id,
    'bumdes_dashboard'::text,
    v_unit_id,
    'Unit usaha baru dibuat, COA unit digenerate dari template, akun kas/bank default, akun modal unit, dan periode akuntansi unit diprovisioning.'::text,
    jsonb_build_object(
      'tenant_id', p_tenant_id,
      'unit_id', v_unit_id,
      'template_id', p_template_id,
      'kode_unit', upper(trim(p_kode_unit)),
      'nama_unit', trim(p_nama_unit),
      'jenis_unit', trim(p_jenis_unit),
      'template_code', v_template.kode_template,
      'cash_bank_accounts_created', v_cash_bank_created_count,
      'equity_accounts_created', v_equity_created_count,
      'accounting_periods_created', v_period_created_count
    )
  );

  return v_unit_id;
end;
$function$;

-- ============================================================
-- 3. GRANTS
-- ============================================================

grant execute on function public.provision_tenant_core_finance_accounts(uuid, uuid)
  to authenticated, service_role;

grant execute on function public.create_business_unit(uuid, uuid, text, text, text)
  to authenticated, service_role;

commit;
