-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000009_equity_engine.sql
--
-- Scope:
-- - Equity account master
-- - Equity movement ledger
-- - Equity scope validation guards
-- - Posted/cancelled/reversed mutation guard
-- - Unit equity provisioning helper
--
-- Notes:
-- - Fresh-install baseline.
-- - Statement of changes in equity reporting is deferred to reporting migrations.
-- - Master plan capital disbursement/allocation functions are deferred to
--   their own governance/capital module migrations.
-- - Annual closing and profit-sharing functions are deferred.
-- ============================================================

begin;

-- ============================================================
-- 1. EQUITY ACCOUNT MASTER
-- ============================================================

create table if not exists public.equity_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  account_id uuid references public.chart_of_accounts(id) on delete restrict,
  equity_code text not null,
  equity_name text not null,
  equity_type text not null,
  opening_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint equity_accounts_equity_type_check
    check (
      equity_type in (
        'initial_capital',
        'additional_capital',
        'retained_earnings',
        'current_year_surplus',
        'other_equity'
      )
    ),

  constraint equity_accounts_code_not_blank
    check (btrim(equity_code) <> ''),

  constraint equity_accounts_name_not_blank
    check (btrim(equity_name) <> ''),

  constraint equity_accounts_scope_code_unique
    unique nulls not distinct (tenant_id, unit_id, equity_code)
);

create index if not exists equity_accounts_tenant_idx
  on public.equity_accounts(tenant_id);

create index if not exists equity_accounts_unit_idx
  on public.equity_accounts(unit_id);

create index if not exists equity_accounts_account_id_idx
  on public.equity_accounts(account_id);

-- ============================================================
-- 2. EQUITY MOVEMENT LEDGER
-- ============================================================

create table if not exists public.equity_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  equity_account_id uuid not null references public.equity_accounts(id) on delete restrict,
  movement_no text not null,
  movement_date date not null default current_date,
  movement_type text not null,
  amount numeric(18,2) not null,
  description text,
  status text not null default 'draft',
  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint equity_movements_amount_check
    check (amount > 0),

  constraint equity_movements_movement_type_check
    check (
      movement_type in (
        'capital_injection',
        'capital_withdrawal',
        'surplus_allocation',
        'deficit_allocation',
        'opening_balance',
        'adjustment'
      )
    ),

  constraint equity_movements_status_check
    check (status in ('draft', 'posted', 'cancelled', 'reversed')),

  constraint equity_movements_no_not_blank
    check (btrim(movement_no) <> ''),

  constraint equity_movements_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, movement_no)
);

create index if not exists equity_movements_tenant_idx
  on public.equity_movements(tenant_id);

create index if not exists equity_movements_unit_idx
  on public.equity_movements(unit_id);

create index if not exists equity_movements_account_idx
  on public.equity_movements(equity_account_id);

create index if not exists equity_movements_journal_entry_idx
  on public.equity_movements(journal_entry_id);

create index if not exists equity_movements_status_idx
  on public.equity_movements(status);

create index if not exists equity_movements_date_idx
  on public.equity_movements(movement_date);

-- ============================================================
-- 3. SCOPE VALIDATION GUARDS
-- ============================================================

create or replace function public.validate_equity_account_scope()
returns trigger
language plpgsql
as $function$
declare
  v_coa_tenant_id uuid;
  v_coa_unit_id uuid;
begin
  if new.account_id is not null then
    select coa.tenant_id, coa.unit_id
    into v_coa_tenant_id, v_coa_unit_id
    from public.chart_of_accounts coa
    where coa.id = new.account_id;

    if v_coa_tenant_id is null then
      raise exception 'chart of account not found'
        using errcode = '23503';
    end if;

    if new.tenant_id <> v_coa_tenant_id
      or new.unit_id is distinct from v_coa_unit_id
    then
      raise exception 'equity account scope does not match chart of account scope'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.validate_equity_movement_scope()
returns trigger
language plpgsql
as $function$
declare
  v_equity_tenant_id uuid;
  v_equity_unit_id uuid;
