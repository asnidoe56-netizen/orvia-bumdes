-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000022: Business Plan / Master Plan Capital Governance Engine
--
-- Scope:
--   - Business plan / proposal modal
--   - RAB / budget lines
--   - Pendamping Kecamatan review
--   - Village submission and decision
--   - Capital disbursement to BUMDes center
--   - Capital allocation from BUMDes center to business unit
--   - Status history and audit timeline integration
--
-- Depends on:
--   - 000003 Auth / Roles / Permissions
--   - 000005 Chart of Accounts Engine
--   - 000007 Audit Timeline Engine
--   - 000008 Cash Bank Engine
--   - 000009 Equity Engine
--   - 000010 Business Unit Provisioning Engine
--
-- Status:
--   PART_1_SCHEMA_CREATED
-- ============================================================================

-- ============================================================================
-- 1. Enum safety blocks
-- ============================================================================

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'business_plan_status'
  ) then
    create type public.business_plan_status as enum (
      'draft',
      'submitted_to_facilitator',
      'under_facilitator_review',
      'needs_revision',
      'ready_for_village_submission',
      'submitted_to_village',
      'approved_by_village',
      'rejected_by_village',
      'disbursed',
      'allocated_to_unit',
      'closed',
      'cancelled'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'business_plan_review_result'
  ) then
    create type public.business_plan_review_result as enum (
      'ready_for_village_submission',
      'needs_revision',
      'not_feasible'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'capital_disbursement_status'
  ) then
    create type public.capital_disbursement_status as enum (
      'draft',
      'posted',
      'cancelled',
      'reversed'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'unit_capital_allocation_status'
  ) then
    create type public.unit_capital_allocation_status as enum (
      'draft',
      'posted',
      'cancelled',
      'reversed'
    );
  end if;
end;
$$;

-- ============================================================================
-- 2. Business plans / proposal modal
-- ============================================================================

create table if not exists public.business_plans (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proposed_unit_id uuid references public.business_units(id) on delete set null,

  plan_no text not null,
  title text not null,
  business_type text not null,

  background text,
  objectives text,
  market_analysis text,
  operational_plan text,
  risk_analysis text,
  expected_benefits text,

  requested_capital_amount numeric(18,2) not null default 0,
  approved_capital_amount numeric(18,2) not null default 0,
  disbursed_capital_amount numeric(18,2) not null default 0,
  allocated_capital_amount numeric(18,2) not null default 0,

  status public.business_plan_status not null default 'draft',

  submitted_to_facilitator_at timestamptz,
  facilitator_reviewed_at timestamptz,
  submitted_to_village_at timestamptz,
  village_decision_at timestamptz,
  disbursed_at timestamptz,
  allocated_to_unit_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,

  created_by uuid not null references auth.users(id) on delete restrict,
  updated_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  facilitator_reviewed_by uuid references auth.users(id) on delete set null,
  village_decision_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  cancelled_by uuid references auth.users(id) on delete set null,

  village_decision_notes text,
  cancellation_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_plans_plan_no_check
    check (nullif(trim(plan_no), '') is not null),

  constraint business_plans_title_check
    check (nullif(trim(title), '') is not null),

  constraint business_plans_business_type_check
    check (nullif(trim(business_type), '') is not null),

  constraint business_plans_amount_nonnegative_check
    check (
      requested_capital_amount >= 0
      and approved_capital_amount >= 0
      and disbursed_capital_amount >= 0
      and allocated_capital_amount >= 0
    ),

  constraint business_plans_approved_not_exceed_requested_check
    check (approved_capital_amount <= requested_capital_amount),

  constraint business_plans_disbursed_not_exceed_approved_check
    check (disbursed_capital_amount <= approved_capital_amount),

  constraint business_plans_allocated_not_exceed_disbursed_check
    check (allocated_capital_amount <= disbursed_capital_amount),

  constraint business_plans_scope_no_unique
    unique (tenant_id, plan_no)
);

create index if not exists business_plans_tenant_idx
  on public.business_plans (tenant_id);

create index if not exists business_plans_proposed_unit_idx
  on public.business_plans (proposed_unit_id);

create index if not exists business_plans_status_idx
  on public.business_plans (status);

create index if not exists business_plans_created_at_idx
  on public.business_plans (created_at desc);

-- ============================================================================
-- 3. Business plan budget / RAB lines
-- ============================================================================

create table if not exists public.business_plan_budget_lines (
  id uuid primary key default gen_random_uuid(),

  business_plan_id uuid not null references public.business_plans(id) on delete cascade,

  line_no integer not null,
  category text not null,
  description text not null,
  quantity numeric(18,2) not null default 1,
  unit_of_measure text not null default 'unit',
  unit_cost numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint business_plan_budget_lines_unique
    unique (business_plan_id, line_no),

  constraint business_plan_budget_lines_category_check
    check (nullif(trim(category), '') is not null),

  constraint business_plan_budget_lines_description_check
    check (nullif(trim(description), '') is not null),

  constraint business_plan_budget_lines_quantity_check
    check (quantity > 0),

  constraint business_plan_budget_lines_cost_check
    check (unit_cost >= 0 and total_amount >= 0)
);

create index if not exists business_plan_budget_lines_plan_idx
  on public.business_plan_budget_lines (business_plan_id);

-- ============================================================================
-- 4. Pendamping Kecamatan reviews
-- ============================================================================

create table if not exists public.business_plan_reviews (
  id uuid primary key default gen_random_uuid(),

  business_plan_id uuid not null references public.business_plans(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete restrict,

  review_result public.business_plan_review_result not null,

  feasibility_notes text not null,
  budget_notes text,
  risk_notes text,
  recommendation_notes text,

  reviewed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint business_plan_reviews_notes_check
    check (nullif(trim(feasibility_notes), '') is not null)
);

create index if not exists business_plan_reviews_plan_idx
  on public.business_plan_reviews (business_plan_id);

create index if not exists business_plan_reviews_reviewer_idx
  on public.business_plan_reviews (reviewer_id);

create index if not exists business_plan_reviews_reviewed_at_idx
  on public.business_plan_reviews (reviewed_at desc);

-- ============================================================================
-- 5. Business plan status history
-- ============================================================================

create table if not exists public.business_plan_status_history (
  id uuid primary key default gen_random_uuid(),

  business_plan_id uuid not null references public.business_plans(id) on delete cascade,

  old_status public.business_plan_status,
  new_status public.business_plan_status not null,

  actor_id uuid not null references auth.users(id) on delete restrict,
  actor_role public.app_role not null,

  action_type text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint business_plan_status_history_action_type_check
    check (nullif(trim(action_type), '') is not null)
);

create index if not exists business_plan_status_history_plan_idx
  on public.business_plan_status_history (business_plan_id);

create index if not exists business_plan_status_history_created_at_idx
  on public.business_plan_status_history (created_at desc);

-- ============================================================================
-- 6. Capital disbursements to BUMDes center
-- ============================================================================

create table if not exists public.capital_disbursements (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  business_plan_id uuid not null references public.business_plans(id) on delete restrict,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  disbursement_no text not null,
  disbursement_date date not null default current_date,

  amount numeric(18,2) not null,

  source_document_no text,
  source_document_date date,
  description text,

  status public.capital_disbursement_status not null default 'draft',

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capital_disbursements_no_check
    check (nullif(trim(disbursement_no), '') is not null),

  constraint capital_disbursements_amount_check
    check (amount > 0),

  constraint capital_disbursements_scope_no_unique
    unique (tenant_id, disbursement_no)
);

create index if not exists capital_disbursements_tenant_idx
  on public.capital_disbursements (tenant_id);

create index if not exists capital_disbursements_plan_idx
  on public.capital_disbursements (business_plan_id);

create index if not exists capital_disbursements_status_idx
  on public.capital_disbursements (status);

-- ============================================================================
-- 7. Unit capital allocations
-- ============================================================================

create table if not exists public.unit_capital_allocations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  business_plan_id uuid not null references public.business_plans(id) on delete restrict,
  capital_disbursement_id uuid references public.capital_disbursements(id) on delete restrict,

  source_cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,
  target_cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  allocation_no text not null,
  allocation_date date not null default current_date,

  amount numeric(18,2) not null,
  description text,

  status public.unit_capital_allocation_status not null default 'draft',

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  source_journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  target_journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  source_cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,
  target_cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  target_equity_movement_id uuid references public.equity_movements(id) on delete restrict,
  source_equity_movement_id uuid references public.equity_movements(id) on delete restrict,

  constraint unit_capital_allocations_no_check
    check (nullif(trim(allocation_no), '') is not null),

  constraint unit_capital_allocations_amount_check
    check (amount > 0),

  constraint unit_capital_allocations_scope_no_unique
    unique (tenant_id, unit_id, allocation_no)
);

create index if not exists unit_capital_allocations_tenant_idx
  on public.unit_capital_allocations (tenant_id);

create index if not exists unit_capital_allocations_unit_idx
  on public.unit_capital_allocations (unit_id);

create index if not exists unit_capital_allocations_plan_idx
  on public.unit_capital_allocations (business_plan_id);

create index if not exists unit_capital_allocations_disbursement_idx
  on public.unit_capital_allocations (capital_disbursement_id);

create index if not exists unit_capital_allocations_status_idx
  on public.unit_capital_allocations (status);

