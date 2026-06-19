-- Tenant lifecycle engine for Platform Admin.
-- Purpose:
-- 1. Suspend tenant
-- 2. Reactivate tenant
-- 3. Delete tenant with structured audit backup
--
-- Frontend must call RPC only. Do not delete tenant rows directly from UI.

create table if not exists public.tenant_lifecycle_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid null,
  action text not null check (action in ('suspend', 'activate', 'delete')),
  actor_id uuid null references public.profiles(id) on delete set null,
  actor_role public.app_role null,
  reason text not null,
  confirmation_text text null,
  tenant_snapshot jsonb not null default '{}'::jsonb,
  affected_counts jsonb not null default '{}'::jsonb,
  status text not null default 'completed' check (status in ('started', 'completed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.tenant_lifecycle_backup_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.tenant_lifecycle_batches(id) on delete cascade,
  tenant_id uuid null,
  table_schema text not null,
  table_name text not null,
  row_pk text null,
  payload jsonb not null,
  backed_up_at timestamptz not null default now()
);

create index if not exists idx_tenant_lifecycle_batches_tenant_id
  on public.tenant_lifecycle_batches(tenant_id);

create index if not exists idx_tenant_lifecycle_batches_action
  on public.tenant_lifecycle_batches(action);

create index if not exists idx_tenant_lifecycle_backup_rows_batch_id
  on public.tenant_lifecycle_backup_rows(batch_id);

create index if not exists idx_tenant_lifecycle_backup_rows_tenant_id
  on public.tenant_lifecycle_backup_rows(tenant_id);

alter table public.tenant_lifecycle_batches enable row level security;
alter table public.tenant_lifecycle_backup_rows enable row level security;

drop policy if exists "platform admins read tenant lifecycle batches"
  on public.tenant_lifecycle_batches;

create policy "platform admins read tenant lifecycle batches"
  on public.tenant_lifecycle_batches
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'super_admin_platform'::public.app_role
    )
  );

drop policy if exists "platform admins read tenant lifecycle backup rows"
  on public.tenant_lifecycle_backup_rows;

create policy "platform admins read tenant lifecycle backup rows"
  on public.tenant_lifecycle_backup_rows
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'super_admin_platform'::public.app_role
    )
  );

create or replace function public.platform_assert_super_admin()
returns public.app_role
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role public.app_role;
begin
  if v_actor_id is null then
    raise exception 'User belum login.';
  end if;

  select ur.role
    into v_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and ur.role = 'super_admin_platform'::public.app_role
  limit 1;

  if v_role is null then
    raise exception 'Aksi ini hanya untuk Super Admin Platform.';
  end if;

  return v_role;
end;
$$;

grant execute on function public.platform_assert_super_admin()
  to authenticated;

