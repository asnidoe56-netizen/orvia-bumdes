-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000021: Profit Sharing / Bagi Hasil Engine
--
-- Scope:
--   - Profit sharing schemes
--   - Profit sharing allocation from Annual Closing
--   - Profit sharing distribution payments
--   - External payments for liability allocations
--   - Internal transfer for equity/cadangan allocation to Kas Alokasi Bagi Hasil
--
-- Depends on:
--   - 000005 Chart of Accounts Engine
--   - 000007 Audit Timeline Engine
--   - 000008 Cash Bank Engine
--   - 000020 Annual Closing Engine
--
-- Status:
--   PART_1_SCHEMA_CREATED
-- ============================================================================

-- ============================================================================
-- 1. Profit sharing schemes
-- ============================================================================

create table if not exists public.profit_sharing_schemes (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  scheme_code text not null,
  scheme_name text not null,
  description text,

  is_active boolean not null default true,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profit_sharing_schemes_scope_code_unique
    unique nulls not distinct (tenant_id, unit_id, scheme_code)
);

create index if not exists profit_sharing_schemes_tenant_idx
  on public.profit_sharing_schemes (tenant_id);

create index if not exists profit_sharing_schemes_unit_idx
  on public.profit_sharing_schemes (unit_id);

-- ============================================================================
-- 2. Profit sharing scheme lines
-- ============================================================================

create table if not exists public.profit_sharing_scheme_lines (
  id uuid primary key default gen_random_uuid(),

  scheme_id uuid not null references public.profit_sharing_schemes(id) on delete cascade,

  line_no integer not null,
  allocation_code text not null,
  allocation_name text not null,
  allocation_percentage numeric(8,4) not null,
  target_account_id uuid references public.chart_of_accounts(id) on delete restrict,

  created_at timestamptz not null default now(),

  constraint profit_sharing_scheme_lines_percentage_check
    check (allocation_percentage > 0 and allocation_percentage <= 100),

  constraint profit_sharing_scheme_lines_unique
    unique (scheme_id, line_no),

  constraint profit_sharing_scheme_lines_code_unique
    unique (scheme_id, allocation_code)
);

create index if not exists profit_sharing_scheme_lines_scheme_idx
  on public.profit_sharing_scheme_lines (scheme_id);

-- ============================================================================
-- 3. Profit sharing allocations
-- ============================================================================

create table if not exists public.profit_sharing_allocations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  annual_closing_id uuid not null references public.annual_closings(id) on delete restrict,
  scheme_id uuid not null references public.profit_sharing_schemes(id) on delete restrict,

  allocation_no text not null,
  allocation_date date not null default current_date,

  surplus_amount numeric(18,2) not null,

  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'calculated'::text,
      'approved'::text,
      'posted'::text,
      'cancelled'::text
    ])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  calculated_at timestamptz,
  calculated_by uuid references auth.users(id) on delete set null,

  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profit_sharing_allocations_amount_check
    check (surplus_amount >= 0),

  constraint profit_sharing_allocations_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, allocation_no)
);

create index if not exists profit_sharing_allocations_tenant_idx
  on public.profit_sharing_allocations (tenant_id);

create index if not exists profit_sharing_allocations_unit_idx
  on public.profit_sharing_allocations (unit_id);

create index if not exists profit_sharing_allocations_closing_idx
  on public.profit_sharing_allocations (annual_closing_id);

-- ============================================================================
-- 4. Profit sharing allocation lines
-- ============================================================================

create table if not exists public.profit_sharing_allocation_lines (
  id uuid primary key default gen_random_uuid(),

  allocation_id uuid not null references public.profit_sharing_allocations(id) on delete cascade,
  scheme_line_id uuid not null references public.profit_sharing_scheme_lines(id) on delete restrict,

  line_no integer not null,
  allocation_code text not null,
  allocation_name text not null,
  allocation_percentage numeric(8,4) not null,
  allocation_amount numeric(18,2) not null,
  target_account_id uuid references public.chart_of_accounts(id) on delete restrict,

  created_at timestamptz not null default now(),

  constraint profit_sharing_allocation_lines_amount_check
    check (allocation_percentage > 0 and allocation_amount >= 0),

  constraint profit_sharing_allocation_lines_unique
    unique (allocation_id, line_no)
);

create index if not exists profit_sharing_allocation_lines_allocation_idx
  on public.profit_sharing_allocation_lines (allocation_id);

-- ============================================================================
-- 5. Profit sharing distribution payments
-- ============================================================================

create table if not exists public.profit_sharing_distribution_payments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  allocation_id uuid not null references public.profit_sharing_allocations(id) on delete restrict,
  allocation_line_id uuid not null references public.profit_sharing_allocation_lines(id) on delete restrict,

  distribution_no text not null,
  distribution_date date not null default current_date,

  distribution_type text not null
    check (distribution_type = any (array[
      'external_payment'::text,
      'internal_transfer'::text
    ])),

  source_cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,
  destination_cash_bank_account_id uuid references public.cash_bank_accounts(id) on delete restrict,

  amount numeric(18,2) not null check (amount > 0),

  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'posted'::text,
      'cancelled'::text,
      'reversed'::text
    ])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  source_cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,
  destination_cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profit_sharing_distribution_payments_line_unique
    unique (allocation_line_id),

  constraint profit_sharing_distribution_payments_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, distribution_no),

  constraint profit_sharing_distribution_payments_type_target_check
    check (
      (
        distribution_type = 'external_payment'
        and destination_cash_bank_account_id is null
        and destination_cash_bank_transaction_id is null
      )
      or
      (
        distribution_type = 'internal_transfer'
        and destination_cash_bank_account_id is not null
      )
    )
);

-- ============================================================================
-- 6. Trigger helper functions
-- ============================================================================

create or replace function public.validate_profit_sharing_scheme_line_scope()
returns trigger
language plpgsql
as $$
declare
  v_scheme_tenant_id uuid;
  v_scheme_unit_id uuid;
  v_account_tenant_id uuid;
  v_account_unit_id uuid;
begin
  if new.target_account_id is not null then
    select pss.tenant_id, pss.unit_id
    into v_scheme_tenant_id, v_scheme_unit_id
    from public.profit_sharing_schemes pss
    where pss.id = new.scheme_id;

    select coa.tenant_id, coa.unit_id
    into v_account_tenant_id, v_account_unit_id
    from public.chart_of_accounts coa
    where coa.id = new.target_account_id;

    if v_account_tenant_id is null then
      raise exception 'target account not found'
        using errcode = '23503';
    end if;

    if v_scheme_tenant_id <> v_account_tenant_id
      or v_scheme_unit_id is distinct from v_account_unit_id
    then
      raise exception 'profit sharing scheme line account scope does not match scheme scope'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validate_profit_sharing_scheme_total()
returns trigger
language plpgsql
as $$
declare
  v_scheme_id uuid;
  v_total numeric(8,4);
begin
  v_scheme_id := coalesce(new.scheme_id, old.scheme_id);

  select coalesce(sum(pssl.allocation_percentage), 0)
  into v_total
  from public.profit_sharing_scheme_lines pssl
  where pssl.scheme_id = v_scheme_id;

  if v_total > 100 then
    raise exception 'profit sharing scheme total percentage cannot exceed 100. current: %', v_total
      using errcode = '23514';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_profit_sharing_allocation_scope()
returns trigger
language plpgsql
as $$
declare
  v_closing_tenant_id uuid;
  v_closing_unit_id uuid;
  v_scheme_tenant_id uuid;
  v_scheme_unit_id uuid;
begin
  select ac.tenant_id, ac.unit_id
  into v_closing_tenant_id, v_closing_unit_id
  from public.annual_closings ac
  where ac.id = new.annual_closing_id;

  select pss.tenant_id, pss.unit_id
  into v_scheme_tenant_id, v_scheme_unit_id
  from public.profit_sharing_schemes pss
  where pss.id = new.scheme_id;

  if new.tenant_id <> v_closing_tenant_id
    or new.unit_id is distinct from v_closing_unit_id
    or new.tenant_id <> v_scheme_tenant_id
    or new.unit_id is distinct from v_scheme_unit_id
  then
    raise exception 'profit sharing allocation scope does not match annual closing or scheme scope'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_posted_profit_sharing_allocation_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled') then
    raise exception 'posted or cancelled profit sharing allocation cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled') then
    raise exception 'posted or cancelled profit sharing allocation cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.validate_profit_sharing_distribution_payment_scope()