-- ============================================================================
-- 8. Grants and comments
-- ============================================================================

grant select on public.business_plans to authenticated;
grant select on public.business_plan_budget_lines to authenticated;
grant select on public.business_plan_reviews to authenticated;
grant select on public.business_plan_status_history to authenticated;
grant select on public.capital_disbursements to authenticated;
grant select on public.unit_capital_allocations to authenticated;

comment on table public.business_plans is
'Business Plan / Master Plan proposal for BUMDes capital governance.';

comment on table public.business_plan_budget_lines is
'RAB / budget lines for Business Plan capital proposal.';

comment on table public.business_plan_reviews is
'Pendamping Kecamatan review and feasibility assessment for Business Plan proposal.';

comment on table public.business_plan_status_history is
'Auditable status transition history for Business Plan governance flow.';

comment on table public.capital_disbursements is
'Capital disbursement from village approval into BUMDes center cash-bank and equity.';

comment on table public.unit_capital_allocations is
'Capital allocation from BUMDes center to a business unit, including source and target accounting evidence.';

-- ============================================================================
-- 9. Trigger helper: validate business plan scope
-- ============================================================================

create or replace function public.validate_business_plan_scope()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.proposed_unit_id is not null then
    if public.unit_tenant_id(new.proposed_unit_id) is distinct from new.tenant_id then
      raise exception 'Unit tujuan proposal tidak sesuai dengan tenant'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 10. Trigger helper: calculate and refresh budget totals
-- ============================================================================

create or replace function public.calculate_business_plan_budget_line_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.total_amount := coalesce(new.quantity, 0) * coalesce(new.unit_cost, 0);
  return new;
end;
$$;

create or replace function public.refresh_business_plan_requested_capital_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business_plan_id uuid;
begin
  v_business_plan_id := coalesce(new.business_plan_id, old.business_plan_id);

  update public.business_plans bp
  set
    requested_capital_amount = coalesce((
      select sum(bpl.total_amount)
      from public.business_plan_budget_lines bpl
      where bpl.business_plan_id = v_business_plan_id
    ), 0),
    updated_at = now()
  where bp.id = v_business_plan_id;

  return null;
end;
$$;

-- ============================================================================
-- 11. Trigger helper: validate budget line scope
-- ============================================================================

create or replace function public.validate_business_plan_budget_line_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  v_plan_id := coalesce(new.business_plan_id, old.business_plan_id);

  if not exists (
    select 1
    from public.business_plans bp
    where bp.id = v_plan_id
  ) then
    raise exception 'Business plan tidak ditemukan'
      using errcode = '23503';
  end if;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 12. Trigger helper: validate capital disbursement scope
-- ============================================================================

create or replace function public.validate_capital_disbursement_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_tenant_id uuid;
  v_cash_tenant_id uuid;
  v_cash_unit_id uuid;
begin
  select bp.tenant_id
  into v_plan_tenant_id
  from public.business_plans bp
  where bp.id = new.business_plan_id;

  if v_plan_tenant_id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_plan_tenant_id then
    raise exception 'Scope pencairan modal tidak sesuai dengan tenant proposal'
      using errcode = '23514';
  end if;

  select cba.tenant_id, cba.unit_id
  into v_cash_tenant_id, v_cash_unit_id
  from public.cash_bank_accounts cba
  where cba.id = new.cash_bank_account_id
    and cba.is_active = true;

  if v_cash_tenant_id is null then
    raise exception 'Akun kas/bank pencairan tidak ditemukan atau tidak aktif'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_cash_tenant_id
     or v_cash_unit_id is not null then
    raise exception 'Akun kas/bank pencairan harus milik pusat BUMDes pada tenant yang sama'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 13. Trigger helper: validate unit capital allocation scope
-- ============================================================================

create or replace function public.validate_unit_capital_allocation_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_plan_tenant_id uuid;
  v_plan_unit_id uuid;
  v_disbursement_tenant_id uuid;
  v_disbursement_plan_id uuid;

  v_source_tenant_id uuid;
  v_source_unit_id uuid;
  v_target_tenant_id uuid;
  v_target_unit_id uuid;
begin
  select bp.tenant_id, bp.proposed_unit_id
  into v_plan_tenant_id, v_plan_unit_id
  from public.business_plans bp
  where bp.id = new.business_plan_id;

  if v_plan_tenant_id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_plan_tenant_id then
    raise exception 'Scope alokasi modal tidak sesuai dengan tenant proposal'
      using errcode = '23514';
  end if;

  if v_plan_unit_id is not null and new.unit_id is distinct from v_plan_unit_id then
    raise exception 'Unit tujuan alokasi tidak sesuai dengan unit tujuan proposal'
      using errcode = '23514';
  end if;

  if public.unit_tenant_id(new.unit_id) is distinct from new.tenant_id then
    raise exception 'Unit tujuan alokasi tidak sesuai tenant'
      using errcode = '23514';
  end if;

  if new.capital_disbursement_id is not null then
    select cd.tenant_id, cd.business_plan_id
    into v_disbursement_tenant_id, v_disbursement_plan_id
    from public.capital_disbursements cd
    where cd.id = new.capital_disbursement_id;

    if v_disbursement_tenant_id is null then
      raise exception 'Pencairan modal tidak ditemukan'
        using errcode = '23503';
    end if;

    if v_disbursement_tenant_id <> new.tenant_id
       or v_disbursement_plan_id <> new.business_plan_id then
      raise exception 'Pencairan modal tidak sesuai dengan proposal/alokasi'
        using errcode = '23514';
    end if;
  end if;

  select cba.tenant_id, cba.unit_id
  into v_source_tenant_id, v_source_unit_id
  from public.cash_bank_accounts cba
  where cba.id = new.source_cash_bank_account_id
    and cba.is_active = true;

  if v_source_tenant_id is null then
    raise exception 'Akun kas/bank sumber pusat tidak ditemukan atau tidak aktif'
      using errcode = '23503';
  end if;

  if v_source_tenant_id <> new.tenant_id or v_source_unit_id is not null then
    raise exception 'Akun kas/bank sumber harus milik pusat BUMDes pada tenant yang sama'
      using errcode = '23514';
  end if;

  select cba.tenant_id, cba.unit_id
  into v_target_tenant_id, v_target_unit_id
  from public.cash_bank_accounts cba
  where cba.id = new.target_cash_bank_account_id
    and cba.is_active = true;

  if v_target_tenant_id is null then
    raise exception 'Akun kas/bank tujuan unit tidak ditemukan atau tidak aktif'
      using errcode = '23503';
  end if;

  if v_target_tenant_id <> new.tenant_id or v_target_unit_id is distinct from new.unit_id then
    raise exception 'Akun kas/bank tujuan harus milik unit tujuan pada tenant yang sama'
      using errcode = '23514';
  end if;

  if new.source_cash_bank_account_id = new.target_cash_bank_account_id then
    raise exception 'Akun kas/bank sumber dan tujuan tidak boleh sama'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 14. Trigger helper: posted immutability protections
-- ============================================================================

create or replace function public.prevent_posted_capital_disbursement_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'posted' then
    if tg_op = 'DELETE' then
      raise exception 'Pencairan modal yang sudah posted tidak boleh dihapus';
    end if;

    if new.status = 'posted'
       and (
         new.tenant_id is distinct from old.tenant_id
         or new.business_plan_id is distinct from old.business_plan_id
         or new.cash_bank_account_id is distinct from old.cash_bank_account_id
         or new.disbursement_no is distinct from old.disbursement_no
         or new.disbursement_date is distinct from old.disbursement_date
         or new.amount is distinct from old.amount
         or new.journal_entry_id is distinct from old.journal_entry_id
       ) then
      raise exception 'Pencairan modal yang sudah posted tidak boleh diubah. Gunakan mekanisme pembatalan/reversal.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.prevent_posted_unit_capital_allocation_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.status = 'posted' then
    if tg_op = 'DELETE' then
      raise exception 'Alokasi modal unit yang sudah posted tidak boleh dihapus';
    end if;

    if new.status = 'posted'
       and (
         new.tenant_id is distinct from old.tenant_id
         or new.unit_id is distinct from old.unit_id
         or new.business_plan_id is distinct from old.business_plan_id
         or new.capital_disbursement_id is distinct from old.capital_disbursement_id
         or new.source_cash_bank_account_id is distinct from old.source_cash_bank_account_id
         or new.target_cash_bank_account_id is distinct from old.target_cash_bank_account_id
         or new.allocation_no is distinct from old.allocation_no
         or new.allocation_date is distinct from old.allocation_date
         or new.amount is distinct from old.amount
         or new.journal_entry_id is distinct from old.journal_entry_id
       ) then
      raise exception 'Alokasi modal unit yang sudah posted tidak boleh diubah. Gunakan mekanisme pembatalan/reversal.';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- ============================================================================
-- 15. Trigger binding
-- ============================================================================

drop trigger if exists trg_business_plans_set_updated_at
on public.business_plans;

create trigger trg_business_plans_set_updated_at
before update on public.business_plans
for each row
execute function public.set_updated_at();

drop trigger if exists trg_business_plans_validate_scope
on public.business_plans;

create trigger trg_business_plans_validate_scope
before insert or update on public.business_plans
for each row
execute function public.validate_business_plan_scope();