create or replace function public.set_tenant_lifecycle_status(
  p_tenant_id uuid,
  p_status public.tenant_status,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_tenant public.tenants%rowtype;
  v_old_status public.tenant_status;
  v_action text;
  v_batch_id uuid;
begin
  v_actor_role := public.platform_assert_super_admin();

  if p_tenant_id is null then
    raise exception 'Tenant tidak valid.';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan wajib diisi.';
  end if;

  if p_status not in ('active'::public.tenant_status, 'suspended'::public.tenant_status) then
    raise exception 'Status hanya boleh active atau suspended.';
  end if;

  select *
    into v_tenant
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant tidak ditemukan.';
  end if;

  v_old_status := v_tenant.status;
  v_action := case
    when p_status = 'active'::public.tenant_status then 'activate'
    else 'suspend'
  end;

  insert into public.tenant_lifecycle_batches (
    tenant_id,
    action,
    actor_id,
    actor_role,
    reason,
    tenant_snapshot,
    affected_counts,
    status,
    started_at,
    finished_at,
    metadata
  )
  values (
    p_tenant_id,
    v_action,
    v_actor_id,
    v_actor_role,
    trim(p_reason),
    to_jsonb(v_tenant),
    jsonb_build_object('tenants', 1),
    'completed',
    now(),
    now(),
    jsonb_build_object(
      'old_status', v_old_status,
      'new_status', p_status
    )
  )
  returning id into v_batch_id;

  update public.tenants
  set status = p_status,
      updated_at = now()
  where id = p_tenant_id;

  insert into public.audit_timeline (
    tenant_id,
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    source_type,
    source_id,
    description,
    metadata
  )
  values (
    p_tenant_id,
    v_actor_id,
    v_actor_role,
    'tenant_' || v_action,
    'tenants',
    p_tenant_id,
    'tenant_lifecycle_batches',
    v_batch_id,
    case
      when v_action = 'activate' then 'Tenant diaktifkan kembali oleh Admin Platform.'
      else 'Tenant disuspend oleh Admin Platform.'
    end,
    jsonb_build_object(
      'reason', trim(p_reason),
      'old_status', v_old_status,
      'new_status', p_status,
      'batch_id', v_batch_id
    )
  );

  return jsonb_build_object(
    'ok', true,
    'action', v_action,
    'tenant_id', p_tenant_id,
    'old_status', v_old_status,
    'new_status', p_status,
    'batch_id', v_batch_id
  );
end;
$$;

grant execute on function public.set_tenant_lifecycle_status(uuid, public.tenant_status, text)
  to authenticated;

create or replace function public.backup_tenant_lifecycle_table_rows(
  p_batch_id uuid,
  p_tenant_id uuid,
  p_table_schema text,
  p_table_name text,
  p_where_sql text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sql text;
  v_count integer := 0;
begin
  if p_batch_id is null or p_table_schema is null or p_table_name is null or p_where_sql is null then
    raise exception 'Parameter backup tidak lengkap.';
  end if;

  v_sql := format(
    'insert into public.tenant_lifecycle_backup_rows (batch_id, tenant_id, table_schema, table_name, row_pk, payload)
     select $1, $2, %L, %L, to_jsonb(src)->>''id'', to_jsonb(src)
     from %I.%I src
     where %s',
    p_table_schema,
    p_table_name,
    p_table_schema,
    p_table_name,
    p_where_sql
  );

  execute v_sql using p_batch_id, p_tenant_id;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke all on function public.backup_tenant_lifecycle_table_rows(uuid, uuid, text, text, text)
  from public;

create or replace function public.delete_tenant_with_audit(
  p_tenant_id uuid,
  p_confirmation_text text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_tenant public.tenants%rowtype;
  v_expected_confirmation text;
  v_batch_id uuid;
  v_batch_key text;
  v_counts jsonb := '{}'::jsonb;
  v_table record;
  v_count integer := 0;
  v_remaining integer := 0;
  v_progress boolean := false;
  v_attempt integer := 0;
begin
  v_actor_role := public.platform_assert_super_admin();

  if p_tenant_id is null then
    raise exception 'Tenant tidak valid.';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan hapus tenant wajib diisi.';
  end if;

  select *
    into v_tenant
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant tidak ditemukan.';
  end if;

  v_expected_confirmation := 'HAPUS-' || upper(v_tenant.kode_bumdes);

  if upper(trim(coalesce(p_confirmation_text, ''))) <> v_expected_confirmation then
    raise exception 'Kode konfirmasi tidak sesuai. Ketik: %', v_expected_confirmation;
  end if;

  v_batch_key := 'tenant-delete-' || replace(p_tenant_id::text, '-', '') || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

  insert into public.tenant_lifecycle_batches (
    tenant_id,
    action,
    actor_id,
    actor_role,
    reason,
    confirmation_text,
    tenant_snapshot,
    affected_counts,
    status,
    started_at,
    metadata
  )
  values (
    p_tenant_id,
    'delete',
    v_actor_id,
    v_actor_role,
    trim(p_reason),
    upper(trim(p_confirmation_text)),
    to_jsonb(v_tenant),
    '{}'::jsonb,
    'started',
    now(),
    jsonb_build_object(
      'expected_confirmation', v_expected_confirmation,
      'batch_key', v_batch_key
    )
  )
  returning id into v_batch_id;

  -- Backup tenant row itself.
  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'tenants',
    format('id = %L::uuid', p_tenant_id)
  );
  v_counts := v_counts || jsonb_build_object('tenants', v_count);

  -- Backup tenant registration archive linked by kode_bumdes.
  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'tenant_registrations',
    format('lower(kode_bumdes) = lower(%L) and lower(nama_bumdes) = lower(%L)', v_tenant.kode_bumdes, v_tenant.nama_bumdes)
  );
  v_counts := v_counts || jsonb_build_object('tenant_registrations', v_count);

  -- Backup direct tenant-owned base tables.
  for v_table in
    select distinct c.table_schema, c.table_name
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and pc.relkind in ('r', 'p')
      and c.table_name not in (
        'tenants',
        'tenant_lifecycle_batches',
        'tenant_lifecycle_backup_rows',
        'erp_tenant_reset_batches',
        'erp_tenant_reset_backup_rows',
        'erp_audit_copy_rows'
      )
    order by c.table_name
  loop
    v_count := public.backup_tenant_lifecycle_table_rows(
      v_batch_id,
      p_tenant_id,
      v_table.table_schema,
      v_table.table_name,
      format('tenant_id = %L::uuid', p_tenant_id)
    );

    if v_count > 0 then
      v_counts := v_counts || jsonb_build_object(v_table.table_name, v_count);
    end if;
  end loop;

  -- Backup important child tables without tenant_id before parent rows are removed.
  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'purchase_invoice_lines',
    format('purchase_invoice_id in (select id from public.purchase_invoices where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('purchase_invoice_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'sales_invoice_lines',
    format('sales_invoice_id in (select id from public.sales_invoices where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('sales_invoice_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'journal_lines',
    format('journal_entry_id in (select id from public.journal_entries where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('journal_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'business_plan_budget_lines',
    format('business_plan_id in (select id from public.business_plans where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('business_plan_budget_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'business_plan_reviews',
    format('business_plan_id in (select id from public.business_plans where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('business_plan_reviews', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'business_plan_status_history',
    format('business_plan_id in (select id from public.business_plans where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('business_plan_status_history', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'capital_expenditure_lines',
    format('capital_expenditure_id in (select id from public.capital_expenditures where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('capital_expenditure_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'inventory_adjustment_lines',
    format('adjustment_id in (select id from public.inventory_adjustments where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('inventory_adjustment_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'journal_correction_notes',
    format('correction_id in (select id from public.journal_corrections where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('journal_correction_notes', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'profit_sharing_allocation_lines',
    format('allocation_id in (select id from public.profit_sharing_allocations where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('profit_sharing_allocation_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(
    v_batch_id,
    p_tenant_id,
    'public',
    'profit_sharing_scheme_lines',
    format('scheme_id in (select id from public.profit_sharing_schemes where tenant_id = %L::uuid)', p_tenant_id)
  );
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('profit_sharing_scheme_lines', v_count); end if;

  -- Unit cutoff child tables that use NO ACTION and do not all carry tenant_id.
  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_asset_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_asset_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_audit_notes', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_audit_notes', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_cash_bank_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_cash_bank_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_equity_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_equity_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_inventory_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_inventory_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_liability_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_liability_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_other_asset_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_other_asset_lines', v_count); end if;

  v_count := public.backup_tenant_lifecycle_table_rows(v_batch_id, p_tenant_id, 'public', 'unit_cutoff_migration_reconciliation_lines', format('cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = %L::uuid)', p_tenant_id));
  if v_count > 0 then v_counts := v_counts || jsonb_build_object('unit_cutoff_migration_reconciliation_lines', v_count); end if;

  -- Remove tenant registration archive linked by kode_bumdes so deleted tenant does not keep appearing in registration archives.
  delete from public.tenant_registrations
  where lower(kode_bumdes) = lower(v_tenant.kode_bumdes)
    and lower(nama_bumdes) = lower(v_tenant.nama_bumdes);

  -- Remove cutoff child tables that can block parent delete.
  delete from public.unit_cutoff_migration_asset_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_audit_notes
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_cash_bank_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_equity_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_inventory_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_liability_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_other_asset_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  delete from public.unit_cutoff_migration_reconciliation_lines
  where cutoff_migration_id in (select id from public.unit_cutoff_migrations where tenant_id = p_tenant_id);

  -- Clear optional references that should not block deletion.
  update public.profiles
  set default_tenant_id = null,
      updated_at = now()
  where default_tenant_id = p_tenant_id;

  update public.user_presence
  set tenant_id = null,
      unit_id = null,
      updated_at = now()
  where tenant_id = p_tenant_id
     or unit_id in (select id from public.business_units where tenant_id = p_tenant_id);

  -- Iteratively delete direct tenant-owned rows. This handles FK ordering by retrying after child tables are removed.
  for v_attempt in 1..30 loop
    v_progress := false;

    for v_table in
      select distinct c.table_schema, c.table_name
      from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
      where c.table_schema = 'public'
        and c.column_name = 'tenant_id'
        and pc.relkind in ('r', 'p')
        and c.table_name not in (
          'tenants',
          'tenant_lifecycle_batches',
          'tenant_lifecycle_backup_rows',
          'erp_tenant_reset_batches',
          'erp_tenant_reset_backup_rows',
          'erp_audit_copy_rows'
        )
      order by c.table_name
    loop
      begin
        execute format('delete from %I.%I where tenant_id = $1', v_table.table_schema, v_table.table_name)
        using p_tenant_id;

        get diagnostics v_count = row_count;

        if v_count > 0 then
          v_progress := true;
        end if;
      exception
        when foreign_key_violation then
          -- Another related table still depends on this table. It will be retried in the next pass.
          null;
      end;
    end loop;

    select count(*)
      into v_remaining
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
      and pc.relkind in ('r', 'p')
      and c.table_name not in (
        'tenants',
        'tenant_lifecycle_batches',
        'tenant_lifecycle_backup_rows',
        'erp_tenant_reset_batches',
        'erp_tenant_reset_backup_rows',
        'erp_audit_copy_rows'
      )
      and exists (
        select 1
        from pg_catalog.pg_attribute a
        where a.attrelid = pc.oid
          and a.attname = 'tenant_id'
          and not a.attisdropped
      );

    -- Actual remaining rows check.
    v_remaining := 0;

    for v_table in
      select distinct c.table_schema, c.table_name
      from information_schema.columns c
      join pg_class pc on pc.relname = c.table_name
      join pg_namespace pn on pn.oid = pc.relnamespace and pn.nspname = c.table_schema
      where c.table_schema = 'public'
        and c.column_name = 'tenant_id'
        and pc.relkind in ('r', 'p')
        and c.table_name not in (
          'tenants',
          'tenant_lifecycle_batches',
          'tenant_lifecycle_backup_rows',
          'erp_tenant_reset_batches',
          'erp_tenant_reset_backup_rows',
          'erp_audit_copy_rows'
        )
    loop
      execute format('select count(*) from %I.%I where tenant_id = $1', v_table.table_schema, v_table.table_name)
      into v_count
      using p_tenant_id;

      v_remaining := v_remaining + v_count;
    end loop;

    exit when v_remaining = 0;

    if not v_progress then
      raise exception 'Hapus tenant tertahan oleh relasi data. Sisa baris tenant_id: %', v_remaining;
    end if;
  end loop;

  if v_remaining <> 0 then
    raise exception 'Hapus tenant belum selesai setelah retry. Sisa baris tenant_id: %', v_remaining;
  end if;

  -- Insert final deletion audit before tenant row is removed.
  insert into public.audit_timeline (
    tenant_id,
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    source_type,
    source_id,
    description,
    metadata
  )
  values (
    p_tenant_id,
    v_actor_id,
    v_actor_role,
    'tenant_delete',
    'tenants',
    p_tenant_id,
    'tenant_lifecycle_batches',
    v_batch_id,
    'Tenant BUMDes dihapus oleh Admin Platform setelah backup audit dibuat.',
    jsonb_build_object(
      'reason', trim(p_reason),
      'confirmation_text', upper(trim(p_confirmation_text)),
      'tenant_snapshot', to_jsonb(v_tenant),
      'affected_counts', v_counts,
      'batch_id', v_batch_id,
      'batch_key', v_batch_key
    )
  );

  -- Backup the audit_timeline row we just created will be retained only through tenant_lifecycle_batches metadata,
  -- because audit_timeline has tenant_id cascade to tenants.
  update public.tenant_lifecycle_batches
  set affected_counts = v_counts,
      status = 'completed',
      finished_at = now(),
      metadata = metadata || jsonb_build_object(
        'completed_at', now(),
        'delete_mode', 'hard_delete_with_audit_backup'
      )
  where id = v_batch_id;

  delete from public.tenants
  where id = p_tenant_id;

  return jsonb_build_object(
    'ok', true,
    'action', 'delete',
    'tenant_id', p_tenant_id,
    'tenant_name', v_tenant.nama_bumdes,
    'kode_bumdes', v_tenant.kode_bumdes,
    'batch_id', v_batch_id,
    'batch_key', v_batch_key,
    'affected_counts', v_counts
  );
exception
  when others then
    if v_batch_id is not null then
      update public.tenant_lifecycle_batches
      set status = 'failed',
          finished_at = now(),
          metadata = metadata || jsonb_build_object(
            'error_message', sqlerrm,
            'failed_at', now()
          )
      where id = v_batch_id;
    end if;

    raise;
end;
$$;

grant execute on function public.delete_tenant_with_audit(uuid, text, text)
  to authenticated;
