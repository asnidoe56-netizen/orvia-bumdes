-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000018: Capital Expenditure Engine
--
-- DB-FIRST EVIDENCE:
--   Active Belanja Modal engine already uses:
--   - capital_expenditure_categories
--   - capital_expenditures
--   - capital_expenditure_lines
--   - fixed_assets
--   - create_capital_expenditure()
--   - post_capital_expenditure()
--   - create_and_post_capital_expenditure()
--
-- Scope:
--   This migration packages capital expenditure / fixed asset acquisition.
--   Capital debt payment is intentionally deferred to next migration because
--   active audit did not show debt-payment RPCs in this bundle.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Capital expenditure categories
-- ============================================================================

create table if not exists public.capital_expenditure_categories (
  id uuid primary key default gen_random_uuid(),

  category_code text not null,
  category_name text not null,

  asset_account_code text not null,
  accumulated_depreciation_account_code text,
  depreciation_expense_account_code text,

  default_useful_life_months integer not null,

  is_depreciable boolean not null default true,
  is_construction_in_progress boolean not null default false,
  is_intangible boolean not null default false,
  is_system_template boolean not null default true,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capital_expenditure_categories_useful_life_check
    check (default_useful_life_months > 0),

  constraint capital_expenditure_categories_code_unique
    unique (category_code)
);

drop trigger if exists trg_capital_expenditure_categories_set_updated_at
on public.capital_expenditure_categories;

create trigger trg_capital_expenditure_categories_set_updated_at
before update on public.capital_expenditure_categories
for each row
execute function public.set_updated_at();

insert into public.capital_expenditure_categories (
  category_code,
  category_name,
  asset_account_code,
  accumulated_depreciation_account_code,
  depreciation_expense_account_code,
  default_useful_life_months,
  is_depreciable,
  is_construction_in_progress,
  is_intangible,
  is_system_template,
  is_active
)
values
  (
    'PERALATAN_MESIN',
    'Peralatan dan Mesin',
    '1501',
    '1590',
    '6300',
    48,
    true,
    false,
    false,
    true,
    true
  ),
  (
    'KENDARAAN',
    'Kendaraan Operasional',
    '1501',
    '1590',
    '6300',
    60,
    true,
    false,
    false,
    true,
    true
  ),
  (
    'BANGUNAN',
    'Gedung dan Bangunan',
    '1501',
    '1590',
    '6300',
    240,
    true,
    false,
    false,
    true,
    true
  ),
  (
    'KONSTRUKSI_DALAM_PENGERJAAN',
    'Konstruksi Dalam Pengerjaan',
    '1501',
    null,
    null,
    240,
    false,
    true,
    false,
    true,
    true
  ),
  (
    'ASET_TAK_BERWUJUD',
    'Aset Tak Berwujud',
    '1501',
    '1590',
    '6300',
    60,
    true,
    false,
    true,
    true,
    true
  )
on conflict (category_code) do update
set
  category_name = excluded.category_name,
  asset_account_code = excluded.asset_account_code,
  accumulated_depreciation_account_code = excluded.accumulated_depreciation_account_code,
  depreciation_expense_account_code = excluded.depreciation_expense_account_code,
  default_useful_life_months = excluded.default_useful_life_months,
  is_depreciable = excluded.is_depreciable,
  is_construction_in_progress = excluded.is_construction_in_progress,
  is_intangible = excluded.is_intangible,
  is_system_template = excluded.is_system_template,
  is_active = excluded.is_active,
  updated_at = now();

-- ============================================================================
-- 2. Fixed assets
-- ============================================================================

create table if not exists public.fixed_assets (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  asset_code text not null,
  asset_name text not null,
  acquisition_date date not null,

  acquisition_cost numeric(18,2) not null default 0,
  residual_value numeric(18,2) not null default 0,
  useful_life_months integer not null,

  depreciation_method text not null default 'straight_line',

  asset_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  accumulated_depreciation_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  depreciation_expense_account_id uuid references public.chart_of_accounts(id) on delete restrict,

  status text not null default 'active'
    check (status = any (array['active'::text, 'disposed'::text])),

  disposed_at timestamptz,
  disposed_by uuid references auth.users(id) on delete set null,
  disposal_reason text,

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fixed_assets_cost_check
    check (
      acquisition_cost >= 0
      and residual_value >= 0
      and residual_value <= acquisition_cost
    ),

  constraint fixed_assets_useful_life_check
    check (useful_life_months > 0),

  constraint fixed_assets_depreciation_method_check
    check (depreciation_method = any (array['straight_line'::text])),

  constraint fixed_assets_scope_code_unique
    unique nulls not distinct (tenant_id, unit_id, asset_code)
);

create index if not exists fixed_assets_tenant_idx
  on public.fixed_assets (tenant_id);

create index if not exists fixed_assets_unit_idx
  on public.fixed_assets (unit_id);

create index if not exists fixed_assets_status_idx
  on public.fixed_assets (status);

create or replace function public.validate_fixed_asset_scope()
returns trigger
language plpgsql
as $$
declare
  v_account record;