drop trigger if exists trg_business_plan_budget_lines_set_updated_at
on public.business_plan_budget_lines;

create trigger trg_business_plan_budget_lines_set_updated_at
before update on public.business_plan_budget_lines
for each row
execute function public.set_updated_at();

drop trigger if exists trg_business_plan_budget_lines_calculate_total
on public.business_plan_budget_lines;

create trigger trg_business_plan_budget_lines_calculate_total
before insert or update on public.business_plan_budget_lines
for each row
execute function public.calculate_business_plan_budget_line_total();

drop trigger if exists trg_business_plan_budget_lines_validate_scope
on public.business_plan_budget_lines;

create trigger trg_business_plan_budget_lines_validate_scope
before insert or update on public.business_plan_budget_lines
for each row
execute function public.validate_business_plan_budget_line_scope();

drop trigger if exists trg_business_plan_budget_lines_refresh_total_insert
on public.business_plan_budget_lines;

drop trigger if exists trg_business_plan_budget_lines_refresh_total_update
on public.business_plan_budget_lines;

drop trigger if exists trg_business_plan_budget_lines_refresh_total_delete
on public.business_plan_budget_lines;

create trigger trg_business_plan_budget_lines_refresh_total_insert
after insert on public.business_plan_budget_lines
for each row
execute function public.refresh_business_plan_requested_capital_amount();

create trigger trg_business_plan_budget_lines_refresh_total_update
after update on public.business_plan_budget_lines
for each row
execute function public.refresh_business_plan_requested_capital_amount();

create trigger trg_business_plan_budget_lines_refresh_total_delete
after delete on public.business_plan_budget_lines
for each row
execute function public.refresh_business_plan_requested_capital_amount();

drop trigger if exists trg_capital_disbursements_set_updated_at
on public.capital_disbursements;

create trigger trg_capital_disbursements_set_updated_at
before update on public.capital_disbursements
for each row
execute function public.set_updated_at();

drop trigger if exists trg_capital_disbursements_validate_scope
on public.capital_disbursements;

create trigger trg_capital_disbursements_validate_scope
before insert or update on public.capital_disbursements
for each row
execute function public.validate_capital_disbursement_scope();

drop trigger if exists trg_prevent_posted_capital_disbursement_mutation
on public.capital_disbursements;

create trigger trg_prevent_posted_capital_disbursement_mutation
before update or delete on public.capital_disbursements
for each row
execute function public.prevent_posted_capital_disbursement_mutation();

drop trigger if exists trg_unit_capital_allocations_set_updated_at
on public.unit_capital_allocations;

create trigger trg_unit_capital_allocations_set_updated_at
before update on public.unit_capital_allocations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_unit_capital_allocations_validate_scope
on public.unit_capital_allocations;

create trigger trg_unit_capital_allocations_validate_scope
before insert or update on public.unit_capital_allocations
for each row
execute function public.validate_unit_capital_allocation_scope();

drop trigger if exists trg_prevent_posted_unit_capital_allocation_mutation
on public.unit_capital_allocations;

create trigger trg_prevent_posted_unit_capital_allocation_mutation
before update or delete on public.unit_capital_allocations
for each row
execute function public.prevent_posted_unit_capital_allocation_mutation();

-- ============================================================================
-- 16. RPC: create business plan draft with RAB
-- ============================================================================

create or replace function public.create_business_plan(
  p_tenant_id uuid,
  p_proposed_unit_id uuid,
  p_plan_no text,
  p_title text,
  p_business_type text,
  p_background text default null,
  p_objectives text default null,
  p_market_analysis text default null,
  p_operational_plan text default null,
  p_risk_analysis text default null,
  p_expected_benefits text default null,
  p_budget_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_business_plan_id uuid;
  v_line jsonb;
  v_line_no integer := 0;
  v_category text;
  v_description text;
  v_quantity numeric(18,2);
  v_unit_of_measure text;
  v_unit_cost numeric(18,2);
  v_notes text;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  perform public.assert_user_has_permission(
    'business_plan.create',
    v_actor_id,
    p_tenant_id,
    null
  );

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = p_tenant_id
        and ur.unit_id is null
      )
    )
  order by
    case ur.role
      when 'super_admin_platform' then 1
      when 'direktur_bumdes' then 2
      when 'admin_bumdes' then 3
      else 9
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user untuk membuat perencanaan usaha tidak ditemukan';
  end if;

  if nullif(trim(p_plan_no), '') is null then
    raise exception 'Nomor proposal/perencanaan wajib diisi';
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Judul proposal/perencanaan wajib diisi';
  end if;

  if nullif(trim(p_business_type), '') is null then
    raise exception 'Jenis usaha wajib diisi';
  end if;

  if p_proposed_unit_id is not null then
    if public.unit_tenant_id(p_proposed_unit_id) is distinct from p_tenant_id then
      raise exception 'Unit tujuan proposal tidak sesuai dengan tenant';
    end if;
  end if;

  if p_budget_lines is null then
    p_budget_lines := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_budget_lines) <> 'array' then
    raise exception 'RAB harus berupa array JSON';
  end if;

  insert into public.business_plans (
    tenant_id,
    proposed_unit_id,
    plan_no,
    title,
    business_type,
    background,
    objectives,
    market_analysis,
    operational_plan,
    risk_analysis,
    expected_benefits,
    status,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_proposed_unit_id,
    upper(trim(p_plan_no)),
    trim(p_title),
    trim(p_business_type),
    nullif(trim(coalesce(p_background, '')), ''),
    nullif(trim(coalesce(p_objectives, '')), ''),
    nullif(trim(coalesce(p_market_analysis, '')), ''),
    nullif(trim(coalesce(p_operational_plan, '')), ''),
    nullif(trim(coalesce(p_risk_analysis, '')), ''),
    nullif(trim(coalesce(p_expected_benefits, '')), ''),
    'draft',
    v_actor_id,
    v_actor_id
  )
  returning id into v_business_plan_id;

  for v_line in
    select value
    from jsonb_array_elements(p_budget_lines)
  loop
    v_line_no := v_line_no + 1;

    v_category := nullif(trim(coalesce(v_line->>'category', '')), '');
    v_description := nullif(trim(coalesce(v_line->>'description', '')), '');
    v_quantity := coalesce(nullif(v_line->>'quantity', '')::numeric, 0);
    v_unit_of_measure := coalesce(nullif(trim(coalesce(v_line->>'unit_of_measure', '')), ''), 'unit');
    v_unit_cost := coalesce(nullif(v_line->>'unit_cost', '')::numeric, 0);
    v_notes := nullif(trim(coalesce(v_line->>'notes', '')), '');

    if v_category is null then
      raise exception 'Kategori RAB baris % wajib diisi', v_line_no;
    end if;

    if v_description is null then
      raise exception 'Uraian RAB baris % wajib diisi', v_line_no;
    end if;

    if v_quantity <= 0 then
      raise exception 'Jumlah RAB baris % harus lebih dari 0', v_line_no;
    end if;

    if v_unit_cost < 0 then
      raise exception 'Harga satuan RAB baris % tidak boleh negatif', v_line_no;
    end if;

    insert into public.business_plan_budget_lines (
      business_plan_id,
      line_no,
      category,
      description,
      quantity,
      unit_of_measure,
      unit_cost,
      notes
    )
    values (
      v_business_plan_id,
      v_line_no,
      v_category,
      v_description,
      v_quantity,
      v_unit_of_measure,
      v_unit_cost,
      v_notes
    );
  end loop;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_business_plan_id,
    null,
    'draft',
    v_actor_id,
    v_actor_role,
    'business_plan_created',
    'Draft perencanaan usaha dibuat.',
    jsonb_build_object(
      'plan_no', upper(trim(p_plan_no)),
      'title', trim(p_title),
      'business_type', trim(p_business_type),
      'budget_line_count', v_line_no
    )
  );

  perform public.log_audit_event(
    p_tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'business_plan_created',
    'business_plans',
    v_business_plan_id,
    'business_plan_governance',
    v_business_plan_id,
    'Draft perencanaan usaha/proposal dibuat.',
    jsonb_build_object(
      'plan_no', upper(trim(p_plan_no)),
      'title', trim(p_title),
      'business_type', trim(p_business_type),
      'budget_line_count', v_line_no
    )
  );

  return v_business_plan_id;
end;
$$;

-- ============================================================================
-- 17. RPC: submit business plan to facilitator
-- ============================================================================

create or replace function public.submit_business_plan_to_facilitator(
  p_business_plan_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_plan record;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'business_plan.submit',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  if v_plan.status not in ('draft', 'needs_revision') then
    raise exception 'Proposal hanya bisa diajukan ke pendamping dari status draft/perlu revisi. Status saat ini: %', v_plan.status;
  end if;

  if coalesce(v_plan.requested_capital_amount, 0) <= 0 then
    raise exception 'RAB proposal belum memiliki total kebutuhan modal';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = v_plan.tenant_id
        and ur.unit_id is null
      )
    )
  order by
    case ur.role
      when 'super_admin_platform' then 1
      when 'direktur_bumdes' then 2
      when 'admin_bumdes' then 3
      else 9
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user untuk mengajukan proposal tidak ditemukan';
  end if;

  update public.business_plans
  set
    status = 'submitted_to_facilitator',
    submitted_to_facilitator_at = now(),
    submitted_by = v_actor_id,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_plan.id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_plan.id,
    v_plan.status,
    'submitted_to_facilitator',
    v_actor_id,
    v_actor_role,
    'business_plan_submitted_to_facilitator',
    nullif(trim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'requested_capital_amount', v_plan.requested_capital_amount
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'business_plan_submitted_to_facilitator',
    'business_plans',
    v_plan.id,
    'business_plan_governance',
    v_plan.id,
    'Proposal/perencanaan usaha diajukan ke Pendamping Kecamatan.',
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'requested_capital_amount', v_plan.requested_capital_amount
    )
  );

  return v_plan.id;
