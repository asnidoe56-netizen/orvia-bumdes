-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000006_accounting_period_journal_engine.sql
--
-- Scope:
-- - Accounting periods
-- - Journal entries
-- - Journal lines
-- - Period open guard
-- - Journal balance guard
-- - Posted/reversed journal immutability guard
--
-- Notes:
-- - Fresh-install baseline.
-- - Journal correction governance is intentionally deferred to 000024.
-- - Cash-bank, inventory, sales, purchase, and operational posting engines are deferred.
-- ============================================================

begin;

-- ============================================================
-- 1. ACCOUNTING PERIODS
-- ============================================================

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  period_year integer not null,
  period_month integer not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  notes text,
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_periods_period_month_check
    check (period_month >= 1 and period_month <= 12),
  constraint accounting_periods_date_check
    check (period_end >= period_start),
  constraint accounting_periods_status_check
    check (status in ('open', 'closed', 'locked')),
  constraint accounting_periods_scope_unique
    unique nulls not distinct (tenant_id, unit_id, period_year, period_month)
);

create index if not exists accounting_periods_tenant_idx
  on public.accounting_periods(tenant_id);

create index if not exists accounting_periods_unit_idx
  on public.accounting_periods(unit_id);

create index if not exists accounting_periods_status_idx
  on public.accounting_periods(status);

drop trigger if exists trg_accounting_periods_set_updated_at on public.accounting_periods;
create trigger trg_accounting_periods_set_updated_at
before update on public.accounting_periods
for each row
execute function public.set_updated_at();

-- ============================================================
-- 2. JOURNAL ENTRIES
-- ============================================================

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  period_id uuid not null references public.accounting_periods(id) on delete restrict,
  journal_no text not null,
  journal_date date not null,
  description text,
  source_type text not null,
  source_id uuid,
  status text not null default 'draft',
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  reversal_of uuid references public.journal_entries(id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint journal_entries_status_check
    check (status in ('draft', 'posted', 'reversed', 'void')),
  constraint journal_entries_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, journal_no)
);

create index if not exists journal_entries_tenant_idx
  on public.journal_entries(tenant_id);

create index if not exists journal_entries_unit_idx
  on public.journal_entries(unit_id);

create index if not exists journal_entries_period_idx
  on public.journal_entries(period_id);

create index if not exists journal_entries_status_idx
  on public.journal_entries(status);

create index if not exists journal_entries_source_idx
  on public.journal_entries(source_type, source_id);

drop trigger if exists trg_journal_entries_set_updated_at on public.journal_entries;
create trigger trg_journal_entries_set_updated_at
before update on public.journal_entries
for each row
execute function public.set_updated_at();

-- ============================================================
-- 3. JOURNAL LINES
-- ============================================================

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null,
  account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  debit numeric(18,2) not null default 0,
  credit numeric(18,2) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  constraint journal_lines_debit_credit_non_negative_check
    check (debit >= 0 and credit >= 0),
  constraint journal_lines_debit_credit_exclusive_check
    check (
      (debit > 0 and credit = 0)
      or
      (credit > 0 and debit = 0)
    ),
  constraint journal_lines_unique_line_no
    unique (journal_entry_id, line_no)
);

create index if not exists journal_lines_entry_idx
  on public.journal_lines(journal_entry_id);

create index if not exists journal_lines_account_idx
  on public.journal_lines(account_id);

-- ============================================================
-- 4. CORE PERIOD + JOURNAL GUARD FUNCTIONS
-- ============================================================