begin
  for v_account in
    select coa.tenant_id, coa.unit_id
    from public.chart_of_accounts coa
    where coa.id in (
      new.asset_account_id,
      new.accumulated_depreciation_account_id,
      new.depreciation_expense_account_id
    )
  loop
    if new.tenant_id <> v_account.tenant_id
      or new.unit_id is distinct from v_account.unit_id
    then
      raise exception 'fixed asset account scope does not match asset scope'
        using errcode = '23514';
    end if;
  end loop;

  return new;
end;
$$;

create or replace function public.prevent_disposed_fixed_asset_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status = 'disposed' then
    raise exception 'disposed fixed asset cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status = 'disposed' then
    raise exception 'disposed fixed asset cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_fixed_assets_set_updated_at on public.fixed_assets;
drop trigger if exists trg_fixed_assets_validate_scope on public.fixed_assets;
drop trigger if exists trg_prevent_disposed_fixed_asset_mutation on public.fixed_assets;

create trigger trg_fixed_assets_set_updated_at
before update on public.fixed_assets
for each row
execute function public.set_updated_at();

create trigger trg_fixed_assets_validate_scope
before insert or update on public.fixed_assets
for each row
execute function public.validate_fixed_asset_scope();

create trigger trg_prevent_disposed_fixed_asset_mutation
before update or delete on public.fixed_assets
for each row
execute function public.prevent_disposed_fixed_asset_mutation();

-- ============================================================================
-- 3. Capital expenditures
-- ============================================================================

create table if not exists public.capital_expenditures (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  supplier_id uuid references public.suppliers(id) on delete set null,

  transaction_no text not null,
  transaction_date date not null default current_date,

  payment_type text not null
    check (payment_type = any (array['cash'::text, 'credit'::text])),

  due_date date,

  asset_category_id uuid not null references public.capital_expenditure_categories(id) on delete restrict,

  asset_account_id uuid not null references public.chart_of_accounts(id) on delete restrict,
  liability_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  cash_bank_account_id uuid references public.cash_bank_accounts(id) on delete restrict,

  total_amount numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'cancelled'::text, 'reversed'::text])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  notes text,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capital_expenditures_amount_check
    check (
      total_amount >= 0
      and paid_amount >= 0
      and paid_amount <= total_amount
    ),

  constraint capital_expenditures_payment_fields_check
    check (
      (
        payment_type = 'cash'
        and cash_bank_account_id is not null
        and liability_account_id is null
        and due_date is null
      )
      or
      (
        payment_type = 'credit'
        and cash_bank_account_id is null
        and liability_account_id is not null
        and due_date is not null
      )
    ),

  constraint capital_expenditures_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, transaction_no)
);

create index if not exists capital_expenditures_tenant_idx
  on public.capital_expenditures (tenant_id);

create index if not exists capital_expenditures_unit_idx
  on public.capital_expenditures (unit_id);

create index if not exists capital_expenditures_status_idx
  on public.capital_expenditures (status);

create index if not exists capital_expenditures_transaction_date_idx
  on public.capital_expenditures (transaction_date);

create index if not exists capital_expenditures_supplier_idx
  on public.capital_expenditures (supplier_id);

create index if not exists capital_expenditures_journal_entry_idx
  on public.capital_expenditures (journal_entry_id);

create index if not exists capital_expenditures_cash_bank_transaction_idx
  on public.capital_expenditures (cash_bank_transaction_id);

-- ============================================================================
-- 4. Capital expenditure lines
-- ============================================================================

create table if not exists public.capital_expenditure_lines (
  id uuid primary key default gen_random_uuid(),

  capital_expenditure_id uuid not null
    references public.capital_expenditures(id) on delete cascade,

  line_no integer not null,
  asset_name text not null,
  description text,

  quantity numeric(18,2) not null default 1,
  unit_price numeric(18,2) not null default 0,
  residual_value numeric(18,2) not null default 0,
  useful_life_months integer not null,

  fixed_asset_id uuid references public.fixed_assets(id) on delete restrict,

  created_at timestamptz not null default now(),

  constraint capital_expenditure_lines_amount_check
    check (
      quantity > 0
      and unit_price > 0
      and residual_value >= 0
      and useful_life_months > 0
    ),

  constraint capital_expenditure_lines_unique
    unique (capital_expenditure_id, line_no)
);

create index if not exists capital_expenditure_lines_capital_expenditure_idx
  on public.capital_expenditure_lines (capital_expenditure_id);

create index if not exists capital_expenditure_lines_fixed_asset_idx
  on public.capital_expenditure_lines (fixed_asset_id);

-- ============================================================================
-- 5. Capital expenditure scope / mutation guard
-- ============================================================================