end;
$$;

-- ============================================================================
-- 18. RPC: review business plan by Pendamping Kecamatan
-- ============================================================================

create or replace function public.review_business_plan(
  p_business_plan_id uuid,
  p_review_result public.business_plan_review_result,
  p_feasibility_notes text,
  p_budget_notes text default null,
  p_risk_notes text default null,
  p_recommendation_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_plan record;
  v_new_status public.business_plan_status;
  v_review_id uuid;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  if p_review_result is null then
    raise exception 'Hasil review wajib diisi';
  end if;

  if nullif(trim(coalesce(p_feasibility_notes, '')), '') is null then
    raise exception 'Catatan kelayakan wajib diisi oleh Pendamping Kecamatan';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'business_plan.review',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  if not public.can_pendamping_kecamatan_access_tenant(v_plan.tenant_id, v_actor_id) then
    raise exception 'Pendamping Kecamatan tidak memiliki akses wilayah untuk mereview proposal tenant ini';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and ur.role in ('super_admin_platform', 'pendamping_kecamatan')
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.role = 'pendamping_kecamatan'
        and ur.tenant_id is null
        and ur.unit_id is null
      )
    )
  order by
    case ur.role
      when 'super_admin_platform' then 1
      when 'pendamping_kecamatan' then 2
      else 9
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role Pendamping Kecamatan tidak ditemukan';
  end if;

  if v_plan.status not in ('submitted_to_facilitator', 'under_facilitator_review') then
    raise exception 'Proposal hanya bisa direview dari status menunggu/sedang review pendamping. Status saat ini: %', v_plan.status;
  end if;

  if p_review_result = 'ready_for_village_submission' then
    v_new_status := 'ready_for_village_submission';
  elsif p_review_result = 'needs_revision' then
    v_new_status := 'needs_revision';
  else
    v_new_status := 'needs_revision';
  end if;

  insert into public.business_plan_reviews (
    business_plan_id,
    reviewer_id,
    review_result,
    feasibility_notes,
    budget_notes,
    risk_notes,
    recommendation_notes
  )
  values (
    v_plan.id,
    v_actor_id,
    p_review_result,
    trim(p_feasibility_notes),
    nullif(trim(coalesce(p_budget_notes, '')), ''),
    nullif(trim(coalesce(p_risk_notes, '')), ''),
    nullif(trim(coalesce(p_recommendation_notes, '')), '')
  )
  returning id into v_review_id;

  update public.business_plans
  set
    status = v_new_status,
    facilitator_reviewed_at = now(),
    facilitator_reviewed_by = v_actor_id,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_plan.id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_plan.id,
    v_plan.status,
    v_new_status,
    v_actor_id,
    v_actor_role,
    'business_plan_facilitator_reviewed',
    trim(p_feasibility_notes),
    jsonb_build_object(
      'review_id', v_review_id,
      'review_result', p_review_result,
      'plan_no', v_plan.plan_no,
      'title', v_plan.title
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'business_plan_facilitator_reviewed',
    'business_plans',
    v_plan.id,
    'business_plan_governance',
    v_plan.id,
    'Proposal/perencanaan usaha direview oleh Pendamping Kecamatan.',
    jsonb_build_object(
      'review_id', v_review_id,
      'review_result', p_review_result,
      'old_status', v_plan.status,
      'new_status', v_new_status,
      'plan_no', v_plan.plan_no
    )
  );

  return v_review_id;
end;
$$;

-- ============================================================================
-- 19. RPC: submit reviewed business plan to village
-- ============================================================================

create or replace function public.submit_business_plan_to_village(
  p_business_plan_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_plan record;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'business_plan.submit',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  if v_plan.status <> 'ready_for_village_submission' then
    raise exception 'Proposal hanya bisa diajukan ke desa setelah dinyatakan siap oleh pendamping. Status saat ini: %', v_plan.status;
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = v_plan.tenant_id
        and ur.unit_id is null
      )
    )
  order by
    case ur.role
      when 'super_admin_platform' then 1
      when 'direktur_bumdes' then 2
      when 'admin_bumdes' then 3
      else 9
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user untuk mengajukan proposal ke desa tidak ditemukan';
  end if;

  update public.business_plans
  set
    status = 'submitted_to_village',
    submitted_to_village_at = now(),
    submitted_by = v_actor_id,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_plan.id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_plan.id,
    v_plan.status,
    'submitted_to_village',
    v_actor_id,
    v_actor_role,
    'business_plan_submitted_to_village',
    nullif(trim(coalesce(p_notes, '')), ''),
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'requested_capital_amount', v_plan.requested_capital_amount
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'business_plan_submitted_to_village',
    'business_plans',
    v_plan.id,
    'business_plan_governance',
    v_plan.id,
    'Proposal/perencanaan usaha diajukan ke desa.',
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'requested_capital_amount', v_plan.requested_capital_amount
    )
  );

  return v_plan.id;
end;
$$;

-- ============================================================================
-- 20. RPC: record village decision
-- ============================================================================

create or replace function public.record_business_plan_village_decision(
  p_business_plan_id uuid,
  p_is_approved boolean,
  p_approved_capital_amount numeric,
  p_decision_notes text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_plan record;
  v_new_status public.business_plan_status;
  v_approved_amount numeric(18,2);
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  if p_is_approved is null then
    raise exception 'Keputusan desa wajib diisi';
  end if;

  if nullif(trim(coalesce(p_decision_notes, '')), '') is null then
    raise exception 'Catatan keputusan desa wajib diisi';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'business_plan.approve',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = v_plan.tenant_id
        and ur.unit_id is null
      )
    )
  order by
    case ur.role
      when 'super_admin_platform' then 1
      when 'direktur_bumdes' then 2
      when 'admin_bumdes' then 3
      else 9
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user untuk mencatat keputusan desa tidak ditemukan';
  end if;

  if v_plan.status <> 'submitted_to_village' then
    raise exception 'Keputusan desa hanya bisa dicatat setelah proposal diajukan ke desa. Status saat ini: %', v_plan.status;
  end if;

  if p_is_approved then
    v_new_status := 'approved_by_village';
    v_approved_amount := coalesce(p_approved_capital_amount, 0);

    if v_approved_amount <= 0 then
      raise exception 'Nominal modal yang disetujui harus lebih dari 0';
    end if;

    if v_approved_amount > v_plan.requested_capital_amount then
      raise exception 'Nominal disetujui tidak boleh melebihi total kebutuhan modal proposal';
    end if;
  else
    v_new_status := 'rejected_by_village';
    v_approved_amount := 0;
  end if;

  update public.business_plans
  set
    status = v_new_status,
    approved_capital_amount = v_approved_amount,
    village_decision_at = now(),
    village_decision_by = v_actor_id,
    village_decision_notes = trim(p_decision_notes),
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_business_plan_id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    p_business_plan_id,
    v_plan.status,
    v_new_status,
    v_actor_id,
    v_actor_role,
    'business_plan_village_decision_recorded',
    trim(p_decision_notes),
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'is_approved', p_is_approved,
      'requested_capital_amount', v_plan.requested_capital_amount,
      'approved_capital_amount', v_approved_amount
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'business_plan_village_decision_recorded',
    'business_plans',
    p_business_plan_id,
    'business_plan_governance',
    p_business_plan_id,
    case
      when p_is_approved then 'Keputusan desa dicatat: proposal disetujui.'
      else 'Keputusan desa dicatat: proposal ditolak.'
    end,
    jsonb_build_object(
      'plan_no', v_plan.plan_no,
      'title', v_plan.title,
      'old_status', v_plan.status,
      'new_status', v_new_status,
      'is_approved', p_is_approved,
      'requested_capital_amount', v_plan.requested_capital_amount,
      'approved_capital_amount', v_approved_amount
    )
  );

  return p_business_plan_id;
end;
$$;