returns trigger
language plpgsql
as $$
declare
  v_allocation_tenant_id uuid;
  v_allocation_unit_id uuid;
  v_line_allocation_id uuid;

  v_source_tenant_id uuid;
  v_source_unit_id uuid;

  v_destination_tenant_id uuid;
  v_destination_unit_id uuid;
begin
  select
    psa.tenant_id,
    psa.unit_id
  into
    v_allocation_tenant_id,
    v_allocation_unit_id
  from public.profit_sharing_allocations psa
  where psa.id = new.allocation_id;

  if v_allocation_tenant_id is null then
    raise exception 'Alokasi bagi hasil tidak ditemukan';
  end if;

  if new.tenant_id <> v_allocation_tenant_id
     or new.unit_id is distinct from v_allocation_unit_id then
    raise exception 'Scope distribusi tidak sesuai dengan alokasi bagi hasil';
  end if;

  select psal.allocation_id
  into v_line_allocation_id
  from public.profit_sharing_allocation_lines psal
  where psal.id = new.allocation_line_id;

  if v_line_allocation_id is null then
    raise exception 'Detail alokasi bagi hasil tidak ditemukan';
  end if;

  if v_line_allocation_id <> new.allocation_id then
    raise exception 'Detail alokasi tidak sesuai dengan header alokasi';
  end if;

  select
    cba.tenant_id,
    cba.unit_id
  into
    v_source_tenant_id,
    v_source_unit_id
  from public.cash_bank_accounts cba
  where cba.id = new.source_cash_bank_account_id
    and cba.is_active = true;

  if v_source_tenant_id is null then
    raise exception 'Akun kas/bank sumber tidak ditemukan atau tidak aktif';
  end if;

  if new.tenant_id <> v_source_tenant_id
     or new.unit_id is distinct from v_source_unit_id then
    raise exception 'Scope akun kas/bank sumber tidak sesuai dengan distribusi';
  end if;

  if new.destination_cash_bank_account_id is not null then
    select
      cba.tenant_id,
      cba.unit_id
    into
      v_destination_tenant_id,
      v_destination_unit_id
    from public.cash_bank_accounts cba
    where cba.id = new.destination_cash_bank_account_id
      and cba.is_active = true;

    if v_destination_tenant_id is null then
      raise exception 'Akun kas/bank tujuan tidak ditemukan atau tidak aktif';
    end if;

    if new.tenant_id <> v_destination_tenant_id
       or new.unit_id is distinct from v_destination_unit_id then
      raise exception 'Scope akun kas/bank tujuan tidak sesuai dengan distribusi';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_posted_profit_sharing_distribution_payment_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Distribusi bagi hasil yang sudah posted tidak boleh dihapus';
    end if;

    return old;
  end if;

  if old.status = 'posted' then
    raise exception 'Distribusi bagi hasil yang sudah posted tidak boleh diubah';
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 7. Triggers
-- ============================================================================

drop trigger if exists trg_profit_sharing_schemes_set_updated_at
on public.profit_sharing_schemes;

create trigger trg_profit_sharing_schemes_set_updated_at
before update on public.profit_sharing_schemes
for each row
execute function public.set_updated_at();

drop trigger if exists trg_profit_sharing_scheme_lines_validate_scope
on public.profit_sharing_scheme_lines;

create trigger trg_profit_sharing_scheme_lines_validate_scope
before insert or update on public.profit_sharing_scheme_lines
for each row
execute function public.validate_profit_sharing_scheme_line_scope();

drop trigger if exists trg_profit_sharing_scheme_lines_validate_total_insert
on public.profit_sharing_scheme_lines;

drop trigger if exists trg_profit_sharing_scheme_lines_validate_total_update
on public.profit_sharing_scheme_lines;

drop trigger if exists trg_profit_sharing_scheme_lines_validate_total_delete
on public.profit_sharing_scheme_lines;

create constraint trigger trg_profit_sharing_scheme_lines_validate_total_insert
after insert on public.profit_sharing_scheme_lines
deferrable initially deferred
for each row
execute function public.validate_profit_sharing_scheme_total();

create constraint trigger trg_profit_sharing_scheme_lines_validate_total_update
after update on public.profit_sharing_scheme_lines
deferrable initially deferred
for each row
execute function public.validate_profit_sharing_scheme_total();

create constraint trigger trg_profit_sharing_scheme_lines_validate_total_delete
after delete on public.profit_sharing_scheme_lines
deferrable initially deferred
for each row
execute function public.validate_profit_sharing_scheme_total();

drop trigger if exists trg_profit_sharing_allocations_set_updated_at
on public.profit_sharing_allocations;

create trigger trg_profit_sharing_allocations_set_updated_at
before update on public.profit_sharing_allocations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_profit_sharing_allocations_validate_scope
on public.profit_sharing_allocations;

create trigger trg_profit_sharing_allocations_validate_scope
before insert or update on public.profit_sharing_allocations
for each row
execute function public.validate_profit_sharing_allocation_scope();

drop trigger if exists trg_prevent_posted_profit_sharing_allocation_mutation
on public.profit_sharing_allocations;

create trigger trg_prevent_posted_profit_sharing_allocation_mutation
before update or delete on public.profit_sharing_allocations
for each row
execute function public.prevent_posted_profit_sharing_allocation_mutation();

drop trigger if exists trg_profit_sharing_distribution_payments_set_updated_at
on public.profit_sharing_distribution_payments;

create trigger trg_profit_sharing_distribution_payments_set_updated_at
before update on public.profit_sharing_distribution_payments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_profit_sharing_distribution_payments_validate_scope
on public.profit_sharing_distribution_payments;

create trigger trg_profit_sharing_distribution_payments_validate_scope
before insert or update on public.profit_sharing_distribution_payments
for each row
execute function public.validate_profit_sharing_distribution_payment_scope();

drop trigger if exists trg_prevent_posted_profit_sharing_distribution_payment_mutation
on public.profit_sharing_distribution_payments;

create trigger trg_prevent_posted_profit_sharing_distribution_payment_mutation
before update or delete on public.profit_sharing_distribution_payments
for each row
execute function public.prevent_posted_profit_sharing_distribution_payment_mutation();

-- ============================================================================
-- 8. Grants and comments
-- ============================================================================

grant select on public.profit_sharing_schemes to authenticated;
grant select on public.profit_sharing_scheme_lines to authenticated;
grant select on public.profit_sharing_allocations to authenticated;
grant select on public.profit_sharing_allocation_lines to authenticated;
grant select on public.profit_sharing_distribution_payments to authenticated;

comment on table public.profit_sharing_schemes is
'Profit Sharing / Bagi Hasil scheme header. Defines allocation formula for annual surplus.';

comment on table public.profit_sharing_scheme_lines is
'Profit Sharing / Bagi Hasil scheme detail lines, including PADes, Dana Sosial, Insentif, and Cadangan.';

comment on table public.profit_sharing_allocations is
'Calculated allocation header from annual closing surplus.';

comment on table public.profit_sharing_allocation_lines is
'Calculated allocation detail lines copied from active profit sharing scheme.';

comment on table public.profit_sharing_distribution_payments is
'Distribution payment or internal transfer for each profit sharing allocation line.';

-- ============================================================================
-- 9. RPC: provision default profit sharing accounts, cash-bank, and scheme
-- ============================================================================