create or replace function public.validate_capital_expenditure_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if new.unit_id is null then
    raise exception 'unit_id wajib diisi untuk Belanja Modal';
  end if;

  select count(*)
  into v_count
  from public.business_units bu
  where bu.id = new.unit_id
    and bu.tenant_id = new.tenant_id;

  if v_count = 0 then
    raise exception 'Unit tidak sesuai dengan tenant pada Belanja Modal';
  end if;

  if new.supplier_id is not null then
    select count(*)
    into v_count
    from public.suppliers s
    where s.id = new.supplier_id
      and s.tenant_id = new.tenant_id
      and s.unit_id is not distinct from new.unit_id;

    if v_count = 0 then
      raise exception 'Supplier tidak sesuai dengan tenant/unit Belanja Modal';
    end if;
  end if;

  select count(*)
  into v_count
  from public.chart_of_accounts coa
  where coa.id = new.asset_account_id
    and coa.tenant_id = new.tenant_id
    and coa.unit_id is not distinct from new.unit_id
    and coa.tipe = 'aset'
    and coa.account_type = 'ASET'
    and coa.normal_balance = 'debit'
    and coa.is_active = true
    and coa.is_postable = true;

  if v_count = 0 then
    raise exception 'Akun aset Belanja Modal tidak valid untuk tenant/unit ini';
  end if;

  if new.payment_type = 'cash' then
    select count(*)
    into v_count
    from public.cash_bank_accounts cba
    where cba.id = new.cash_bank_account_id
      and cba.tenant_id = new.tenant_id
      and cba.unit_id is not distinct from new.unit_id
      and cba.is_active = true;

    if v_count = 0 then
      raise exception 'Akun kas/bank Belanja Modal tidak valid untuk tenant/unit ini';
    end if;
  end if;

  if new.payment_type = 'credit' then
    select count(*)
    into v_count
    from public.chart_of_accounts coa
    where coa.id = new.liability_account_id
      and coa.tenant_id = new.tenant_id
      and coa.unit_id is not distinct from new.unit_id
      and coa.tipe = 'kewajiban'
      and coa.account_type = 'KEWAJIBAN'
      and coa.normal_balance = 'credit'
      and coa.is_active = true
      and coa.is_postable = true;

    if v_count = 0 then
      raise exception 'Akun utang Belanja Modal tidak valid untuk tenant/unit ini';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_posted_capital_expenditure_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
begin
  if tg_table_name = 'capital_expenditures' then
    if tg_op = 'DELETE' and old.status in ('posted', 'reversed') then
      raise exception 'Belanja Modal yang sudah posted/reversed tidak boleh dihapus';
    end if;

    if tg_op = 'UPDATE' and old.status in ('posted', 'reversed') then
      if new.status = old.status then
        raise exception 'Belanja Modal yang sudah posted/reversed tidak boleh diubah langsung';
      end if;
    end if;

    return coalesce(new, old);
  end if;

  if tg_table_name = 'capital_expenditure_lines' then
    select ce.status
    into v_status
    from public.capital_expenditures ce
    where ce.id = coalesce(new.capital_expenditure_id, old.capital_expenditure_id);

    if v_status in ('posted', 'reversed') then
      raise exception 'Detail Belanja Modal yang sudah posted/reversed tidak boleh diubah';
    end if;

    return coalesce(new, old);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_capital_expenditures_set_updated_at on public.capital_expenditures;
drop trigger if exists trg_capital_expenditures_validate_scope on public.capital_expenditures;
drop trigger if exists trg_prevent_posted_capital_expenditure_mutation on public.capital_expenditures;
drop trigger if exists trg_prevent_posted_capital_expenditure_line_mutation on public.capital_expenditure_lines;

create trigger trg_capital_expenditures_set_updated_at
before update on public.capital_expenditures
for each row
execute function public.set_updated_at();

create trigger trg_capital_expenditures_validate_scope
before insert or update on public.capital_expenditures
for each row
execute function public.validate_capital_expenditure_scope();

create trigger trg_prevent_posted_capital_expenditure_mutation
before update or delete on public.capital_expenditures
for each row
execute function public.prevent_posted_capital_expenditure_mutation();

create trigger trg_prevent_posted_capital_expenditure_line_mutation
before update or delete on public.capital_expenditure_lines
for each row
execute function public.prevent_posted_capital_expenditure_mutation();

-- ============================================================================
-- 6. Reporting / audit view
-- ============================================================================

