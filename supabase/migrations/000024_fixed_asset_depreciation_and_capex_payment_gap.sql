-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 0000181: Fixed Asset Depreciation and Capex Payment Gap
--
-- Purpose:
--   Fresh-install safety patch for objects referenced by later frontend/reporting
--   views but missing from packaged migrations.
--
-- DB-first evidence:
--   Active database contains:
--   - public.fixed_asset_depreciations
--   - public.capital_expenditure_payments
--   - related trigger functions, indexes, triggers, constraints, and grants
--
-- Scope:
--   - Package missing base tables needed by later views
--   - Package missing trigger functions confirmed from active DB
--   - Package indexes/triggers/grants needed for fresh install compatibility
--
-- Non-scope:
--   - No posting RPC changes
--   - No cash-bank/journal logic changes
--   - No seed/demo data
--   - No RLS/policy changes
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Trigger function: capital expenditure payment immutability
-- ----------------------------------------------------------------------------

create or replace function public.prevent_posted_capital_expenditure_payment_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'reversed') then
    raise exception 'posted, cancelled, or reversed capital expenditure payment cannot be deleted'
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

    raise exception 'posted, cancelled, or reversed capital expenditure payment cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ----------------------------------------------------------------------------
-- Trigger function: fixed asset depreciation scope validation
-- ----------------------------------------------------------------------------

create or replace function public.validate_fixed_asset_depreciation_scope()
returns trigger
language plpgsql
as $function$
declare
  v_asset_tenant_id uuid;
  v_asset_unit_id uuid;
  v_period_tenant_id uuid;
  v_period_unit_id uuid;
begin
  select fa.tenant_id, fa.unit_id
  into v_asset_tenant_id, v_asset_unit_id
  from public.fixed_assets fa
  where fa.id = new.fixed_asset_id;

  select ap.tenant_id, ap.unit_id
  into v_period_tenant_id, v_period_unit_id
  from public.accounting_periods ap
  where ap.id = new.period_id;

  if new.tenant_id <> v_asset_tenant_id
    or new.unit_id is distinct from v_asset_unit_id
    or new.tenant_id <> v_period_tenant_id
    or new.unit_id is distinct from v_period_unit_id
  then
    raise exception 'fixed asset depreciation scope does not match asset or period scope'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Trigger function: fixed asset depreciation immutability
-- ----------------------------------------------------------------------------

create or replace function public.prevent_posted_fixed_asset_depreciation_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'reversed') then
    raise exception 'posted or reversed depreciation cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'reversed') then
    raise exception 'posted or reversed depreciation cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ----------------------------------------------------------------------------
-- public.fixed_asset_depreciations
-- ----------------------------------------------------------------------------

create table if not exists public.fixed_asset_depreciations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  fixed_asset_id uuid not null references public.fixed_assets(id) on delete restrict,
  period_id uuid not null references public.accounting_periods(id) on delete restrict,

  depreciation_date date not null,
  depreciation_amount numeric not null,
  accumulated_depreciation_amount numeric not null,
  book_value_after numeric not null,

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'reversed'::text])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fixed_asset_depreciations_unique
    unique (fixed_asset_id, period_id),

  constraint fixed_asset_depreciations_amount_check
    check (
      depreciation_amount >= 0
      and accumulated_depreciation_amount >= 0
      and book_value_after >= 0
    )
);

create index if not exists fixed_asset_depreciations_tenant_idx
  on public.fixed_asset_depreciations (tenant_id);

create index if not exists fixed_asset_depreciations_unit_idx
  on public.fixed_asset_depreciations (unit_id);

create index if not exists fixed_asset_depreciations_asset_idx
  on public.fixed_asset_depreciations (fixed_asset_id);

create index if not exists fixed_asset_depreciations_period_idx
  on public.fixed_asset_depreciations (period_id);

drop trigger if exists trg_fixed_asset_depreciations_set_updated_at
on public.fixed_asset_depreciations;

create trigger trg_fixed_asset_depreciations_set_updated_at
before update on public.fixed_asset_depreciations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_fixed_asset_depreciations_validate_scope
on public.fixed_asset_depreciations;

create trigger trg_fixed_asset_depreciations_validate_scope
before insert or update on public.fixed_asset_depreciations
for each row
execute function public.validate_fixed_asset_depreciation_scope();

drop trigger if exists trg_prevent_posted_fixed_asset_depreciation_mutation
on public.fixed_asset_depreciations;

create trigger trg_prevent_posted_fixed_asset_depreciation_mutation
before update or delete on public.fixed_asset_depreciations
for each row
execute function public.prevent_posted_fixed_asset_depreciation_mutation();

grant select on public.fixed_asset_depreciations to authenticated;

comment on table public.fixed_asset_depreciations is
  'Fresh-install gap table for fixed asset depreciation records, packaged from active DB evidence.';

-- ----------------------------------------------------------------------------
-- public.capital_expenditure_payments
-- ----------------------------------------------------------------------------

create table if not exists public.capital_expenditure_payments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  capital_expenditure_id uuid not null references public.capital_expenditures(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  payment_no text not null,
  payment_date date not null default current_date,

  amount numeric not null default 0,
  notes text,

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'cancelled'::text, 'reversed'::text])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capital_expenditure_payments_scope_no_unique
    unique (tenant_id, unit_id, payment_no),

  constraint capital_expenditure_payments_amount_check
    check (amount >= 0)
);

create index if not exists idx_capital_expenditure_payments_tenant_unit
  on public.capital_expenditure_payments (tenant_id, unit_id);

create index if not exists idx_capital_expenditure_payments_ce_id
  on public.capital_expenditure_payments (capital_expenditure_id);

create index if not exists idx_capital_expenditure_payments_status
  on public.capital_expenditure_payments (status);

drop trigger if exists trg_prevent_posted_capital_expenditure_payment_mutation
on public.capital_expenditure_payments;

create trigger trg_prevent_posted_capital_expenditure_payment_mutation
before update or delete on public.capital_expenditure_payments
for each row
execute function public.prevent_posted_capital_expenditure_payment_mutation();

grant select on public.capital_expenditure_payments to authenticated;

comment on table public.capital_expenditure_payments is
  'Fresh-install gap table for capital expenditure debt payments, packaged from active DB evidence.';