begin
  select ea.tenant_id, ea.unit_id
  into v_equity_tenant_id, v_equity_unit_id
  from public.equity_accounts ea
  where ea.id = new.equity_account_id;

  if v_equity_tenant_id is null then
    raise exception 'equity account not found'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_equity_tenant_id
    or new.unit_id is distinct from v_equity_unit_id
  then
    raise exception 'equity movement scope does not match equity account scope'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_posted_equity_movement_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'reversed') then
    raise exception 'posted, cancelled, or reversed equity movement cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled', 'reversed') then
    if new.status <> old.status
      or new.cancelled_at is distinct from old.cancelled_at
      or new.cancelled_by is distinct from old.cancelled_by
      or new.cancellation_reason is distinct from old.cancellation_reason
    then
      return new;
    end if;

    raise exception 'posted, cancelled, or reversed equity movement cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

drop trigger if exists trg_equity_accounts_set_updated_at on public.equity_accounts;
create trigger trg_equity_accounts_set_updated_at
before update on public.equity_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_equity_accounts_validate_scope on public.equity_accounts;
create trigger trg_equity_accounts_validate_scope
before insert or update on public.equity_accounts
for each row
execute function public.validate_equity_account_scope();

drop trigger if exists trg_equity_movements_set_updated_at on public.equity_movements;
create trigger trg_equity_movements_set_updated_at
before update on public.equity_movements
for each row
execute function public.set_updated_at();

drop trigger if exists trg_equity_movements_validate_scope on public.equity_movements;
create trigger trg_equity_movements_validate_scope
before insert or update on public.equity_movements
for each row
execute function public.validate_equity_movement_scope();

drop trigger if exists trg_prevent_posted_equity_movement_mutation on public.equity_movements;
create trigger trg_prevent_posted_equity_movement_mutation
before update or delete on public.equity_movements
for each row
execute function public.prevent_posted_equity_movement_mutation();

-- ============================================================
-- 5. UNIT EQUITY PROVISIONING
-- ============================================================

create or replace function public.provision_unit_equity_accounts(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_created_by uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_created_count integer := 0;
  v_row_count integer := 0;
  v_unit record;
  v_modal_account_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  select
    bu.id,
    bu.tenant_id,
    bu.kode_unit,
    bu.nama_unit,
    bu.jenis_unit,
    bu.template_id
  into v_unit
  from public.business_units bu
  where bu.id = p_unit_id
    and bu.tenant_id = p_tenant_id
    and bu.status = 'aktif';

  if v_unit.id is null then
    raise exception 'Unit tidak ditemukan atau tidak aktif';
  end if;

  select coa.id
  into v_modal_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.kode = '3100'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_modal_account_id is null then
    raise exception 'COA 3100 - Modal BUMDes belum tersedia untuk unit ini';
  end if;

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
  values (
    p_tenant_id,
    p_unit_id,
    v_modal_account_id,
    'MODAL-AWAL-UNIT-' || upper(trim(v_unit.kode_unit)),
    'Penyertaan Modal Awal Unit ' || trim(v_unit.nama_unit),
    'initial_capital',
    0,
    true,
    p_created_by
  )
  on conflict on constraint equity_accounts_scope_code_unique do nothing;

  get diagnostics v_row_count = row_count;
  v_created_count := v_created_count + v_row_count;

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
  values (
    p_tenant_id,
    p_unit_id,
    v_modal_account_id,
    'MODAL-TAMBAHAN-UNIT-' || upper(trim(v_unit.kode_unit)),
    'Penyertaan Modal Tambahan Unit ' || trim(v_unit.nama_unit),
    'additional_capital',
    0,
    true,
    p_created_by
  )
  on conflict on constraint equity_accounts_scope_code_unique do nothing;

  get diagnostics v_row_count = row_count;
  v_created_count := v_created_count + v_row_count;

  return v_created_count;
end;
$function$;

-- ============================================================
-- 6. GRANTS
-- ============================================================

grant select, insert, update on public.equity_accounts
  to authenticated, service_role;

grant select, insert, update on public.equity_movements
  to authenticated, service_role;

grant execute on function public.provision_unit_equity_accounts(uuid, uuid, uuid)
  to authenticated, service_role;

commit;