create or replace view public.v_capital_expenditure_flow_audit as
select
  ce.id as capital_expenditure_id,
  ce.tenant_id,
  ce.unit_id,
  ce.transaction_no,
  ce.transaction_date,
  ce.payment_type,
  ce.due_date,
  ce.status,
  ce.total_amount,
  ce.paid_amount,
  ce.notes,
  cec.category_code,
  cec.category_name,
  asset_coa.kode as asset_account_code,
  asset_coa.nama as asset_account_name,
  liability_coa.kode as liability_account_code,
  liability_coa.nama as liability_account_name,
  ce.journal_entry_id,
  je.journal_no,
  je.status as journal_status,
  ce.cash_bank_transaction_id,
  cbt.transaction_no as cash_bank_transaction_no,
  cbt.transaction_type as cash_bank_transaction_type,
  cbt.status as cash_bank_transaction_status,
  coalesce(line_summary.line_count, 0) as line_count,
  coalesce(line_summary.fixed_asset_count, 0) as fixed_asset_count,
  coalesce(journal_totals.total_debit, 0)::numeric(18,2) as total_debit,
  coalesce(journal_totals.total_credit, 0)::numeric(18,2) as total_credit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = ce.journal_entry_id
      and jl.account_id = ce.asset_account_id
      and jl.debit = ce.total_amount
  ) as has_asset_debit,
  exists (
    select 1
    from public.journal_lines jl
    join public.cash_bank_accounts cba on cba.account_id = jl.account_id
    where jl.journal_entry_id = ce.journal_entry_id
      and cba.id = ce.cash_bank_account_id
      and jl.credit = ce.total_amount
  ) as has_cash_credit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = ce.journal_entry_id
      and jl.account_id = ce.liability_account_id
      and jl.credit = ce.total_amount
  ) as has_liability_credit,
  (
    select count(*)
    from public.cash_bank_transactions cbtx
    where cbtx.source_type = 'capital_expenditure'
      and cbtx.source_id = ce.id
  ) as cash_bank_transaction_count,
  case
    when ce.status <> 'posted' then 'NOT_POSTED'
    when ce.journal_entry_id is null then 'FAIL_NO_JOURNAL'
    when je.status <> 'posted' then 'FAIL_JOURNAL_NOT_POSTED'
    when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'FAIL_JOURNAL_NOT_BALANCED'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = ce.journal_entry_id
        and jl.account_id = ce.asset_account_id
        and jl.debit = ce.total_amount
    ) then 'FAIL_NO_ASSET_DEBIT'
    when ce.payment_type = 'cash'
      and ce.cash_bank_transaction_id is null then 'FAIL_CASH_NO_CASH_BANK_TX'
    when ce.payment_type = 'cash'
      and not exists (
        select 1
        from public.journal_lines jl
        join public.cash_bank_accounts cba on cba.account_id = jl.account_id
        where jl.journal_entry_id = ce.journal_entry_id
          and cba.id = ce.cash_bank_account_id
          and jl.credit = ce.total_amount
      ) then 'FAIL_CASH_NO_CASH_CREDIT'
    when ce.payment_type = 'cash'
      and cbt.transaction_type <> 'payment' then 'FAIL_CASH_BANK_TYPE'
    when ce.payment_type = 'cash'
      and cbt.status <> 'posted' then 'FAIL_CASH_BANK_NOT_POSTED'
    when ce.payment_type = 'credit'
      and ce.cash_bank_transaction_id is not null then 'FAIL_CREDIT_HAS_CASH_BANK_TX'
    when ce.payment_type = 'credit'
      and not exists (
        select 1
        from public.journal_lines jl
        where jl.journal_entry_id = ce.journal_entry_id
          and jl.account_id = ce.liability_account_id
          and jl.credit = ce.total_amount
      ) then 'FAIL_CREDIT_NO_LIABILITY_CREDIT'
    when coalesce(line_summary.line_count, 0) = 0 then 'FAIL_NO_LINES'
    when coalesce(line_summary.fixed_asset_count, 0) <> coalesce(line_summary.line_count, 0) then 'FAIL_FIXED_ASSET_COUNT'
    else 'PASS'
  end as audit_result,
  array_remove(array[
    case when ce.status <> 'posted' then 'capital expenditure not posted' end,
    case when ce.journal_entry_id is null then 'missing journal entry' end,
    case when je.status <> 'posted' then 'journal not posted' end,
    case when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'journal not balanced' end,
    case when coalesce(line_summary.line_count, 0) = 0 then 'no asset lines' end,
    case when coalesce(line_summary.fixed_asset_count, 0) <> coalesce(line_summary.line_count, 0) then 'fixed asset count mismatch' end,
    case when ce.payment_type = 'cash' and ce.cash_bank_transaction_id is null then 'cash payment missing cash-bank transaction' end,
    case when ce.payment_type = 'credit' and ce.cash_bank_transaction_id is not null then 'credit transaction should not create cash-bank transaction' end
  ], null) as audit_notes,
  ce.created_at,
  ce.updated_at,
  ce.posted_at,
  ce.posted_by,
  ce.created_by
from public.capital_expenditures ce
left join public.capital_expenditure_categories cec
  on cec.id = ce.asset_category_id
left join public.chart_of_accounts asset_coa
  on asset_coa.id = ce.asset_account_id
left join public.chart_of_accounts liability_coa
  on liability_coa.id = ce.liability_account_id
left join public.journal_entries je
  on je.id = ce.journal_entry_id
left join public.cash_bank_transactions cbt
  on cbt.id = ce.cash_bank_transaction_id
left join lateral (
  select
    count(*) as line_count,
    count(cel.fixed_asset_id) filter (where cel.fixed_asset_id is not null) as fixed_asset_count
  from public.capital_expenditure_lines cel
  where cel.capital_expenditure_id = ce.id
) line_summary on true
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit
  from public.journal_lines jl
  where jl.journal_entry_id = ce.journal_entry_id
) journal_totals on true;

create or replace view public.v_capital_expenditure_flow as
select *
from public.v_capital_expenditure_flow_audit;

-- ============================================================================
-- 7. RPC: create capital expenditure draft
-- ============================================================================