create or replace function public.provision_unit_profit_sharing_defaults(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_created_by uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_created_or_updated_coa_count integer := 0;
  v_created_cash_bank_count integer := 0;
  v_created_scheme_count integer := 0;
  v_created_line_count integer := 0;
  v_row_count integer := 0;

  v_1100 uuid;
  v_2000 uuid;
  v_3000 uuid;

  v_1111 uuid;
  v_2300 uuid;
  v_2310 uuid;
  v_2320 uuid;
  v_3210 uuid;

  v_scheme_id uuid;
  v_unit record;
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
    bu.status
  into v_unit
  from public.business_units bu
  where bu.id = p_unit_id
    and bu.tenant_id = p_tenant_id
    and bu.status = 'aktif'::public.unit_status;

  if v_unit.id is null then
    raise exception 'Unit tidak ditemukan atau tidak aktif';
  end if;

  select id into v_1100
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '1100'
  limit 1;

  select id into v_2000
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '2000'
  limit 1;

  select id into v_3000
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '3000'
  limit 1;

  if v_1100 is null then
    raise exception 'COA 1100 - Kas dan Setara Kas belum tersedia untuk unit ini';
  end if;

  if v_2000 is null then
    raise exception 'COA 2000 - Kewajiban belum tersedia untuk unit ini';
  end if;

  if v_3000 is null then
    raise exception 'COA 3000 - Ekuitas belum tersedia untuk unit ini';
  end if;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    parent_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    is_postable,
    is_active
  )
  values
    (p_tenant_id, p_unit_id, v_1100, '1111', 'Kas Alokasi Bagi Hasil', 'aset', 'ASET', 'debit', true, true),
    (p_tenant_id, p_unit_id, v_2000, '2300', 'Utang Bagi Hasil PADes', 'kewajiban', 'KEWAJIBAN', 'credit', true, true),
    (p_tenant_id, p_unit_id, v_2000, '2310', 'Utang Dana Sosial', 'kewajiban', 'KEWAJIBAN', 'credit', true, true),
    (p_tenant_id, p_unit_id, v_2000, '2320', 'Utang Insentif Pengurus', 'kewajiban', 'KEWAJIBAN', 'credit', true, true),
    (p_tenant_id, p_unit_id, v_3000, '3210', 'Cadangan Modal', 'ekuitas', 'EKUITAS', 'credit', true, true)
  on conflict (tenant_id, unit_id, kode) do update
  set
    parent_id = excluded.parent_id,
    nama = excluded.nama,
    tipe = excluded.tipe,
    account_type = excluded.account_type,
    normal_balance = excluded.normal_balance,
    is_postable = true,
    is_active = true,
    updated_at = now();

  get diagnostics v_row_count = row_count;
  v_created_or_updated_coa_count := v_created_or_updated_coa_count + v_row_count;

  select id into v_1111
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '1111'
    and is_active = true
    and is_postable = true
  limit 1;

  select id into v_2300
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '2300'
    and is_active = true
    and is_postable = true
  limit 1;

  select id into v_2310
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '2310'
    and is_active = true
    and is_postable = true
  limit 1;

  select id into v_2320
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '2320'
    and is_active = true
    and is_postable = true
  limit 1;

  select id into v_3210
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and kode = '3210'
    and is_active = true
    and is_postable = true
  limit 1;

  if v_1111 is null or v_2300 is null or v_2310 is null or v_2320 is null or v_3210 is null then
    raise exception 'Akun default Bagi Hasil belum lengkap setelah provisioning';
  end if;

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
  values (
    p_tenant_id,
    p_unit_id,
    v_1111,
    'KAS-ALOKASI-BH',
    'Kas Alokasi Bagi Hasil',
    'cash',
    'IDR',
    0,
    true,
    p_created_by
  )
  on conflict (tenant_id, unit_id, account_code) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_cash_bank_count := v_created_cash_bank_count + v_row_count;

  if not exists (
    select 1
    from public.profit_sharing_schemes ps
    where ps.tenant_id = p_tenant_id
      and ps.unit_id = p_unit_id
      and ps.is_active = true
  ) then
    insert into public.profit_sharing_schemes (
      tenant_id,
      unit_id,
      scheme_code,
      scheme_name,
      description,
      is_active,
      created_by
    )
    values (
      p_tenant_id,
      p_unit_id,
      'BH-DEFAULT-' || upper(trim(v_unit.kode_unit)),
      'Skema Bagi Hasil Default',
      'Skema default otomatis: PADes 40%, Dana Sosial 20%, Insentif Pengurus 20%, Cadangan Modal 20%.',
      true,
      p_created_by
    )
    returning id into v_scheme_id;

    v_created_scheme_count := 1;

    insert into public.profit_sharing_scheme_lines (
      scheme_id,
      line_no,
      allocation_code,
      allocation_name,
      allocation_percentage,
      target_account_id
    )
    values
      (v_scheme_id, 1, 'PADES', 'Bagi Hasil PADes', 40.00, v_2300),
      (v_scheme_id, 2, 'SOSIAL', 'Dana Sosial', 20.00, v_2310),
      (v_scheme_id, 3, 'INSENTIF', 'Insentif Pengurus', 20.00, v_2320),
      (v_scheme_id, 4, 'CADANGAN', 'Cadangan Modal', 20.00, v_3210);

    get diagnostics v_created_line_count = row_count;
  end if;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'unit_id', p_unit_id,
    'created_or_updated_profit_sharing_coa', v_created_or_updated_coa_count,
    'created_cash_bank_accounts', v_created_cash_bank_count,
    'created_profit_sharing_schemes', v_created_scheme_count,
    'created_profit_sharing_scheme_lines', v_created_line_count
  );
end;
$$;

-- ============================================================================
-- 10. RPC: create profit sharing scheme
-- ============================================================================