grant execute on function public.create_business_plan(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.submit_business_plan_to_facilitator(uuid, text) to authenticated;
grant execute on function public.review_business_plan(uuid, public.business_plan_review_result, text, text, text, text) to authenticated;
grant execute on function public.submit_business_plan_to_village(uuid, text) to authenticated;
grant execute on function public.record_business_plan_village_decision(uuid, boolean, numeric, text) to authenticated;

-- ============================================================================
-- 21. RPC: get capital disbursement options
-- ============================================================================

create or replace function public.get_capital_disbursement_options(
  p_business_plan_id uuid
)
returns table (
  option_type text,
  id uuid,
  code text,
  name text,
  kind text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_plan record;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  select
    bp.id,
    bp.tenant_id,
    bp.status
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'capital_disbursement.manage',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  return query
  select
    'cash_bank'::text as option_type,
    cba.id,
    cba.account_code as code,
    cba.account_name as name,
    cba.account_kind as kind
  from public.cash_bank_accounts cba
  where cba.tenant_id = v_plan.tenant_id
    and cba.unit_id is null
    and cba.is_active = true
    and cba.account_id is not null

  union all

  select
    'equity'::text as option_type,
    ea.id,
    ea.equity_code as code,
    ea.equity_name as name,
    ea.equity_type as kind
  from public.equity_accounts ea
  where ea.tenant_id = v_plan.tenant_id
    and ea.unit_id is null
    and ea.is_active = true
    and ea.account_id is not null
    and ea.equity_type in ('initial_capital', 'additional_capital')

  order by option_type, code, name;
end;
$$;

-- ============================================================================
-- 22. RPC: post capital disbursement to BUMDes center
-- ============================================================================

create or replace function public.post_capital_disbursement(
  p_business_plan_id uuid,
  p_cash_bank_account_id uuid,
  p_equity_account_id uuid,
  p_disbursement_no text,
  p_disbursement_date date default current_date,
  p_amount numeric default null,
  p_source_document_no text default null,
  p_source_document_date date default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;

  v_plan record;
  v_cash_bank record;
  v_equity record;
  v_period_id uuid;
  v_disbursement_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_equity_movement_id uuid;

  v_amount numeric(18,2);
  v_remaining_amount numeric(18,2);

  v_journal_no text;
  v_cash_tx_no text;
  v_equity_movement_no text;
  v_description text;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  if p_cash_bank_account_id is null then
    raise exception 'cash_bank_account_id wajib diisi';
  end if;

  if p_equity_account_id is null then
    raise exception 'equity_account_id wajib diisi';
  end if;

  if nullif(trim(p_disbursement_no), '') is null then
    raise exception 'Nomor pencairan modal wajib diisi';
  end if;

  if p_disbursement_date is null then
    raise exception 'Tanggal pencairan modal wajib diisi';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'capital_disbursement.manage',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = v_plan.tenant_id
        and ur.unit_id is null
        and ur.role in ('direktur_bumdes', 'admin_bumdes')
      )
    )
  order by
    case
      when ur.role = 'super_admin_platform' then 1
      when ur.role = 'direktur_bumdes' then 2
      when ur.role = 'admin_bumdes' then 3
      else 99
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user tidak berwenang memposting pencairan modal';
  end if;

  if v_plan.status <> 'approved_by_village' then
    raise exception 'Pencairan modal hanya bisa diposting dari proposal yang sudah disetujui desa';
  end if;

  if v_plan.approved_capital_amount <= 0 then
    raise exception 'Nilai modal yang disetujui desa belum valid';
  end if;

  v_remaining_amount := v_plan.approved_capital_amount - coalesce(v_plan.disbursed_capital_amount, 0);

  if v_remaining_amount <= 0 then
    raise exception 'Proposal ini sudah tidak memiliki sisa nilai pencairan';
  end if;

  v_amount := coalesce(p_amount, v_remaining_amount);

  if v_amount <= 0 then
    raise exception 'Nilai pencairan modal harus lebih dari 0';
  end if;

  if v_amount <> v_remaining_amount then
    raise exception 'Untuk tahap engine saat ini, nilai pencairan harus sama dengan sisa nilai disetujui: %', v_remaining_amount;
  end if;

  select cba.*
  into v_cash_bank
  from public.cash_bank_accounts cba
  where cba.id = p_cash_bank_account_id
    and cba.tenant_id = v_plan.tenant_id
    and cba.unit_id is null
    and cba.is_active = true;

  if v_cash_bank.id is null then
    raise exception 'Akun kas/bank pusat BUMDes tidak ditemukan atau tidak aktif';
  end if;

  if v_cash_bank.account_id is null then
    raise exception 'Akun kas/bank pusat belum terhubung ke COA';
  end if;

  select ea.*
  into v_equity
  from public.equity_accounts ea
  where ea.id = p_equity_account_id
    and ea.tenant_id = v_plan.tenant_id
    and ea.unit_id is null
    and ea.is_active = true;

  if v_equity.id is null then
    raise exception 'Akun ekuitas pusat BUMDes tidak ditemukan atau tidak aktif';
  end if;

  if v_equity.account_id is null then
    raise exception 'Akun ekuitas pusat belum terhubung ke COA';
  end if;

  if v_equity.equity_type not in ('initial_capital', 'additional_capital') then
    raise exception 'Pencairan modal hanya boleh memakai akun ekuitas modal awal atau modal tambahan';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_plan.tenant_id
    and ap.unit_id is null
    and p_disbursement_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi pusat BUMDes untuk tanggal % belum tersedia', p_disbursement_date;
  end if;

  perform public.assert_period_open(v_period_id);

  v_description := coalesce(
    nullif(trim(p_description), ''),
    'Pencairan penyertaan modal desa untuk proposal ' || v_plan.plan_no || ' - ' || v_plan.title
  );

  v_journal_no := 'JRN-MODAL-' || replace(trim(p_disbursement_no), '/', '-');
  v_cash_tx_no := 'CB-MODAL-' || replace(trim(p_disbursement_no), '/', '-');
  v_equity_movement_no := 'EQ-MODAL-' || replace(trim(p_disbursement_no), '/', '-');

  insert into public.capital_disbursements (
    tenant_id,
    business_plan_id,
    cash_bank_account_id,
    disbursement_no,
    disbursement_date,
    amount,
    source_document_no,
    source_document_date,
    description,
    status,
    created_by
  )
  values (
    v_plan.tenant_id,
    v_plan.id,
    v_cash_bank.id,
    trim(p_disbursement_no),
    p_disbursement_date,
    v_amount,
    nullif(trim(p_source_document_no), ''),
    p_source_document_date,
    v_description,
    'draft',
    v_actor_id
  )
  returning id into v_disbursement_id;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    source_type,
    source_id,
    description,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_period_id,
    v_journal_no,
    p_disbursement_date,
    'capital_disbursement',
    v_disbursement_id,
    v_description,
    'posted',
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    line_no,
    account_id,
    debit,
    credit,
    description
  )
  values
    (
      v_journal_entry_id,
      1,
      v_cash_bank.account_id,
      v_amount,
      0,
      'Dr kas/bank pusat BUMDes'
    ),
    (
      v_journal_entry_id,
      2,
      v_equity.account_id,
      0,
      v_amount,
      'Cr modal BUMDes'
    );

  perform public.assert_journal_balanced(v_journal_entry_id);

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    source_type,
    source_id,
    description,
    amount,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_cash_bank.id,
    v_cash_tx_no,
    p_disbursement_date,
    'receipt',
    'capital_disbursement',
    v_disbursement_id,
    v_description,
    v_amount,
    'posted',
    v_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_cash_bank_transaction_id;

  insert into public.equity_movements (
    tenant_id,
    unit_id,
    equity_account_id,
    movement_no,
    movement_date,
    movement_type,
    amount,
    description,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_equity.id,
    v_equity_movement_no,
    p_disbursement_date,
    'capital_injection',
    v_amount,
    v_description,
    'posted',
    v_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_equity_movement_id;

  update public.capital_disbursements
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_disbursement_id;

  update public.business_plans
  set
    status = 'disbursed',
    disbursed_capital_amount = coalesce(disbursed_capital_amount, 0) + v_amount,
    disbursed_at = now(),
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_plan.id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_plan.id,
    v_plan.status,
    'disbursed',
    v_actor_id,
    v_actor_role,
    'capital_disbursement_posted',
    v_description,
    jsonb_build_object(
      'capital_disbursement_id', v_disbursement_id,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_account_id', v_cash_bank.id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'equity_account_id', v_equity.id,
      'equity_movement_id', v_equity_movement_id,
      'amount', v_amount
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    null,
    v_actor_id,
    v_actor_role,
    'capital_disbursement_posted',
    'capital_disbursement',
    v_disbursement_id,
    'rpc',
    v_disbursement_id,
    v_description,
    jsonb_build_object(
      'business_plan_id', v_plan.id,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_account_id', v_cash_bank.id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'equity_account_id', v_equity.id,
      'equity_movement_id', v_equity_movement_id,
      'amount', v_amount
    )
  );

  return v_disbursement_id;
end;
$$;

-- ============================================================================
-- 23. RPC: get unit capital allocation options
-- ============================================================================

create or replace function public.get_unit_capital_allocation_options(
  p_business_plan_id uuid
)
returns table (
  option_type text,
  id uuid,
  code text,
  name text,
  kind text,
  unit_id uuid,
  current_balance numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_plan record;
  v_target_unit_id uuid;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  select
    bp.id,
    bp.tenant_id,
    bp.status,
    bp.proposed_unit_id
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'capital_allocation.manage',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  if v_plan.status not in ('disbursed', 'allocated_to_unit') then
    raise exception 'Opsi alokasi hanya tersedia setelah dana proposal dicairkan';
  end if;

  v_target_unit_id := v_plan.proposed_unit_id;

  if v_target_unit_id is null then
    raise exception 'Proposal belum memiliki unit tujuan alokasi';
  end if;

  return query
  select
    'source_cash_bank'::text as option_type,
    cba.id,
    cba.account_code as code,
    cba.account_name as name,
    cba.account_kind as kind,
    cba.unit_id,
    coalesce(vcb.current_balance, 0::numeric) as current_balance
  from public.cash_bank_accounts cba
  left join public.v_cash_bank_balance vcb
    on vcb.cash_bank_account_id = cba.id
  where cba.tenant_id = v_plan.tenant_id
    and cba.unit_id is null
    and cba.is_active = true
    and cba.account_id is not null

  union all

  select
    'target_cash_bank'::text as option_type,
    cba.id,
    cba.account_code as code,
    cba.account_name as name,
    cba.account_kind as kind,
    cba.unit_id,
    coalesce(vcb.current_balance, 0::numeric) as current_balance
  from public.cash_bank_accounts cba
  left join public.v_cash_bank_balance vcb
    on vcb.cash_bank_account_id = cba.id
  where cba.tenant_id = v_plan.tenant_id
    and cba.unit_id = v_target_unit_id
    and cba.is_active = true
    and cba.account_id is not null

  union all

  select
    'source_equity'::text as option_type,
    ea.id,
    ea.equity_code as code,
    ea.equity_name as name,
    ea.equity_type as kind,
    ea.unit_id,
    null::numeric as current_balance
  from public.equity_accounts ea
  where ea.tenant_id = v_plan.tenant_id
    and ea.unit_id is null
    and ea.is_active = true
    and ea.account_id is not null
    and ea.equity_type in ('initial_capital', 'additional_capital')

  union all

  select
    'target_equity'::text as option_type,
    ea.id,
    ea.equity_code as code,
    ea.equity_name as name,
    ea.equity_type as kind,
    ea.unit_id,
    null::numeric as current_balance
  from public.equity_accounts ea
  where ea.tenant_id = v_plan.tenant_id
    and ea.unit_id = v_target_unit_id
    and ea.is_active = true
    and ea.account_id is not null
    and ea.equity_type in ('initial_capital', 'additional_capital')

  order by option_type, code, name;
end;
$$;

-- ============================================================================
-- 24. RPC: post unit capital allocation from BUMDes center to unit
-- ============================================================================

create or replace function public.post_unit_capital_allocation(
  p_business_plan_id uuid,
  p_capital_disbursement_id uuid,
  p_unit_id uuid,
  p_source_cash_bank_account_id uuid,
  p_target_cash_bank_account_id uuid,
  p_source_equity_account_id uuid,
  p_target_equity_account_id uuid,
  p_allocation_no text,
  p_allocation_date date default current_date,
  p_amount numeric default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;

  v_plan record;
  v_disbursement record;
  v_unit record;
  v_source_cash_bank record;
  v_target_cash_bank record;
  v_source_equity record;
  v_target_equity record;

  v_source_period_id uuid;
  v_target_period_id uuid;

  v_allocation_id uuid;
  v_source_journal_entry_id uuid;
  v_target_journal_entry_id uuid;
  v_source_cash_bank_transaction_id uuid;
  v_target_cash_bank_transaction_id uuid;
  v_source_equity_movement_id uuid;
  v_target_equity_movement_id uuid;

  v_amount numeric(18,2);
  v_remaining_amount numeric(18,2);
  v_source_balance numeric(18,2);

  v_source_journal_no text;
  v_target_journal_no text;
  v_source_cash_tx_no text;
  v_target_cash_tx_no text;
  v_source_equity_movement_no text;
  v_target_equity_movement_no text;
  v_description text;
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_business_plan_id is null then
    raise exception 'business_plan_id wajib diisi';
  end if;

  if p_capital_disbursement_id is null then
    raise exception 'capital_disbursement_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  if p_source_cash_bank_account_id is null then
    raise exception 'source_cash_bank_account_id wajib diisi';
  end if;

  if p_target_cash_bank_account_id is null then
    raise exception 'target_cash_bank_account_id wajib diisi';
  end if;

  if p_source_equity_account_id is null then
    raise exception 'source_equity_account_id wajib diisi';
  end if;

  if p_target_equity_account_id is null then
    raise exception 'target_equity_account_id wajib diisi';
  end if;

  if nullif(trim(p_allocation_no), '') is null then
    raise exception 'Nomor alokasi modal wajib diisi';
  end if;

  if p_allocation_date is null then
    raise exception 'Tanggal alokasi modal wajib diisi';
  end if;

  select bp.*
  into v_plan
  from public.business_plans bp
  where bp.id = p_business_plan_id
  for update;

  if v_plan.id is null then
    raise exception 'Proposal/perencanaan usaha tidak ditemukan';
  end if;

  perform public.assert_user_has_permission(
    'capital_allocation.manage',
    v_actor_id,
    v_plan.tenant_id,
    null
  );

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.role = 'super_admin_platform'
      or (
        ur.tenant_id = v_plan.tenant_id
        and ur.unit_id is null
        and ur.role in ('direktur_bumdes', 'admin_bumdes')
      )
    )
  order by
    case
      when ur.role = 'super_admin_platform' then 1
      when ur.role = 'direktur_bumdes' then 2
      when ur.role = 'admin_bumdes' then 3
      else 99
    end
  limit 1;

  if v_actor_role is null then
    raise exception 'Role user tidak berwenang memposting alokasi modal unit';
  end if;

  if v_plan.status not in ('disbursed', 'allocated_to_unit') then
    raise exception 'Alokasi modal hanya bisa dilakukan setelah dana proposal dicairkan';
  end if;

  if v_plan.proposed_unit_id is not null
     and v_plan.proposed_unit_id is distinct from p_unit_id then
    raise exception 'Unit tujuan alokasi tidak sesuai dengan unit pada proposal';
  end if;

  select cd.*
  into v_disbursement
  from public.capital_disbursements cd
  where cd.id = p_capital_disbursement_id
  for update;

  if v_disbursement.id is null then
    raise exception 'Pencairan modal tidak ditemukan';
  end if;

  if v_disbursement.tenant_id is distinct from v_plan.tenant_id
     or v_disbursement.business_plan_id is distinct from v_plan.id then
    raise exception 'Pencairan modal tidak sesuai dengan proposal';
  end if;

  if v_disbursement.status <> 'posted' then
    raise exception 'Alokasi hanya bisa memakai pencairan modal yang sudah posted';
  end if;

  select bu.*
  into v_unit
  from public.business_units bu
  where bu.id = p_unit_id
    and bu.tenant_id = v_plan.tenant_id
    and bu.status = 'aktif';

  if v_unit.id is null then
    raise exception 'Unit tujuan tidak ditemukan atau tidak aktif';
  end if;

  v_remaining_amount := coalesce(v_plan.disbursed_capital_amount, 0) - coalesce(v_plan.allocated_capital_amount, 0);

  if v_remaining_amount <= 0 then
    raise exception 'Proposal ini sudah tidak memiliki sisa dana untuk dialokasikan';
  end if;

  v_amount := coalesce(p_amount, v_remaining_amount);

  if v_amount <= 0 then
    raise exception 'Nilai alokasi modal harus lebih dari 0';
  end if;

  if v_amount <> v_remaining_amount then
    raise exception 'Untuk tahap engine saat ini, nilai alokasi harus sama dengan sisa dana belum dialokasikan: %', v_remaining_amount;
  end if;

  select cba.*
  into v_source_cash_bank
  from public.cash_bank_accounts cba
  where cba.id = p_source_cash_bank_account_id
    and cba.tenant_id = v_plan.tenant_id
    and cba.unit_id is null
    and cba.is_active = true;

  if v_source_cash_bank.id is null then
    raise exception 'Akun kas/bank sumber pusat tidak ditemukan atau tidak aktif';
  end if;

  if v_source_cash_bank.account_id is null then
    raise exception 'Akun kas/bank sumber pusat belum terhubung ke COA';
  end if;

  select cba.*
  into v_target_cash_bank
  from public.cash_bank_accounts cba
  where cba.id = p_target_cash_bank_account_id
    and cba.tenant_id = v_plan.tenant_id
    and cba.unit_id = p_unit_id
    and cba.is_active = true;

  if v_target_cash_bank.id is null then
    raise exception 'Akun kas/bank tujuan unit tidak ditemukan atau tidak aktif';
  end if;

  if v_target_cash_bank.account_id is null then
    raise exception 'Akun kas/bank tujuan unit belum terhubung ke COA';
  end if;

  if v_source_cash_bank.id = v_target_cash_bank.id then
    raise exception 'Akun kas/bank sumber dan tujuan tidak boleh sama';
  end if;

  select ea.*
  into v_source_equity
  from public.equity_accounts ea
  where ea.id = p_source_equity_account_id
    and ea.tenant_id = v_plan.tenant_id
    and ea.unit_id is null
    and ea.is_active = true;

  if v_source_equity.id is null then
    raise exception 'Akun ekuitas sumber pusat tidak ditemukan atau tidak aktif';
  end if;

  if v_source_equity.account_id is null then
    raise exception 'Akun ekuitas sumber pusat belum terhubung ke COA';
  end if;

  select ea.*
  into v_target_equity
  from public.equity_accounts ea
  where ea.id = p_target_equity_account_id
    and ea.tenant_id = v_plan.tenant_id
    and ea.unit_id = p_unit_id
    and ea.is_active = true;

  if v_target_equity.id is null then
    raise exception 'Akun ekuitas tujuan unit tidak ditemukan atau tidak aktif';
  end if;

  if v_target_equity.account_id is null then
    raise exception 'Akun ekuitas tujuan unit belum terhubung ke COA';
  end if;

  if v_source_equity.equity_type not in ('initial_capital', 'additional_capital') then
    raise exception 'Ekuitas sumber harus modal awal atau modal tambahan';
  end if;

  if v_target_equity.equity_type not in ('initial_capital', 'additional_capital') then
    raise exception 'Ekuitas tujuan unit harus modal awal atau modal tambahan';
  end if;

  if v_source_equity.equity_type <> v_target_equity.equity_type then
    raise exception 'Jenis ekuitas sumber dan tujuan harus sama';
  end if;

  select coalesce(v.current_balance, 0)
  into v_source_balance
  from public.v_cash_bank_balance v
  where v.cash_bank_account_id = v_source_cash_bank.id;

  if coalesce(v_source_balance, 0) < v_amount then
    raise exception 'Saldo kas/bank pusat tidak cukup. Saldo: %, dibutuhkan: %', coalesce(v_source_balance, 0), v_amount;
  end if;

  select ap.id
  into v_source_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_plan.tenant_id
    and ap.unit_id is null
    and p_allocation_date between ap.period_start and ap.period_end
  limit 1;

  if v_source_period_id is null then
    raise exception 'Periode akuntansi pusat untuk tanggal % belum tersedia', p_allocation_date;
  end if;

  perform public.assert_period_open(v_source_period_id);

  select ap.id
  into v_target_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_plan.tenant_id
    and ap.unit_id = p_unit_id
    and p_allocation_date between ap.period_start and ap.period_end
  limit 1;

  if v_target_period_id is null then
    raise exception 'Periode akuntansi unit untuk tanggal % belum tersedia', p_allocation_date;
  end if;

  perform public.assert_period_open(v_target_period_id);

  v_description := coalesce(
    nullif(trim(p_description), ''),
    'Alokasi modal dari BUMDes pusat ke unit ' || v_unit.nama_unit || ' untuk proposal ' || v_plan.plan_no
  );

  v_source_journal_no := 'JRN-ALOK-PUSAT-' || replace(trim(p_allocation_no), '/', '-');
  v_target_journal_no := 'JRN-ALOK-UNIT-' || replace(trim(p_allocation_no), '/', '-');
  v_source_cash_tx_no := 'CB-ALOK-KELUAR-' || replace(trim(p_allocation_no), '/', '-');
  v_target_cash_tx_no := 'CB-ALOK-MASUK-' || replace(trim(p_allocation_no), '/', '-');
  v_source_equity_movement_no := 'EQ-ALOK-KELUAR-' || replace(trim(p_allocation_no), '/', '-');
  v_target_equity_movement_no := 'EQ-ALOK-MASUK-' || replace(trim(p_allocation_no), '/', '-');

  insert into public.unit_capital_allocations (
    tenant_id,
    unit_id,
    business_plan_id,
    capital_disbursement_id,
    source_cash_bank_account_id,
    target_cash_bank_account_id,
    allocation_no,
    allocation_date,
    amount,
    description,
    status,
    created_by
  )
  values (
    v_plan.tenant_id,
    p_unit_id,
    v_plan.id,
    v_disbursement.id,
    v_source_cash_bank.id,
    v_target_cash_bank.id,
    trim(p_allocation_no),
    p_allocation_date,
    v_amount,
    v_description,
    'draft',
    v_actor_id
  )
  returning id into v_allocation_id;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    source_type,
    source_id,
    description,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_source_period_id,
    v_source_journal_no,
    p_allocation_date,
    'unit_capital_allocation_source',
    v_allocation_id,
    v_description,
    'posted',
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_source_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    line_no,
    account_id,
    debit,
    credit,
    description
  )
  values
    (
      v_source_journal_entry_id,
      1,
      v_source_equity.account_id,
      v_amount,
      0,
      'Dr modal BUMDes pusat dialokasikan ke unit'
    ),
    (
      v_source_journal_entry_id,
      2,
      v_source_cash_bank.account_id,
      0,
      v_amount,
      'Cr kas/bank pusat keluar untuk alokasi unit'
    );

  perform public.assert_journal_balanced(v_source_journal_entry_id);

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    source_type,
    source_id,
    description,
    amount,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_source_cash_bank.id,
    v_source_cash_tx_no,
    p_allocation_date,
    'payment',
    'unit_capital_allocation',
    v_allocation_id,
    v_description,
    v_amount,
    'posted',
    v_source_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_source_cash_bank_transaction_id;

  insert into public.equity_movements (
    tenant_id,
    unit_id,
    equity_account_id,
    movement_no,
    movement_date,
    movement_type,
    amount,
    description,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    null,
    v_source_equity.id,
    v_source_equity_movement_no,
    p_allocation_date,
    'capital_withdrawal',
    v_amount,
    v_description,
    'posted',
    v_source_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_source_equity_movement_id;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    source_type,
    source_id,
    description,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    p_unit_id,
    v_target_period_id,
    v_target_journal_no,
    p_allocation_date,
    'unit_capital_allocation_target',
    v_allocation_id,
    v_description,
    'posted',
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_target_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    line_no,
    account_id,
    debit,
    credit,
    description
  )
  values
    (
      v_target_journal_entry_id,
      1,
      v_target_cash_bank.account_id,
      v_amount,
      0,
      'Dr kas/bank unit menerima alokasi modal'
    ),
    (
      v_target_journal_entry_id,
      2,
      v_target_equity.account_id,
      0,
      v_amount,
      'Cr modal unit dari BUMDes pusat'
    );

  perform public.assert_journal_balanced(v_target_journal_entry_id);

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    source_type,
    source_id,
    description,
    amount,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    p_unit_id,
    v_target_cash_bank.id,
    v_target_cash_tx_no,
    p_allocation_date,
    'receipt',
    'unit_capital_allocation',
    v_allocation_id,
    v_description,
    v_amount,
    'posted',
    v_target_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_target_cash_bank_transaction_id;

  insert into public.equity_movements (
    tenant_id,
    unit_id,
    equity_account_id,
    movement_no,
    movement_date,
    movement_type,
    amount,
    description,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_plan.tenant_id,
    p_unit_id,
    v_target_equity.id,
    v_target_equity_movement_no,
    p_allocation_date,
    'capital_injection',
    v_amount,
    v_description,
    'posted',
    v_target_journal_entry_id,
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_target_equity_movement_id;

  update public.unit_capital_allocations
  set
    status = 'posted',
    journal_entry_id = v_target_journal_entry_id,
    source_journal_entry_id = v_source_journal_entry_id,
    target_journal_entry_id = v_target_journal_entry_id,
    source_cash_bank_transaction_id = v_source_cash_bank_transaction_id,
    target_cash_bank_transaction_id = v_target_cash_bank_transaction_id,
    source_equity_movement_id = v_source_equity_movement_id,
    target_equity_movement_id = v_target_equity_movement_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_allocation_id;

  update public.business_plans
  set
    status = 'allocated_to_unit',
    allocated_capital_amount = coalesce(allocated_capital_amount, 0) + v_amount,
    allocated_to_unit_at = now(),
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_plan.id;

  insert into public.business_plan_status_history (
    business_plan_id,
    old_status,
    new_status,
    actor_id,
    actor_role,
    action_type,
    notes,
    metadata
  )
  values (
    v_plan.id,
    v_plan.status,
    'allocated_to_unit',
    v_actor_id,
    v_actor_role,
    'unit_capital_allocation_posted',
    v_description,
    jsonb_build_object(
      'unit_capital_allocation_id', v_allocation_id,
      'capital_disbursement_id', v_disbursement.id,
      'unit_id', p_unit_id,
      'source_cash_bank_account_id', v_source_cash_bank.id,
      'target_cash_bank_account_id', v_target_cash_bank.id,
      'source_journal_entry_id', v_source_journal_entry_id,
      'target_journal_entry_id', v_target_journal_entry_id,
      'amount', v_amount
    )
  );

  perform public.log_audit_event(
    v_plan.tenant_id,
    p_unit_id,
    v_actor_id,
    v_actor_role,
    'unit_capital_allocation_posted',
    'unit_capital_allocation',
    v_allocation_id,
    'rpc',
    v_allocation_id,
    v_description,
    jsonb_build_object(
      'business_plan_id', v_plan.id,
      'capital_disbursement_id', v_disbursement.id,
      'source_journal_entry_id', v_source_journal_entry_id,
      'target_journal_entry_id', v_target_journal_entry_id,
      'source_cash_bank_transaction_id', v_source_cash_bank_transaction_id,
      'target_cash_bank_transaction_id', v_target_cash_bank_transaction_id,
      'source_equity_movement_id', v_source_equity_movement_id,
      'target_equity_movement_id', v_target_equity_movement_id,
      'amount', v_amount
    )
  );

  return v_allocation_id;
end;
$$;

grant execute on function public.get_capital_disbursement_options(uuid) to authenticated;
grant execute on function public.post_capital_disbursement(uuid, uuid, uuid, text, date, numeric, text, date, text) to authenticated;
grant execute on function public.get_unit_capital_allocation_options(uuid) to authenticated;
grant execute on function public.post_unit_capital_allocation(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, numeric, text) to authenticated;

-- ============================================================================
-- 25. View: business plan budget lines
-- ============================================================================

create or replace view public.v_business_plan_budget_lines as
select
  bpl.id,
  bpl.business_plan_id,
  bp.tenant_id,
  bp.plan_no,
  bp.title as business_plan_title,
  bp.status as business_plan_status,

  t.nama_bumdes,
  t.nama_desa,
  t.nama_kecamatan,

  bpl.line_no,
  bpl.category,
  bpl.description,
  bpl.quantity,
  bpl.unit_of_measure,
  bpl.unit_cost,
  bpl.total_amount,
  (bpl.quantity * bpl.unit_cost) as calculated_total_amount,
  bpl.notes,
  bpl.created_at,
  bpl.updated_at
from public.business_plan_budget_lines bpl
join public.business_plans bp
  on bp.id = bpl.business_plan_id
join public.tenants t
  on t.id = bp.tenant_id;

-- ============================================================================
-- 26. View: business plan capital flow
-- ============================================================================

create or replace view public.v_business_plan_capital_flow as
with latest_review as (
  select distinct on (bpr.business_plan_id)
    bpr.business_plan_id,
    bpr.review_result,
    bpr.feasibility_notes,
    bpr.reviewed_at
  from public.business_plan_reviews bpr
  order by bpr.business_plan_id, bpr.reviewed_at desc, bpr.created_at desc
),
latest_disbursement as (
  select distinct on (cd.business_plan_id)
    cd.id,
    cd.business_plan_id,
    cd.disbursement_no,
    cd.disbursement_date,
    cd.amount,
    cd.status
  from public.capital_disbursements cd
  order by cd.business_plan_id, cd.created_at desc
),
latest_allocation as (
  select distinct on (uca.business_plan_id)
    uca.id,
    uca.business_plan_id,
    uca.allocation_no,
    uca.allocation_date,
    uca.amount,
    uca.status
  from public.unit_capital_allocations uca
  order by uca.business_plan_id, uca.created_at desc
)
select
  bp.id as business_plan_id,
  bp.tenant_id,

  t.nama_bumdes,
  t.kode_bumdes,
  t.nama_desa,
  t.nama_kecamatan,

  bp.proposed_unit_id as unit_id,
  bu.kode_unit,
  bu.nama_unit,
  bu.jenis_unit,

  bp.plan_no,
  bp.title,
  bp.business_type,
  bp.status,

  bp.requested_capital_amount,
  bp.approved_capital_amount,
  bp.disbursed_capital_amount,
  bp.allocated_capital_amount,

  (bp.approved_capital_amount - bp.disbursed_capital_amount)::numeric(18,2) as remaining_to_disburse,
  (bp.disbursed_capital_amount - bp.allocated_capital_amount)::numeric(18,2) as remaining_to_allocate,

  bp.created_at,
  bp.submitted_to_facilitator_at,
  bp.facilitator_reviewed_at,
  bp.submitted_to_village_at,
  bp.village_decision_at,
  bp.disbursed_at,
  bp.allocated_to_unit_at,
  bp.closed_at,
  bp.cancelled_at,

  lr.review_result as latest_review_result,
  lr.feasibility_notes as latest_review_notes,
  lr.reviewed_at as latest_reviewed_at,

  ld.id as latest_capital_disbursement_id,
  ld.disbursement_no,
  ld.disbursement_date,
  ld.amount as latest_disbursement_amount,
  ld.status as latest_disbursement_status,

  la.id as latest_unit_capital_allocation_id,
  la.allocation_no,
  la.allocation_date,
  la.amount as latest_allocation_amount,
  la.status as latest_allocation_status,

  case bp.status
    when 'draft' then 'Draft'
    when 'submitted_to_facilitator' then 'Diajukan ke Pendamping'
    when 'under_facilitator_review' then 'Sedang Direview Pendamping'
    when 'needs_revision' then 'Perlu Revisi'
    when 'ready_for_village_submission' then 'Siap Diajukan ke Desa'
    when 'submitted_to_village' then 'Diajukan ke Desa'
    when 'approved_by_village' then 'Disetujui Desa'
    when 'rejected_by_village' then 'Ditolak Desa'
    when 'disbursed' then 'Dana Sudah Dicairkan'
    when 'allocated_to_unit' then 'Dana Sudah Dialokasikan ke Unit'
    when 'closed' then 'Selesai'
    when 'cancelled' then 'Dibatalkan'
    else bp.status::text
  end as status_label,

  (bp.status in ('draft', 'needs_revision')) as can_edit,
  (bp.status in ('draft', 'needs_revision') and bp.requested_capital_amount > 0) as can_submit_to_facilitator,
  (bp.status = 'ready_for_village_submission') as can_submit_to_village,
  (bp.status = 'approved_by_village' and bp.approved_capital_amount > bp.disbursed_capital_amount) as can_record_disbursement,
  (bp.status in ('disbursed', 'allocated_to_unit') and bp.disbursed_capital_amount > bp.allocated_capital_amount) as can_allocate_to_unit,

  bp.background,
  bp.objectives,
  bp.market_analysis,
  bp.operational_plan,
  bp.risk_analysis,
  bp.expected_benefits
from public.business_plans bp
join public.tenants t
  on t.id = bp.tenant_id
left join public.business_units bu
  on bu.id = bp.proposed_unit_id
left join latest_review lr
  on lr.business_plan_id = bp.id
left join latest_disbursement ld
  on ld.business_plan_id = bp.id
left join latest_allocation la
  on la.business_plan_id = bp.id;

-- ============================================================================
-- 27. View: business plan governance timeline
-- ============================================================================

create or replace view public.v_business_plan_governance_timeline as
select
  bpsh.id as timeline_id,
  bpsh.business_plan_id,
  bp.tenant_id,
  bp.proposed_unit_id as unit_id,
  bp.plan_no,
  bp.title,

  bpsh.created_at,
  bpsh.action_type,
  bpsh.old_status,
  bpsh.new_status,
  bpsh.actor_id,
  bpsh.actor_role,
  bpsh.notes,
  bpsh.metadata,

  t.nama_bumdes,
  t.kode_bumdes,
  t.nama_desa,
  t.nama_kecamatan,
  bu.kode_unit,
  bu.nama_unit,

  case bpsh.action_type
    when 'business_plan_created' then 'Proposal dibuat'
    when 'business_plan_submitted_to_facilitator' then 'Proposal diajukan ke Pendamping Kecamatan'
    when 'business_plan_facilitator_reviewed' then 'Proposal direview Pendamping Kecamatan'
    when 'business_plan_submitted_to_village' then 'Proposal diajukan ke desa'
    when 'business_plan_village_decision_recorded' then 'Keputusan desa dicatat'
    when 'capital_disbursement_posted' then 'Pencairan modal diposting'
    when 'unit_capital_allocation_posted' then 'Alokasi modal ke unit diposting'
    else bpsh.action_type
  end as action_label
from public.business_plan_status_history bpsh
join public.business_plans bp
  on bp.id = bpsh.business_plan_id
join public.tenants t
  on t.id = bp.tenant_id
left join public.business_units bu
  on bu.id = bp.proposed_unit_id;

-- ============================================================================
-- 28. Grants and comments for views/functions
-- ============================================================================

grant select on public.v_business_plan_budget_lines to authenticated;
grant select on public.v_business_plan_capital_flow to authenticated;
grant select on public.v_business_plan_governance_timeline to authenticated;

comment on function public.create_business_plan(uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) is
'Create Business Plan / Master Plan proposal draft with RAB budget lines.';

comment on function public.submit_business_plan_to_facilitator(uuid, text) is
'Submit Business Plan proposal to Pendamping Kecamatan for governance review.';

comment on function public.review_business_plan(uuid, public.business_plan_review_result, text, text, text, text) is
'Pendamping Kecamatan review for Business Plan proposal readiness.';

comment on function public.submit_business_plan_to_village(uuid, text) is
'Submit facilitator-ready Business Plan proposal to village decision stage.';

comment on function public.record_business_plan_village_decision(uuid, boolean, numeric, text) is
'Record village approval/rejection decision and approved capital amount.';

comment on function public.get_capital_disbursement_options(uuid) is
'Return available BUMDes center cash-bank and equity accounts for capital disbursement.';

comment on function public.post_capital_disbursement(uuid, uuid, uuid, text, date, numeric, text, date, text) is
'Post village-approved capital disbursement into BUMDes center cash-bank, journal, and equity movement.';

comment on function public.get_unit_capital_allocation_options(uuid) is
'Return source and target cash-bank/equity options for allocation of capital to business unit.';

comment on function public.post_unit_capital_allocation(uuid, uuid, uuid, uuid, uuid, uuid, uuid, text, date, numeric, text) is
'Post capital allocation from BUMDes center to unit with source and target accounting evidence.';

comment on view public.v_business_plan_budget_lines is
'Business Plan RAB lines with proposal and tenant context.';

comment on view public.v_business_plan_capital_flow is
'Business Plan / Master Plan capital governance flow from draft proposal to disbursement and unit allocation.';

comment on view public.v_business_plan_governance_timeline is
'Auditable timeline of Business Plan governance status transitions.';