create or replace function public.create_capital_expenditure(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_supplier_id uuid,
  p_transaction_no text,
  p_transaction_date date,
  p_payment_type text default 'cash',
  p_due_date date default null,
  p_asset_category_id uuid default null,
  p_cash_bank_account_id uuid default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capital_expenditure_id uuid;
  v_asset_account_id uuid;
  v_liability_account_id uuid;
  v_category record;
  v_line jsonb;
  v_line_no integer := 0;
  v_asset_name text;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
  v_residual_value numeric;
  v_useful_life_months integer;
  v_total_amount numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  if not public.can_access_unit(p_unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'purchase.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  if p_supplier_id is not null and not exists (
    select 1
    from public.suppliers s
    where s.id = p_supplier_id
      and s.tenant_id = p_tenant_id
      and s.unit_id is not distinct from p_unit_id
      and s.is_active = true
  ) then
    raise exception 'Supplier Belanja Modal tidak valid atau tidak aktif untuk unit ini';
  end if;

  if p_transaction_no is null or btrim(p_transaction_no) = '' then
    raise exception 'Nomor transaksi Belanja Modal wajib diisi';
  end if;

  if p_transaction_date is null then
    raise exception 'Tanggal transaksi Belanja Modal wajib diisi';
  end if;

  if p_payment_type not in ('cash', 'credit') then
    raise exception 'Jenis pembayaran Belanja Modal tidak valid: %', p_payment_type;
  end if;

  if p_asset_category_id is null then
    raise exception 'Kategori aset Belanja Modal wajib dipilih';
  end if;

  if p_payment_type = 'cash' and p_cash_bank_account_id is null then
    raise exception 'Akun kas/bank wajib dipilih untuk Belanja Modal tunai';
  end if;

  if p_payment_type = 'cash' and p_due_date is not null then
    raise exception 'Jatuh tempo tidak boleh diisi untuk Belanja Modal tunai';
  end if;

  if p_payment_type = 'credit' and p_due_date is null then
    raise exception 'Tanggal jatuh tempo wajib diisi untuk Belanja Modal kredit';
  end if;

  if p_payment_type = 'credit' and p_cash_bank_account_id is not null then
    raise exception 'Akun kas/bank tidak boleh diisi untuk Belanja Modal kredit';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) = 0 then
    raise exception 'Detail aset Belanja Modal wajib diisi minimal 1 baris';
  end if;

  if exists (
    select 1
    from public.capital_expenditures ce
    where ce.tenant_id = p_tenant_id
      and ce.unit_id = p_unit_id
      and ce.transaction_no = upper(btrim(p_transaction_no))
  ) then
    raise exception 'Nomor transaksi Belanja Modal sudah digunakan dalam unit ini';
  end if;

  select *
  into v_category
  from public.capital_expenditure_categories c
  where c.id = p_asset_category_id
    and c.is_active = true;

  if not found then
    raise exception 'Kategori aset Belanja Modal tidak valid atau tidak aktif';
  end if;

  select coa.id
  into v_asset_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and coa.unit_id is not distinct from p_unit_id
    and coa.kode = v_category.asset_account_code
    and coa.tipe = 'aset'
    and coa.account_type = 'ASET'
    and coa.normal_balance = 'debit'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_asset_account_id is null then
    raise exception 'Akun aset % belum tersedia/aktif/postable untuk unit ini', v_category.asset_account_code;
  end if;

  if p_payment_type = 'credit' then
    select coa.id
    into v_liability_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = p_tenant_id
      and coa.unit_id is not distinct from p_unit_id
      and coa.kode = '2120'
      and coa.tipe = 'kewajiban'
      and coa.account_type = 'KEWAJIBAN'
      and coa.normal_balance = 'credit'
      and coa.is_active = true
      and coa.is_postable = true
    limit 1;

    if v_liability_account_id is null then
      raise exception 'Akun 2120 Utang Belanja Modal belum tersedia/aktif/postable untuk unit ini';
    end if;
  end if;

  insert into public.capital_expenditures (
    tenant_id,
    unit_id,
    supplier_id,
    transaction_no,
    transaction_date,
    payment_type,
    due_date,
    asset_category_id,
    asset_account_id,
    liability_account_id,
    cash_bank_account_id,
    total_amount,
    paid_amount,
    status,
    notes,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_supplier_id,
    upper(btrim(p_transaction_no)),
    p_transaction_date,
    p_payment_type,
    case when p_payment_type = 'credit' then p_due_date else null end,
    p_asset_category_id,
    v_asset_account_id,
    case when p_payment_type = 'credit' then v_liability_account_id else null end,
    case when p_payment_type = 'cash' then p_cash_bank_account_id else null end,
    0,
    0,
    'draft',
    nullif(btrim(coalesce(p_notes, '')), ''),
    auth.uid()
  )
  returning id into v_capital_expenditure_id;

  for v_line in
    select value
    from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;

    v_asset_name := nullif(btrim(v_line ->> 'asset_name'), '');
    v_description := nullif(btrim(v_line ->> 'description'), '');
    v_quantity := coalesce(nullif(v_line ->> 'quantity', '')::numeric, 1);
    v_unit_price := coalesce(nullif(v_line ->> 'unit_price', '')::numeric, 0);
    v_residual_value := coalesce(nullif(v_line ->> 'residual_value', '')::numeric, 0);
    v_useful_life_months := coalesce(
      nullif(v_line ->> 'useful_life_months', '')::integer,
      v_category.default_useful_life_months
    );

    if v_asset_name is null then
      raise exception 'Nama aset wajib diisi pada baris %', v_line_no;
    end if;

    if v_quantity <= 0 then
      raise exception 'Jumlah aset harus lebih dari 0 pada baris %', v_line_no;
    end if;

    if v_unit_price <= 0 then
      raise exception 'Harga aset harus lebih dari 0 pada baris %', v_line_no;
    end if;

    if v_residual_value < 0 then
      raise exception 'Nilai residu tidak boleh negatif pada baris %', v_line_no;
    end if;

    if v_residual_value > (v_quantity * v_unit_price) then
      raise exception 'Nilai residu tidak boleh melebihi nilai perolehan pada baris %', v_line_no;
    end if;

    if v_useful_life_months <= 0 then
      raise exception 'Umur manfaat wajib lebih dari 0 pada baris %', v_line_no;
    end if;

    insert into public.capital_expenditure_lines (
      capital_expenditure_id,
      line_no,
      asset_name,
      description,
      quantity,
      unit_price,
      residual_value,
      useful_life_months
    )
    values (
      v_capital_expenditure_id,
      v_line_no,
      v_asset_name,
      v_description,
      v_quantity,
      v_unit_price,
      v_residual_value,
      v_useful_life_months
    );

    v_total_amount := v_total_amount + (v_quantity * v_unit_price);
  end loop;

  if v_total_amount <= 0 then
    raise exception 'Total Belanja Modal harus lebih dari 0';
  end if;

  update public.capital_expenditures
  set
    total_amount = round(v_total_amount, 2),
    paid_amount = case
      when p_payment_type = 'cash' then round(v_total_amount, 2)
      else 0
    end,
    updated_at = now()
  where id = v_capital_expenditure_id;

  return v_capital_expenditure_id;