create or replace function public.create_profit_sharing_scheme(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_scheme_code text,
  p_scheme_name text,
  p_description text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_scheme_id uuid;
  v_line jsonb;
  v_line_no integer := 0;
  v_total_percentage numeric := 0;
  v_target_account_id uuid;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant wajib diisi';
  end if;

  if nullif(trim(p_scheme_code), '') is null then
    raise exception 'Kode skema bagi hasil wajib diisi';
  end if;

  if nullif(trim(p_scheme_name), '') is null then
    raise exception 'Nama skema bagi hasil wajib diisi';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Detail skema bagi hasil wajib berupa array dan minimal 1 baris';
  end if;

  if p_unit_id is not null then
    if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
      raise exception 'Unit tidak sesuai dengan tenant';
    end if;

    if not public.can_access_unit(p_unit_id, v_actor_id) then
      raise exception 'User tidak memiliki akses ke unit ini';
    end if;
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    p_tenant_id,
    p_unit_id
  );

  if exists (
    select 1
    from public.profit_sharing_schemes pss
    where pss.tenant_id = p_tenant_id
      and pss.unit_id is not distinct from p_unit_id
      and lower(pss.scheme_code) = lower(trim(p_scheme_code))
  ) then
    raise exception 'Kode skema bagi hasil sudah digunakan pada scope tenant/unit ini: %', p_scheme_code;
  end if;

  select coalesce(sum((x.value ->> 'allocation_percentage')::numeric), 0)
  into v_total_percentage
  from jsonb_array_elements(p_lines) as x(value);

  if round(v_total_percentage, 2) <> 100 then
    raise exception 'Total persentase skema bagi hasil harus 100%%. Total saat ini: %', v_total_percentage;
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from p_unit_id
      or ur.tenant_id is not distinct from p_tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  insert into public.profit_sharing_schemes (
    tenant_id,
    unit_id,
    scheme_code,
    scheme_name,
    description,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(trim(p_scheme_code)),
    trim(p_scheme_name),
    nullif(trim(coalesce(p_description, '')), ''),
    true,
    v_actor_id
  )
  returning id into v_scheme_id;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;

    if nullif(trim(v_line ->> 'allocation_code'), '') is null then
      raise exception 'Kode alokasi wajib diisi pada baris %', v_line_no;
    end if;

    if nullif(trim(v_line ->> 'allocation_name'), '') is null then
      raise exception 'Nama alokasi wajib diisi pada baris %', v_line_no;
    end if;

    if coalesce((v_line ->> 'allocation_percentage')::numeric, 0) <= 0
       or coalesce((v_line ->> 'allocation_percentage')::numeric, 0) > 100 then
      raise exception 'Persentase alokasi tidak valid pada baris %', v_line_no;
    end if;

    if nullif(trim(v_line ->> 'target_account_id'), '') is null then
      raise exception 'Target akun wajib diisi pada baris %', v_line_no;
    end if;

    v_target_account_id := (v_line ->> 'target_account_id')::uuid;

    if not exists (
      select 1
      from public.chart_of_accounts coa
      where coa.id = v_target_account_id
        and coa.tenant_id = p_tenant_id
        and coa.unit_id is not distinct from p_unit_id
        and coa.is_active = true
        and coa.is_postable = true
        and coa.account_type in ('KEWAJIBAN'::public.account_type, 'EKUITAS'::public.account_type)
    ) then
      raise exception 'Target akun baris % tidak valid. Akun harus aktif, postable, dan bertipe kewajiban/ekuitas pada scope tenant/unit yang sama', v_line_no;
    end if;

    insert into public.profit_sharing_scheme_lines (
      scheme_id,
      line_no,
      allocation_code,
      allocation_name,
      allocation_percentage,
      target_account_id
    )
    values (
      v_scheme_id,
      v_line_no,
      upper(trim(v_line ->> 'allocation_code')),
      trim(v_line ->> 'allocation_name'),
      round((v_line ->> 'allocation_percentage')::numeric, 2),
      v_target_account_id
    );
  end loop;

  perform public.log_audit_event(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'profit_sharing_scheme_created',
    p_entity_type := 'profit_sharing_schemes',
    p_entity_id := v_scheme_id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_scheme_id,
    p_description := 'Skema bagi hasil dibuat: ' || upper(trim(p_scheme_code)),
    p_metadata := jsonb_build_object(
      'scheme_id', v_scheme_id,
      'scheme_code', upper(trim(p_scheme_code)),
      'scheme_name', trim(p_scheme_name),
      'total_percentage', v_total_percentage,
      'line_count', v_line_no
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Skema bagi hasil berhasil dibuat',
    'scheme_id', v_scheme_id,
    'scheme_code', upper(trim(p_scheme_code)),
    'line_count', v_line_no,
    'total_percentage', v_total_percentage
  );
end;
$$;

grant execute on function public.provision_unit_profit_sharing_defaults(uuid, uuid, uuid) to authenticated;
grant execute on function public.create_profit_sharing_scheme(uuid, uuid, text, text, text, jsonb) to authenticated;

-- ============================================================================
-- 11. RPC: calculate profit sharing allocation
-- ============================================================================

create or replace function public.calculate_profit_sharing_allocation(
  p_annual_closing_id uuid,
  p_scheme_id uuid,
  p_allocation_no text,
  p_allocation_date date default current_date,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_closing public.annual_closings%rowtype;
  v_scheme public.profit_sharing_schemes%rowtype;
  v_allocation_id uuid;
  v_line record;
  v_line_no integer := 0;
  v_total_allocated numeric := 0;
  v_last_line_id uuid;
  v_expected_amount numeric := 0;
  v_rounding_difference numeric := 0;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_annual_closing_id is null then
    raise exception 'Annual closing wajib diisi';
  end if;

  if p_scheme_id is null then
    raise exception 'Skema bagi hasil wajib diisi';
  end if;

  if nullif(trim(p_allocation_no), '') is null then
    raise exception 'Nomor alokasi bagi hasil wajib diisi';
  end if;

  select *
  into v_closing
  from public.annual_closings
  where id = p_annual_closing_id
  for update;

  if not found then
    raise exception 'Annual closing tidak ditemukan';
  end if;

  if v_closing.status not in ('calculated', 'approved', 'posted') then
    raise exception 'Annual closing belum siap untuk alokasi bagi hasil. Status saat ini: %', v_closing.status;
  end if;

  if coalesce(v_closing.surplus_deficit, 0) <= 0 then
    raise exception 'Bagi hasil hanya dapat dihitung jika surplus/laba lebih dari 0. Nilai saat ini: %', v_closing.surplus_deficit;
  end if;

  if v_closing.locked_at is not null or v_closing.status = 'locked' then
    raise exception 'Annual closing sudah locked dan tidak dapat dipakai untuk alokasi baru';
  end if;

  select *
  into v_scheme
  from public.profit_sharing_schemes
  where id = p_scheme_id
  for update;

  if not found then
    raise exception 'Skema bagi hasil tidak ditemukan';
  end if;

  if v_scheme.is_active is not true then
    raise exception 'Skema bagi hasil tidak aktif';
  end if;

  if v_scheme.tenant_id is distinct from v_closing.tenant_id
     or v_scheme.unit_id is distinct from v_closing.unit_id then
    raise exception 'Skema bagi hasil tidak sesuai dengan scope annual closing';
  end if;

  if not public.can_access_unit(v_closing.unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    v_closing.tenant_id,
    v_closing.unit_id
  );

  if exists (
    select 1
    from public.profit_sharing_allocations psa
    where psa.tenant_id = v_closing.tenant_id
      and psa.unit_id is not distinct from v_closing.unit_id
      and lower(psa.allocation_no) = lower(trim(p_allocation_no))
  ) then
    raise exception 'Nomor alokasi bagi hasil sudah digunakan pada scope tenant/unit ini: %', p_allocation_no;
  end if;

  if exists (
    select 1
    from public.profit_sharing_allocations psa
    where psa.annual_closing_id = v_closing.id
      and psa.status <> 'cancelled'
  ) then
    raise exception 'Annual closing ini sudah memiliki alokasi bagi hasil aktif';
  end if;

  if (
    select round(coalesce(sum(pssl.allocation_percentage), 0), 2)
    from public.profit_sharing_scheme_lines pssl
    where pssl.scheme_id = v_scheme.id
  ) <> 100 then
    raise exception 'Total persentase skema bagi hasil tidak sama dengan 100%%';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_closing.unit_id
      or ur.tenant_id is not distinct from v_closing.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  v_expected_amount := round(v_closing.surplus_deficit, 2);

  insert into public.profit_sharing_allocations (
    tenant_id,
    unit_id,
    annual_closing_id,
    scheme_id,
    allocation_no,
    allocation_date,
    surplus_amount,
    status,
    calculated_at,
    calculated_by,
    created_by
  )
  values (
    v_closing.tenant_id,
    v_closing.unit_id,
    v_closing.id,
    v_scheme.id,
    upper(trim(p_allocation_no)),
    coalesce(p_allocation_date, current_date),
    v_expected_amount,
    'calculated',
    now(),
    v_actor_id,
    v_actor_id
  )
  returning id into v_allocation_id;

  for v_line in
    select
      pssl.id as scheme_line_id,
      pssl.line_no,
      pssl.allocation_code,
      pssl.allocation_name,
      pssl.allocation_percentage,
      pssl.target_account_id
    from public.profit_sharing_scheme_lines pssl
    where pssl.scheme_id = v_scheme.id
    order by pssl.line_no
  loop
    v_line_no := v_line_no + 1;

    insert into public.profit_sharing_allocation_lines (
      allocation_id,
      scheme_line_id,
      line_no,
      allocation_code,
      allocation_name,
      allocation_percentage,
      allocation_amount,
      target_account_id
    )
    values (
      v_allocation_id,
      v_line.scheme_line_id,
      v_line.line_no,
      v_line.allocation_code,
      v_line.allocation_name,
      v_line.allocation_percentage,
      round(v_expected_amount * v_line.allocation_percentage / 100, 2),
      v_line.target_account_id
    )
    returning id into v_last_line_id;

    v_total_allocated := v_total_allocated + round(v_expected_amount * v_line.allocation_percentage / 100, 2);
  end loop;

  if v_line_no = 0 then
    raise exception 'Skema bagi hasil tidak memiliki detail alokasi';
  end if;

  v_rounding_difference := round(v_expected_amount - v_total_allocated, 2);

  if v_rounding_difference <> 0 then
    update public.profit_sharing_allocation_lines
    set allocation_amount = allocation_amount + v_rounding_difference
    where id = v_last_line_id;

    v_total_allocated := v_total_allocated + v_rounding_difference;
  end if;

  perform public.log_audit_event(
    p_tenant_id := v_closing.tenant_id,
    p_unit_id := v_closing.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'profit_sharing_allocation_calculated',
    p_entity_type := 'profit_sharing_allocations',
    p_entity_id := v_allocation_id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_allocation_id,
    p_description := 'Alokasi bagi hasil dihitung: ' || upper(trim(p_allocation_no)),
    p_metadata := jsonb_build_object(
      'allocation_id', v_allocation_id,
      'allocation_no', upper(trim(p_allocation_no)),
      'annual_closing_id', v_closing.id,
      'scheme_id', v_scheme.id,
      'surplus_amount', v_expected_amount,
      'total_allocated', v_total_allocated,
      'rounding_difference', v_rounding_difference,
      'line_count', v_line_no
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Alokasi bagi hasil berhasil dihitung',
    'allocation_id', v_allocation_id,
    'allocation_no', upper(trim(p_allocation_no)),
    'annual_closing_id', v_closing.id,
    'scheme_id', v_scheme.id,
    'surplus_amount', v_expected_amount,
    'total_allocated', v_total_allocated,
    'rounding_difference', v_rounding_difference,
    'line_count', v_line_no
  );
end;
$$;

-- ============================================================================
-- 12. RPC: approve profit sharing allocation
-- ============================================================================

create or replace function public.approve_profit_sharing_allocation(
  p_allocation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_allocation public.profit_sharing_allocations%rowtype;
  v_line_total numeric := 0;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_allocation_id is null then
    raise exception 'Alokasi bagi hasil wajib diisi';
  end if;

  select *
  into v_allocation
  from public.profit_sharing_allocations
  where id = p_allocation_id
  for update;

  if not found then
    raise exception 'Alokasi bagi hasil tidak ditemukan';
  end if;

  if v_allocation.status <> 'calculated' then
    raise exception 'Hanya alokasi berstatus calculated yang dapat disetujui. Status saat ini: %', v_allocation.status;
  end if;

  if v_allocation.journal_entry_id is not null then
    raise exception 'Alokasi bagi hasil sudah memiliki jurnal';
  end if;

  if not public.can_access_unit(v_allocation.unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    v_allocation.tenant_id,
    v_allocation.unit_id
  );

  select round(coalesce(sum(allocation_amount), 0), 2)
  into v_line_total
  from public.profit_sharing_allocation_lines
  where allocation_id = v_allocation.id;

  if v_line_total <> round(v_allocation.surplus_amount, 2) then
    raise exception 'Total detail alokasi tidak sama dengan surplus. Detail: %, Surplus: %',
      v_line_total,
      v_allocation.surplus_amount;
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_allocation.unit_id
      or ur.tenant_id is not distinct from v_allocation.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  update public.profit_sharing_allocations
  set
    status = 'approved',
    approved_at = now(),
    approved_by = v_actor_id,
    updated_at = now()
  where id = v_allocation.id;

  perform public.log_audit_event(
    p_tenant_id := v_allocation.tenant_id,
    p_unit_id := v_allocation.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'profit_sharing_allocation_approved',
    p_entity_type := 'profit_sharing_allocations',
    p_entity_id := v_allocation.id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_allocation.id,
    p_description := 'Alokasi bagi hasil disetujui: ' || v_allocation.allocation_no,
    p_metadata := jsonb_build_object(
      'allocation_id', v_allocation.id,
      'allocation_no', v_allocation.allocation_no,
      'surplus_amount', v_allocation.surplus_amount,
      'line_total', v_line_total
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Alokasi bagi hasil berhasil disetujui',
    'allocation_id', v_allocation.id,
    'allocation_no', v_allocation.allocation_no,
    'status', 'approved',
    'surplus_amount', v_allocation.surplus_amount,
    'line_total', v_line_total
  );
end;
$$;

-- ============================================================================
-- 13. RPC: post profit sharing allocation journal
-- ============================================================================

create or replace function public.post_profit_sharing_allocation(
  p_allocation_id uuid,
  p_retained_earnings_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_allocation public.profit_sharing_allocations%rowtype;
  v_closing public.annual_closings%rowtype;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_journal_no text;
  v_line record;
  v_line_no integer := 1;
  v_line_total numeric := 0;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_allocation_id is null then
    raise exception 'Alokasi bagi hasil wajib diisi';
  end if;

  if p_retained_earnings_account_id is null then
    raise exception 'Akun saldo laba ditahan wajib diisi';
  end if;

  select *
  into v_allocation
  from public.profit_sharing_allocations
  where id = p_allocation_id
  for update;

  if not found then
    raise exception 'Alokasi bagi hasil tidak ditemukan';
  end if;

  if v_allocation.status <> 'approved' then
    raise exception 'Hanya alokasi berstatus approved yang dapat diposting. Status saat ini: %', v_allocation.status;
  end if;

  if v_allocation.journal_entry_id is not null then
    raise exception 'Alokasi bagi hasil sudah memiliki jurnal';
  end if;

  select *
  into v_closing
  from public.annual_closings
  where id = v_allocation.annual_closing_id
  for update;

  if not found then
    raise exception 'Annual closing terkait tidak ditemukan';
  end if;

  if v_closing.status not in ('calculated', 'approved', 'posted') then
    raise exception 'Annual closing belum siap untuk posting bagi hasil. Status saat ini: %', v_closing.status;
  end if;

  if v_closing.locked_at is not null or v_closing.status = 'locked' then
    raise exception 'Annual closing sudah locked';
  end if;

  if v_closing.tenant_id is distinct from v_allocation.tenant_id
     or v_closing.unit_id is distinct from v_allocation.unit_id then
    raise exception 'Scope annual closing tidak sesuai dengan alokasi bagi hasil';
  end if;

  if not public.can_access_unit(v_allocation.unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    v_allocation.tenant_id,
    v_allocation.unit_id
  );

  if not exists (
    select 1
    from public.chart_of_accounts coa
    where coa.id = p_retained_earnings_account_id
      and coa.tenant_id = v_allocation.tenant_id
      and coa.unit_id is not distinct from v_allocation.unit_id
      and coa.kode = '3200'
      and coa.account_type = 'EKUITAS'::public.account_type
      and coa.is_active = true
      and coa.is_postable = true
  ) then
    raise exception 'Akun saldo laba ditahan tidak valid. Harus akun 3200 aktif/postable pada scope tenant/unit yang sama';
  end if;

  select round(coalesce(sum(allocation_amount), 0), 2)
  into v_line_total
  from public.profit_sharing_allocation_lines
  where allocation_id = v_allocation.id;

  if v_line_total <> round(v_allocation.surplus_amount, 2) then
    raise exception 'Total detail alokasi tidak sama dengan surplus. Detail: %, Surplus: %',
      v_line_total,
      v_allocation.surplus_amount;
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.tenant_id = v_allocation.tenant_id
      and je.unit_id is not distinct from v_allocation.unit_id
      and je.source_type = 'profit_sharing_allocation'
      and je.source_id = v_allocation.id
  ) then
    raise exception 'Jurnal bagi hasil untuk alokasi ini sudah pernah dibuat';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_allocation.tenant_id
    and ap.unit_id is not distinct from v_allocation.unit_id
    and v_allocation.allocation_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal alokasi bagi hasil tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_allocation.unit_id
      or ur.tenant_id is not distinct from v_allocation.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  v_journal_no := 'JBH-' || v_allocation.allocation_no;

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
    created_by
  )
  values (
    v_allocation.tenant_id,
    v_allocation.unit_id,
    v_period_id,
    v_journal_no,
    v_allocation.allocation_date,
    'profit_sharing_allocation',
    v_allocation.id,
    'Posting alokasi bagi hasil ' || v_allocation.allocation_no,
    'draft',
    v_actor_id
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    line_no,
    description,
    debit,
    credit
  )
  values (
    v_journal_entry_id,
    p_retained_earnings_account_id,
    1,
    'Alokasi bagi hasil dari saldo laba ditahan ' || v_allocation.allocation_no,
    round(v_allocation.surplus_amount, 2),
    0
  );

  for v_line in
    select
      psal.line_no,
      psal.allocation_code,
      psal.allocation_name,
      psal.allocation_amount,
      psal.target_account_id
    from public.profit_sharing_allocation_lines psal
    where psal.allocation_id = v_allocation.id
    order by psal.line_no
  loop
    v_line_no := v_line_no + 1;

    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values (
      v_journal_entry_id,
      v_line.target_account_id,
      v_line_no,
      'Alokasi bagi hasil - ' || v_line.allocation_name,
      0,
      round(v_line.allocation_amount, 2)
    );
  end loop;

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_journal_entry_id;

  update public.profit_sharing_allocations
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_allocation.id;

  perform public.log_audit_event(
    p_tenant_id := v_allocation.tenant_id,
    p_unit_id := v_allocation.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'profit_sharing_allocation_posted',
    p_entity_type := 'profit_sharing_allocations',
    p_entity_id := v_allocation.id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_allocation.id,
    p_description := 'Alokasi bagi hasil diposting: ' || v_allocation.allocation_no,
    p_metadata := jsonb_build_object(
      'allocation_id', v_allocation.id,
      'allocation_no', v_allocation.allocation_no,
      'annual_closing_id', v_allocation.annual_closing_id,
      'journal_entry_id', v_journal_entry_id,
      'journal_no', v_journal_no,
      'surplus_amount', v_allocation.surplus_amount,
      'line_total', v_line_total,
      'retained_earnings_account_id', p_retained_earnings_account_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Alokasi bagi hasil berhasil diposting',
    'allocation_id', v_allocation.id,
    'allocation_no', v_allocation.allocation_no,
    'status', 'posted',
    'journal_entry_id', v_journal_entry_id,
    'journal_no', v_journal_no,
    'surplus_amount', v_allocation.surplus_amount,
    'line_total', v_line_total
  );
end;
$$;

grant execute on function public.calculate_profit_sharing_allocation(uuid, uuid, text, date, text) to authenticated;
grant execute on function public.approve_profit_sharing_allocation(uuid) to authenticated;
grant execute on function public.post_profit_sharing_allocation(uuid, uuid) to authenticated;

-- ============================================================================
-- 14. RPC: post profit sharing distribution payment
-- ============================================================================

create or replace function public.post_profit_sharing_distribution_payment(
  p_allocation_line_id uuid,
  p_distribution_no text,
  p_distribution_date date,
  p_source_cash_bank_account_id uuid,
  p_destination_cash_bank_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;

  v_line public.profit_sharing_allocation_lines%rowtype;
  v_allocation public.profit_sharing_allocations%rowtype;

  v_source_cba public.cash_bank_accounts%rowtype;
  v_destination_cba public.cash_bank_accounts%rowtype;

  v_distribution_id uuid;
  v_distribution_type text;

  v_period_id uuid;
  v_journal_entry_id uuid;
  v_journal_no text;

  v_source_cbt_id uuid;
  v_destination_cbt_id uuid;

  v_amount numeric := 0;
  v_target_account_type public.account_type;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_allocation_line_id is null then
    raise exception 'Detail alokasi bagi hasil wajib diisi';
  end if;

  if nullif(trim(p_distribution_no), '') is null then
    raise exception 'Nomor distribusi wajib diisi';
  end if;

  if p_source_cash_bank_account_id is null then
    raise exception 'Akun kas/bank sumber wajib diisi';
  end if;

  select *
  into v_line
  from public.profit_sharing_allocation_lines
  where id = p_allocation_line_id
  for update;

  if not found then
    raise exception 'Detail alokasi bagi hasil tidak ditemukan';
  end if;

  select *
  into v_allocation
  from public.profit_sharing_allocations
  where id = v_line.allocation_id
  for update;

  if not found then
    raise exception 'Header alokasi bagi hasil tidak ditemukan';
  end if;

  if v_allocation.status <> 'posted' then
    raise exception 'Distribusi hanya dapat dilakukan untuk alokasi yang sudah posted. Status saat ini: %', v_allocation.status;
  end if;

  if exists (
    select 1
    from public.profit_sharing_distribution_payments psdp
    where psdp.allocation_line_id = v_line.id
      and psdp.status <> 'cancelled'
  ) then
    raise exception 'Detail alokasi ini sudah pernah didistribusikan';
  end if;

  if v_line.target_account_id is null then
    raise exception 'Detail alokasi tidak memiliki target account';
  end if;

  select coa.account_type
  into v_target_account_type
  from public.chart_of_accounts coa
  where coa.id = v_line.target_account_id
    and coa.tenant_id = v_allocation.tenant_id
    and coa.unit_id is not distinct from v_allocation.unit_id
    and coa.is_active = true
    and coa.is_postable = true;

  if v_target_account_type is null then
    raise exception 'Target account detail alokasi tidak valid atau tidak aktif';
  end if;

  v_amount := round(v_line.allocation_amount, 2);

  if v_amount <= 0 then
    raise exception 'Nominal distribusi harus lebih dari 0';
  end if;

  select *
  into v_source_cba
  from public.cash_bank_accounts
  where id = p_source_cash_bank_account_id
    and tenant_id = v_allocation.tenant_id
    and unit_id is not distinct from v_allocation.unit_id
    and is_active = true
  for update;

  if not found then
    raise exception 'Akun kas/bank sumber tidak ditemukan atau tidak aktif';
  end if;

  if v_source_cba.account_id is null then
    raise exception 'Akun kas/bank sumber belum terhubung ke COA';
  end if;

  if v_target_account_type = 'KEWAJIBAN'::public.account_type then
    v_distribution_type := 'external_payment';

    if p_destination_cash_bank_account_id is not null then
      raise exception 'Distribusi external_payment tidak boleh memiliki akun kas/bank tujuan internal';
    end if;

  elsif v_target_account_type = 'EKUITAS'::public.account_type then
    v_distribution_type := 'internal_transfer';

    if p_destination_cash_bank_account_id is null then
      raise exception 'Distribusi internal_transfer wajib memiliki akun kas/bank tujuan';
    end if;

    select *
    into v_destination_cba
    from public.cash_bank_accounts
    where id = p_destination_cash_bank_account_id
      and tenant_id = v_allocation.tenant_id
      and unit_id is not distinct from v_allocation.unit_id
      and is_active = true
    for update;

    if not found then
      raise exception 'Akun kas/bank tujuan tidak ditemukan atau tidak aktif';
    end if;

    if v_destination_cba.account_id is null then
      raise exception 'Akun kas/bank tujuan belum terhubung ke COA';
    end if;

    if v_destination_cba.id = v_source_cba.id then
      raise exception 'Akun kas/bank sumber dan tujuan tidak boleh sama';
    end if;

  else
    raise exception 'Target account detail alokasi harus KEWAJIBAN atau EKUITAS. Saat ini: %', v_target_account_type;
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    v_allocation.tenant_id,
    v_allocation.unit_id
  );

  if not public.can_access_unit(v_allocation.unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_cash_bank_account_sufficient_balance(
    v_allocation.tenant_id,
    v_allocation.unit_id,
    v_source_cba.account_id,
    v_amount
  );

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_allocation.tenant_id
    and ap.unit_id is not distinct from v_allocation.unit_id
    and coalesce(p_distribution_date, current_date) between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal distribusi tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_allocation.unit_id
      or ur.tenant_id is not distinct from v_allocation.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  v_journal_no := 'JDBH-' || upper(trim(p_distribution_no));

  insert into public.profit_sharing_distribution_payments (
    tenant_id,
    unit_id,
    allocation_id,
    allocation_line_id,
    distribution_no,
    distribution_date,
    distribution_type,
    source_cash_bank_account_id,
    destination_cash_bank_account_id,
    amount,
    status,
    created_by
  )
  values (
    v_allocation.tenant_id,
    v_allocation.unit_id,
    v_allocation.id,
    v_line.id,
    upper(trim(p_distribution_no)),
    coalesce(p_distribution_date, current_date),
    v_distribution_type,
    v_source_cba.id,
    case
      when v_distribution_type = 'internal_transfer' then v_destination_cba.id
      else null
    end,
    v_amount,
    'draft',
    v_actor_id
  )
  returning id into v_distribution_id;

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
    created_by
  )
  values (
    v_allocation.tenant_id,
    v_allocation.unit_id,
    v_period_id,
    v_journal_no,
    coalesce(p_distribution_date, current_date),
    'profit_sharing_distribution_payment',
    v_distribution_id,
    'Distribusi bagi hasil ' || upper(trim(p_distribution_no)) || ' - ' || v_line.allocation_name,
    'draft',
    v_actor_id
  )
  returning id into v_journal_entry_id;

  if v_distribution_type = 'external_payment' then
    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values
    (
      v_journal_entry_id,
      v_line.target_account_id,
      1,
      'Pembayaran ' || v_line.allocation_name,
      v_amount,
      0
    ),
    (
      v_journal_entry_id,
      v_source_cba.account_id,
      2,
      'Kas/bank keluar untuk pembayaran ' || v_line.allocation_name,
      0,
      v_amount
    );

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
      v_allocation.tenant_id,
      v_allocation.unit_id,
      v_source_cba.id,
      'CB-' || upper(trim(p_distribution_no)),
      coalesce(p_distribution_date, current_date),
      'payment',
      'profit_sharing_distribution_payment',
      v_distribution_id,
      'Pembayaran ' || v_line.allocation_name,
      v_amount,
      'posted',
      v_journal_entry_id,
      now(),
      v_actor_id,
      v_actor_id
    )
    returning id into v_source_cbt_id;

  else
    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values
    (
      v_journal_entry_id,
      v_destination_cba.account_id,
      1,
      'Pemindahan ke Kas Alokasi Bagi Hasil - ' || v_line.allocation_name,
      v_amount,
      0
    ),
    (
      v_journal_entry_id,
      v_source_cba.account_id,
      2,
      'Kas/bank sumber untuk alokasi internal bagi hasil',
      0,
      v_amount
    );

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
      v_allocation.tenant_id,
      v_allocation.unit_id,
      v_source_cba.id,
      'CB-OUT-' || upper(trim(p_distribution_no)),
      coalesce(p_distribution_date, current_date),
      'transfer_out',
      'profit_sharing_distribution_payment',
      v_distribution_id,
      'Transfer keluar ke Kas Alokasi Bagi Hasil - ' || v_line.allocation_name,
      v_amount,
      'posted',
      v_journal_entry_id,
      now(),
      v_actor_id,
      v_actor_id
    )
    returning id into v_source_cbt_id;

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
      v_allocation.tenant_id,
      v_allocation.unit_id,
      v_destination_cba.id,
      'CB-IN-' || upper(trim(p_distribution_no)),
      coalesce(p_distribution_date, current_date),
      'transfer_in',
      'profit_sharing_distribution_payment',
      v_distribution_id,
      'Transfer masuk Kas Alokasi Bagi Hasil - ' || v_line.allocation_name,
      v_amount,
      'posted',
      v_journal_entry_id,
      now(),
      v_actor_id,
      v_actor_id
    )
    returning id into v_destination_cbt_id;
  end if;

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_journal_entry_id;

  update public.profit_sharing_distribution_payments
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    source_cash_bank_transaction_id = v_source_cbt_id,
    destination_cash_bank_transaction_id = v_destination_cbt_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_distribution_id;

  perform public.log_audit_event(
    p_tenant_id := v_allocation.tenant_id,
    p_unit_id := v_allocation.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'profit_sharing_distribution_posted',
    p_entity_type := 'profit_sharing_distribution_payments',
    p_entity_id := v_distribution_id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_distribution_id,
    p_description := 'Distribusi bagi hasil diposting: ' || upper(trim(p_distribution_no)),
    p_metadata := jsonb_build_object(
      'distribution_id', v_distribution_id,
      'distribution_no', upper(trim(p_distribution_no)),
      'distribution_type', v_distribution_type,
      'allocation_id', v_allocation.id,
      'allocation_line_id', v_line.id,
      'allocation_code', v_line.allocation_code,
      'allocation_name', v_line.allocation_name,
      'amount', v_amount,
      'journal_entry_id', v_journal_entry_id,
      'journal_no', v_journal_no,
      'source_cash_bank_account_id', v_source_cba.id,
      'destination_cash_bank_account_id', case when v_distribution_type = 'internal_transfer' then v_destination_cba.id else null end,
      'source_cash_bank_transaction_id', v_source_cbt_id,
      'destination_cash_bank_transaction_id', v_destination_cbt_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Distribusi bagi hasil berhasil diposting',
    'distribution_id', v_distribution_id,
    'distribution_no', upper(trim(p_distribution_no)),
    'distribution_type', v_distribution_type,
    'allocation_id', v_allocation.id,
    'allocation_line_id', v_line.id,
    'allocation_code', v_line.allocation_code,
    'allocation_name', v_line.allocation_name,
    'amount', v_amount,
    'journal_entry_id', v_journal_entry_id,
    'journal_no', v_journal_no,
    'source_cash_bank_transaction_id', v_source_cbt_id,
    'destination_cash_bank_transaction_id', v_destination_cbt_id,
    'status', 'posted'
  );
end;
$$;

grant execute on function public.post_profit_sharing_distribution_payment(uuid, text, date, uuid, uuid) to authenticated;

-- ============================================================================
-- 15. Reporting view: profit sharing allocation flow
-- ============================================================================

create or replace view public.v_profit_sharing_allocation_flow as
select
  psa.tenant_id,
  psa.unit_id,

  t.nama_bumdes,
  t.kode_bumdes,
  bu.kode_unit,
  bu.nama_unit,

  psa.id as allocation_id,
  psa.allocation_no,
  psa.allocation_date,
  psa.status as allocation_status,
  psa.surplus_amount,

  ac.id as annual_closing_id,
  ac.closing_year,
  ac.revenue_total,
  ac.expense_total,
  ac.surplus_deficit,
  ac.retained_earnings_amount,

  pss.id as scheme_id,
  pss.scheme_code,
  pss.scheme_name,

  psa.journal_entry_id as allocation_journal_entry_id,
  aje.journal_no as allocation_journal_no,
  aje.status as allocation_journal_status,
  aje.journal_date as allocation_journal_date,

  psal.id as allocation_line_id,
  psal.line_no,
  psal.allocation_code,
  psal.allocation_name,
  psal.allocation_percentage,
  psal.allocation_amount,

  psal.target_account_id,
  target_coa.kode as target_account_code,
  target_coa.nama as target_account_name,
  target_coa.account_type::text as target_account_type,

  psdp.id as distribution_id,
  psdp.distribution_no,
  psdp.distribution_date,
  psdp.distribution_type,
  psdp.status as distribution_status,
  coalesce(psdp.amount, 0)::numeric(18,2) as distributed_amount,
  (psal.allocation_amount - coalesce(psdp.amount, 0))::numeric(18,2) as remaining_amount,

  psdp.journal_entry_id as distribution_journal_entry_id,
  dje.journal_no as distribution_journal_no,
  dje.status as distribution_journal_status,
  dje.journal_date as distribution_journal_date,

  psdp.source_cash_bank_account_id,
  scba.account_code as source_cash_bank_code,
  scba.account_name as source_cash_bank_name,
  scba.account_kind as source_cash_bank_kind,
  scba.account_id as source_cash_bank_coa_id,
  source_coa.kode as source_cash_bank_coa_code,
  source_coa.nama as source_cash_bank_coa_name,

  psdp.destination_cash_bank_account_id,
  dcba.account_code as destination_cash_bank_code,
  dcba.account_name as destination_cash_bank_name,
  dcba.account_kind as destination_cash_bank_kind,
  dcba.account_id as destination_cash_bank_coa_id,
  destination_coa.kode as destination_cash_bank_coa_code,
  destination_coa.nama as destination_cash_bank_coa_name,

  psdp.source_cash_bank_transaction_id,
  scbt.transaction_no as source_cash_bank_transaction_no,
  scbt.transaction_type as source_cash_bank_transaction_type,
  scbt.status as source_cash_bank_transaction_status,

  psdp.destination_cash_bank_transaction_id,
  dcbt.transaction_no as destination_cash_bank_transaction_no,
  dcbt.transaction_type as destination_cash_bank_transaction_type,
  dcbt.status as destination_cash_bank_transaction_status,

  case
    when psa.status in ('draft', 'calculated') then 'ALLOCATION_NOT_APPROVED'
    when psa.status = 'approved' then 'ALLOCATION_APPROVED_NOT_POSTED'
    when psa.status = 'posted' and psa.journal_entry_id is null then 'CHECK_ALLOCATION_JOURNAL'
    when psa.status = 'posted' and psdp.id is null then 'READY_FOR_DISTRIBUTION'
    when psa.status = 'posted' and psdp.status = 'posted' and psdp.distribution_type = 'external_payment' then 'EXTERNAL_PAYMENT_POSTED'
    when psa.status = 'posted' and psdp.status = 'posted' and psdp.distribution_type = 'internal_transfer' then 'INTERNAL_TRANSFER_POSTED'
    else 'CHECK_PROFIT_SHARING_FLOW'
  end as flow_status,

  case
    when target_coa.account_type = 'KEWAJIBAN'::public.account_type then 'LIABILITY_EXTERNAL_PAYMENT'
    when target_coa.account_type = 'EKUITAS'::public.account_type then 'EQUITY_INTERNAL_RESERVE'
    else 'OTHER'
  end as flow_category,

  psa.calculated_at,
  psa.calculated_by,
  psa.approved_at,
  psa.approved_by,
  psa.posted_at as allocation_posted_at,
  psa.posted_by as allocation_posted_by,

  psdp.posted_at as distribution_posted_at,
  psdp.posted_by as distribution_posted_by,

  psa.created_at as allocation_created_at,
  psa.updated_at as allocation_updated_at
from public.profit_sharing_allocations psa
join public.tenants t
  on t.id = psa.tenant_id
left join public.business_units bu
  on bu.id = psa.unit_id
join public.annual_closings ac
  on ac.id = psa.annual_closing_id
join public.profit_sharing_schemes pss
  on pss.id = psa.scheme_id
join public.profit_sharing_allocation_lines psal
  on psal.allocation_id = psa.id
left join public.chart_of_accounts target_coa
  on target_coa.id = psal.target_account_id
left join public.journal_entries aje
  on aje.id = psa.journal_entry_id
left join public.profit_sharing_distribution_payments psdp
  on psdp.allocation_line_id = psal.id
left join public.journal_entries dje
  on dje.id = psdp.journal_entry_id
left join public.cash_bank_accounts scba
  on scba.id = psdp.source_cash_bank_account_id
left join public.chart_of_accounts source_coa
  on source_coa.id = scba.account_id
left join public.cash_bank_accounts dcba
  on dcba.id = psdp.destination_cash_bank_account_id
left join public.chart_of_accounts destination_coa
  on destination_coa.id = dcba.account_id
left join public.cash_bank_transactions scbt
  on scbt.id = psdp.source_cash_bank_transaction_id
left join public.cash_bank_transactions dcbt
  on dcbt.id = psdp.destination_cash_bank_transaction_id;

-- ============================================================================
-- 16. Reporting view: profit sharing allocation summary
-- ============================================================================

create or replace view public.v_profit_sharing_allocation_summary as
select
  tenant_id,
  unit_id,
  nama_bumdes,
  kode_bumdes,
  kode_unit,
  nama_unit,
  allocation_id,
  allocation_no,
  allocation_date,
  allocation_status,
  annual_closing_id,
  closing_year,
  revenue_total,
  expense_total,
  surplus_deficit,
  retained_earnings_amount,
  scheme_id,
  scheme_code,
  scheme_name,

  (min(allocation_journal_entry_id::text))::uuid as allocation_journal_entry_id,
  max(allocation_journal_no) as allocation_journal_no,
  max(allocation_journal_status) as allocation_journal_status,

  sum(allocation_amount)::numeric(18,2) as total_allocated_amount,
  sum(distributed_amount)::numeric(18,2) as total_distributed_amount,
  sum(remaining_amount)::numeric(18,2) as total_remaining_amount,

  sum(
    case
      when flow_category = 'LIABILITY_EXTERNAL_PAYMENT' then allocation_amount
      else 0
    end
  )::numeric(18,2) as external_payment_allocation_amount,

  sum(
    case
      when flow_category = 'LIABILITY_EXTERNAL_PAYMENT' then distributed_amount
      else 0
    end
  )::numeric(18,2) as external_payment_distributed_amount,

  sum(
    case
      when flow_category = 'EQUITY_INTERNAL_RESERVE' then allocation_amount
      else 0
    end
  )::numeric(18,2) as internal_reserve_allocation_amount,

  sum(
    case
      when flow_category = 'EQUITY_INTERNAL_RESERVE' then distributed_amount
      else 0
    end
  )::numeric(18,2) as internal_reserve_distributed_amount,

  count(*) as allocation_line_count,
  count(distribution_id) as distribution_count,

  case
    when allocation_status in ('draft', 'calculated') then 'ALLOCATION_NOT_APPROVED'
    when allocation_status = 'approved' then 'ALLOCATION_APPROVED_NOT_POSTED'
    when allocation_status = 'posted'
      and count(distribution_id) = 0 then 'READY_FOR_DISTRIBUTION'
    when allocation_status = 'posted'
      and sum(remaining_amount) = 0 then 'FULLY_DISTRIBUTED'
    when allocation_status = 'posted'
      and sum(remaining_amount) > 0 then 'PARTIALLY_DISTRIBUTED'
    else 'CHECK_PROFIT_SHARING_SUMMARY'
  end as summary_status,

  case
    when allocation_status = 'posted'
      and max(allocation_journal_status) = 'posted'
      and sum(allocation_amount) = max(surplus_amount)
      and sum(remaining_amount) = 0 then 'PASS'
    when allocation_status = 'posted'
      and max(allocation_journal_status) = 'posted'
      and sum(allocation_amount) = max(surplus_amount)
      and sum(remaining_amount) > 0 then 'PASS_PENDING_DISTRIBUTION'
    else 'CHECK'
  end as audit_result,

  max(calculated_at) as calculated_at,
  max(approved_at) as approved_at,
  max(allocation_posted_at) as allocation_posted_at,
  max(distribution_posted_at) as last_distribution_posted_at
from public.v_profit_sharing_allocation_flow
group by
  tenant_id,
  unit_id,
  nama_bumdes,
  kode_bumdes,
  kode_unit,
  nama_unit,
  allocation_id,
  allocation_no,
  allocation_date,
  allocation_status,
  annual_closing_id,
  closing_year,
  revenue_total,
  expense_total,
  surplus_deficit,
  retained_earnings_amount,
  scheme_id,
  scheme_code,
  scheme_name;

-- ============================================================================
-- 17. Final grants/comments
-- ============================================================================

grant select on public.v_profit_sharing_allocation_flow to authenticated;
grant select on public.v_profit_sharing_allocation_summary to authenticated;

comment on function public.provision_unit_profit_sharing_defaults(uuid, uuid, uuid) is
'Provision default Profit Sharing / Bagi Hasil COA, Kas Alokasi Bagi Hasil account, and default allocation scheme.';

comment on function public.create_profit_sharing_scheme(uuid, uuid, text, text, text, jsonb) is
'Create a tenant/unit profit sharing scheme with lines totaling 100%.';

comment on function public.calculate_profit_sharing_allocation(uuid, uuid, text, date, text) is
'Calculate profit sharing allocation from annual closing surplus using an active scheme.';

comment on function public.approve_profit_sharing_allocation(uuid) is
'Approve calculated profit sharing allocation before journal posting.';

comment on function public.post_profit_sharing_allocation(uuid, uuid) is
'Post profit sharing allocation journal by debiting retained earnings and crediting target liability/equity accounts.';

comment on function public.post_profit_sharing_distribution_payment(uuid, text, date, uuid, uuid) is
'Post distribution payment for liability allocations or internal transfer for equity reserve allocations.';

comment on view public.v_profit_sharing_allocation_flow is
'Detailed Profit Sharing / Bagi Hasil flow view from annual closing, allocation, journal posting, and distribution payment/transfer.';

comment on view public.v_profit_sharing_allocation_summary is
'Summarized Profit Sharing / Bagi Hasil allocation and distribution status.';