create or replace function public.assert_period_open(
  p_period_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_status text;
begin
  select ap.status
  into v_status
  from public.accounting_periods ap
  where ap.id = p_period_id;

  if v_status is null then
    raise exception 'accounting period not found'
      using errcode = '23503';
  end if;

  if v_status <> 'open' then
    raise exception 'accounting period is not open: %', v_status
      using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.assert_journal_balanced(
  p_journal_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_debit numeric(18,2);
  v_credit numeric(18,2);
begin
  select
    coalesce(sum(jl.debit), 0),
    coalesce(sum(jl.credit), 0)
  into v_debit, v_credit
  from public.journal_lines jl
  where jl.journal_entry_id = p_journal_entry_id;

  if v_debit <= 0 or v_credit <= 0 or v_debit <> v_credit then
    raise exception 'journal is not balanced. debit: %, credit: %', v_debit, v_credit
      using errcode = '23514';
  end if;
end;
$function$;

create or replace function public.prevent_posted_journal_entry_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'reversed') then
    raise exception 'posted or reversed journal entries cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'reversed') then
    if new.status <> old.status
      or new.reversed_at is distinct from old.reversed_at
      or new.reversed_by is distinct from old.reversed_by
    then
      return new;
    end if;

    raise exception 'posted or reversed journal entries cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

create or replace function public.prevent_posted_journal_line_mutation()
returns trigger
language plpgsql
as $function$
declare
  v_status text;
begin
  select je.status
  into v_status
  from public.journal_entries je
  where je.id = coalesce(new.journal_entry_id, old.journal_entry_id);

  if v_status in ('posted', 'reversed') then
    raise exception 'journal lines of posted or reversed entries cannot be changed'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ============================================================
-- 5. CORE PERIOD PROVISIONING FUNCTIONS
-- ============================================================

create or replace function public.provision_accounting_periods_for_year(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_period_year integer,
  p_created_by uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_month integer;
  v_created_count integer := 0;
  v_row_count integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_period_year is null or p_period_year < 2000 then
    raise exception 'Tahun periode tidak valid';
  end if;

  if p_unit_id is not null then
    if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
      raise exception 'Unit tidak sesuai dengan tenant';
    end if;
  end if;

  for v_month in 1..12 loop
    insert into public.accounting_periods (
      tenant_id,
      unit_id,
      period_year,
      period_month,
      period_start,
      period_end,
      status,
      notes,
      locked_at,
      locked_by,
      closed_at,
      closed_by
    )
    select
      p_tenant_id,
      p_unit_id,
      p_period_year,
      v_month,
      make_date(p_period_year, v_month, 1),
      (
        make_date(p_period_year, v_month, 1)
        + interval '1 month'
        - interval '1 day'
      )::date,
      'open',
      case
        when p_unit_id is null
        then 'Periode pusat tenant dibuat otomatis oleh provisioning tahunan.'
        else 'Periode unit dibuat otomatis oleh provisioning tahunan.'
      end,
      null,
      null,
      null,
      null
    where not exists (
      select 1
      from public.accounting_periods ap
      where ap.tenant_id = p_tenant_id
        and ap.unit_id is not distinct from p_unit_id
        and ap.period_year = p_period_year
        and ap.period_month = v_month
    );

    get diagnostics v_row_count = row_count;
    v_created_count := v_created_count + v_row_count;
  end loop;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'unit_id', p_unit_id,
    'period_year', p_period_year,
    'created_period_count', v_created_count
  );
end;
$function$;

create or replace function public.provision_unit_accounting_periods(
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
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  insert into public.accounting_periods (
    tenant_id,
    unit_id,
    period_year,
    period_month,
    period_start,
    period_end,
    status,
    notes,
    locked_at,
    locked_by,
    closed_at,
    closed_by
  )
  select
    ap.tenant_id,
    p_unit_id,
    ap.period_year,
    ap.period_month,
    ap.period_start,
    ap.period_end,
    ap.status,
    coalesce(
      ap.notes,
      'Periode unit dibuat otomatis mengikuti periode pusat tenant.'
    ),
    ap.locked_at,
    ap.locked_by,
    ap.closed_at,
    ap.closed_by
  from public.accounting_periods ap
  where ap.tenant_id = p_tenant_id
    and ap.unit_id is null
    and not exists (
      select 1
      from public.accounting_periods unit_ap
      where unit_ap.tenant_id = ap.tenant_id
        and unit_ap.unit_id = p_unit_id
        and unit_ap.period_year = ap.period_year
        and unit_ap.period_month = ap.period_month
    );

  get diagnostics v_created_count = row_count;

  return v_created_count;
end;
$function$;

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

drop trigger if exists trg_prevent_posted_journal_entry_mutation on public.journal_entries;
create trigger trg_prevent_posted_journal_entry_mutation
before update or delete on public.journal_entries
for each row
execute function public.prevent_posted_journal_entry_mutation();

drop trigger if exists trg_prevent_posted_journal_line_mutation on public.journal_lines;
create trigger trg_prevent_posted_journal_line_mutation
before update or delete on public.journal_lines
for each row
execute function public.prevent_posted_journal_line_mutation();

-- ============================================================
-- 7. GRANTS
-- ============================================================

grant select, insert, update on public.accounting_periods to authenticated, service_role;
grant select, insert, update on public.journal_entries to authenticated, service_role;
grant select, insert, update on public.journal_lines to authenticated, service_role;

grant execute on function public.assert_period_open(uuid)
  to authenticated, service_role;

grant execute on function public.assert_journal_balanced(uuid)
  to authenticated, service_role;

grant execute on function public.provision_accounting_periods_for_year(uuid, uuid, integer, uuid)
  to authenticated, service_role;

grant execute on function public.provision_unit_accounting_periods(uuid, uuid, uuid)
  to authenticated, service_role;

commit;