end;
$$;

-- ============================================================================
-- 8. RPC: post capital expenditure
-- ============================================================================

create or replace function public.post_capital_expenditure(
  p_capital_expenditure_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ce record;
  v_category record;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_cash_account_id uuid;
  v_credit_account_id uuid;
  v_accumulated_depreciation_account_id uuid;
  v_depreciation_expense_account_id uuid;
  v_actor_role public.app_role;
  v_journal_no text;
  v_cash_transaction_no text;
  v_line record;
  v_fixed_asset_id uuid;
  v_fixed_asset_code text;
  v_line_total numeric(18,2);
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select ce.*
  into v_ce
  from public.capital_expenditures ce
  where ce.id = p_capital_expenditure_id
  for update;

  if v_ce.id is null then
    raise exception 'Belanja Modal tidak ditemukan';
  end if;

  if not public.can_access_unit(v_ce.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(v_ce.unit_id) is distinct from v_ce.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'purchase.manage',
    auth.uid(),
    v_ce.tenant_id,
    v_ce.unit_id
  );

  if v_ce.status <> 'draft' then
    raise exception 'Hanya Belanja Modal berstatus draft yang dapat diposting. Status saat ini: %', v_ce.status;
  end if;

  if v_ce.payment_type not in ('cash', 'credit') then
    raise exception 'Tipe pembayaran Belanja Modal tidak valid: %', v_ce.payment_type;
  end if;

  if v_ce.payment_type = 'cash' and v_ce.cash_bank_account_id is null then
    raise exception 'Akun kas/bank wajib tersedia untuk Belanja Modal tunai';
  end if;

  if v_ce.payment_type = 'credit' and v_ce.liability_account_id is null then
    raise exception 'Akun utang wajib tersedia untuk Belanja Modal kredit';
  end if;

  if v_ce.payment_type = 'credit' and v_ce.due_date is null then
    raise exception 'Tanggal jatuh tempo wajib tersedia untuk Belanja Modal kredit';
  end if;

  if v_ce.total_amount <= 0 then
    raise exception 'Total Belanja Modal harus lebih dari 0';
  end if;

  if not exists (
    select 1
    from public.capital_expenditure_lines cel
    where cel.capital_expenditure_id = v_ce.id
  ) then
    raise exception 'Belanja Modal belum memiliki detail aset';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.source_type = 'capital_expenditure'
      and je.source_id = v_ce.id
  ) then
    raise exception 'Belanja Modal ini sudah memiliki jurnal';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.source_type = 'capital_expenditure'
      and cbt.source_id = v_ce.id
  ) then
    raise exception 'Belanja Modal ini sudah memiliki transaksi kas/bank';
  end if;

  select c.*
  into v_category
  from public.capital_expenditure_categories c
  where c.id = v_ce.asset_category_id
    and c.is_active = true;

  if v_category.id is null then
    raise exception 'Kategori Belanja Modal tidak valid atau tidak aktif';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_ce.tenant_id
    and ap.unit_id = v_ce.unit_id
    and v_ce.transaction_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal Belanja Modal tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  if v_ce.payment_type = 'cash' then
    select cba.account_id
    into v_cash_account_id
    from public.cash_bank_accounts cba
    where cba.id = v_ce.cash_bank_account_id
      and cba.tenant_id = v_ce.tenant_id
      and cba.unit_id is not distinct from v_ce.unit_id
      and cba.is_active = true
    limit 1;

    if v_cash_account_id is null then
      raise exception 'Akun COA kas/bank Belanja Modal tidak ditemukan atau tidak aktif';
    end if;

    perform public.assert_cash_bank_account_sufficient_balance(
      v_ce.tenant_id,
      v_ce.unit_id,
      v_cash_account_id,
      v_ce.total_amount
    );

    v_credit_account_id := v_cash_account_id;
  else
    v_credit_account_id := v_ce.liability_account_id;
  end if;

  if v_credit_account_id is null then
    raise exception 'Akun kredit Belanja Modal tidak valid';
  end if;

  if v_category.accumulated_depreciation_account_code is not null then
    select coa.id
    into v_accumulated_depreciation_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_ce.tenant_id
      and coa.unit_id is not distinct from v_ce.unit_id
      and coa.kode = v_category.accumulated_depreciation_account_code
      and coa.is_active = true
      and coa.is_postable = true
    limit 1;
  end if;

  if v_category.depreciation_expense_account_code is not null then
    select coa.id
    into v_depreciation_expense_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_ce.tenant_id
      and coa.unit_id is not distinct from v_ce.unit_id
      and coa.kode = v_category.depreciation_expense_account_code
      and coa.is_active = true
      and coa.is_postable = true
    limit 1;
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_ce.unit_id
      or ur.tenant_id = v_ce.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'manager_unit' then 1
      when ur.role = 'operator_unit' then 2
      when ur.role = 'direktur_bumdes' then 3
      when ur.role = 'admin_bumdes' then 4
      when ur.role = 'super_admin_platform' then 5
      else 6
    end
  limit 1;

  v_journal_no := 'JBM-' || v_ce.transaction_no;
  v_cash_transaction_no := 'CBBM-' || v_ce.transaction_no;

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
    v_ce.tenant_id,
    v_ce.unit_id,
    v_period_id,
    v_journal_no,
    v_ce.transaction_date,
    'capital_expenditure',
    v_ce.id,
    'Posting Belanja Modal ' || v_ce.transaction_no,
    'draft',
    auth.uid()
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
  values
  (
    v_journal_entry_id,
    v_ce.asset_account_id,
    1,
    'Aset dari Belanja Modal ' || v_ce.transaction_no,
    v_ce.total_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_credit_account_id,
    2,
    case
      when v_ce.payment_type = 'cash'
        then 'Kas/bank keluar untuk Belanja Modal ' || v_ce.transaction_no
      else 'Utang Belanja Modal ' || v_ce.transaction_no
    end,
    0,
    v_ce.total_amount
  );

  perform public.assert_journal_balanced(v_journal_entry_id);

  for v_line in
    select *
    from public.capital_expenditure_lines cel
    where cel.capital_expenditure_id = v_ce.id
    order by cel.line_no
  loop
    v_line_total := v_line.quantity * v_line.unit_price;

    v_fixed_asset_code :=
      'FA-' ||
      to_char(v_ce.transaction_date, 'YYYYMMDD') ||
      '-' ||
      lpad(v_line.line_no::text, 3, '0') ||
      '-' ||
      replace(left(v_ce.transaction_no, 20), '/', '-');

    insert into public.fixed_assets (
      tenant_id,
      unit_id,
      asset_code,
      asset_name,
      acquisition_date,
      acquisition_cost,
      residual_value,
      useful_life_months,
      depreciation_method,
      asset_account_id,
      accumulated_depreciation_account_id,
      depreciation_expense_account_id,
      status,
      journal_entry_id,
      created_by
    )
    values (
      v_ce.tenant_id,
      v_ce.unit_id,
      v_fixed_asset_code,
      v_line.asset_name,
      v_ce.transaction_date,
      v_line_total,
      v_line.residual_value,
      v_line.useful_life_months,
      'straight_line',
      v_ce.asset_account_id,
      v_accumulated_depreciation_account_id,
      v_depreciation_expense_account_id,
      'active',
      v_journal_entry_id,
      auth.uid()
    )
    returning id into v_fixed_asset_id;

    update public.capital_expenditure_lines
    set fixed_asset_id = v_fixed_asset_id
    where id = v_line.id;
  end loop;

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_journal_entry_id;

  if v_ce.payment_type = 'cash' then
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
      v_ce.tenant_id,
      v_ce.unit_id,
      v_ce.cash_bank_account_id,
      v_cash_transaction_no,
      v_ce.transaction_date,
      'payment',
      'capital_expenditure',
      v_ce.id,
      'Pembayaran tunai Belanja Modal ' || v_ce.transaction_no,
      v_ce.total_amount,
      'posted',
      v_journal_entry_id,
      now(),
      auth.uid(),
      auth.uid()
    )
    returning id into v_cash_bank_transaction_id;
  end if;

  update public.capital_expenditures
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id,
    posted_at = now(),
    posted_by = auth.uid(),
    paid_amount = case
      when payment_type = 'cash' then total_amount
      else 0
    end,
    updated_at = now()
  where id = v_ce.id;

  perform public.log_audit_event(
    v_ce.tenant_id,
    v_ce.unit_id,
    auth.uid(),
    v_actor_role,
    'capital_expenditure_posted'::text,
    'capital_expenditures'::text,
    v_ce.id,
    'unit_dashboard'::text,
    v_ce.id,
    'Belanja Modal diposting.'::text,
    jsonb_build_object(
      'capital_expenditure_id', v_ce.id,
      'transaction_no', v_ce.transaction_no,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'payment_type', v_ce.payment_type,
      'total_amount', v_ce.total_amount,
      'paid_amount', case when v_ce.payment_type = 'cash' then v_ce.total_amount else 0 end,
      'asset_category_code', v_category.category_code,
      'asset_category_name', v_category.category_name
    )
  );

  return v_journal_entry_id;
end;
$$;

-- ============================================================================
-- 9. RPC wrapper: create and post
-- ============================================================================

create or replace function public.create_and_post_capital_expenditure(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_supplier_id uuid,
  p_transaction_no text,
  p_transaction_date date,
  p_payment_type text default 'cash',
  p_due_date date default null,
  p_asset_category_id uuid default null,
  p_cash_bank_account_id uuid default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capital_expenditure_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_fixed_asset_count integer;
begin
  v_capital_expenditure_id := public.create_capital_expenditure(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_supplier_id := p_supplier_id,
    p_transaction_no := p_transaction_no,
    p_transaction_date := p_transaction_date,
    p_payment_type := p_payment_type,
    p_due_date := p_due_date,
    p_asset_category_id := p_asset_category_id,
    p_cash_bank_account_id := p_cash_bank_account_id,
    p_notes := p_notes,
    p_lines := p_lines
  );

  v_journal_entry_id := public.post_capital_expenditure(v_capital_expenditure_id);

  select
    ce.cash_bank_transaction_id,
    count(cel.fixed_asset_id) filter (where cel.fixed_asset_id is not null)
  into
    v_cash_bank_transaction_id,
    v_fixed_asset_count
  from public.capital_expenditures ce
  left join public.capital_expenditure_lines cel
    on cel.capital_expenditure_id = ce.id
  where ce.id = v_capital_expenditure_id
  group by ce.cash_bank_transaction_id;

  return jsonb_build_object(
    'capital_expenditure_id', v_capital_expenditure_id,
    'journal_entry_id', v_journal_entry_id,
    'cash_bank_transaction_id', v_cash_bank_transaction_id,
    'payment_type', p_payment_type,
    'fixed_asset_count', coalesce(v_fixed_asset_count, 0),
    'status', 'posted'
  );
end;
$$;

-- ============================================================================
-- 10. Grants / comments
-- ============================================================================

grant select on public.capital_expenditure_categories to authenticated;
grant select on public.capital_expenditures to authenticated;
grant select on public.capital_expenditure_lines to authenticated;
grant select on public.fixed_assets to authenticated;
grant select on public.v_capital_expenditure_flow to authenticated;
grant select on public.v_capital_expenditure_flow_audit to authenticated;

grant execute on function public.create_capital_expenditure(
  uuid,
  uuid,
  uuid,
  text,
  date,
  text,
  date,
  uuid,
  uuid,
  text,
  jsonb
) to authenticated;

grant execute on function public.post_capital_expenditure(uuid) to authenticated;

grant execute on function public.create_and_post_capital_expenditure(
  uuid,
  uuid,
  uuid,
  text,
  date,
  text,
  date,
  uuid,
  uuid,
  text,
  jsonb
) to authenticated;

comment on table public.capital_expenditure_categories is
'Template kategori Belanja Modal yang memetakan kategori aset ke COA aset, akumulasi penyusutan, dan beban penyusutan.';

comment on table public.capital_expenditures is
'Belanja Modal engine: kapitalisasi aset tetap, jurnal aset, kas/bank payment untuk tunai, dan utang belanja modal untuk kredit.';

comment on table public.capital_expenditure_lines is
'Detail aset dalam transaksi Belanja Modal; setiap baris diposting menjadi fixed asset saat transaksi posted.';

comment on table public.fixed_assets is
'Register aset tetap unit/BUMDes, termasuk nilai perolehan, umur manfaat, akun aset, dan status disposal.';

comment on function public.create_and_post_capital_expenditure(
  uuid,
  uuid,
  uuid,
  text,
  date,
  text,
  date,
  uuid,
  uuid,
  text,
  jsonb
) is
'Creates and posts capital expenditure: debit fixed asset, credit cash/bank or capital expenditure payable, create fixed asset records, and write audit timeline.';

comment on view public.v_capital_expenditure_flow_audit is
'Audit/reporting view for Belanja Modal / fixed asset acquisition flow.';
