-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000017: Operational Expense Engine
--
-- DB-FIRST EVIDENCE:
--   Active Beban Operasional engine already uses:
--   - operational_expenses
--   - create_operational_expense()
--   - post_operational_expense()
--   - create_and_post_operational_expense()
--
-- Compatibility decisions:
--   - chart_of_accounts uses kode/nama/tipe/account_type.
--   - cash_bank_transactions uses transaction_type.
--   - accounting period validation uses assert_period_open(period_id).
--   - cash/bank sufficiency uses assert_cash_bank_account_sufficient_balance().
--   - audit logging uses full log_audit_event signature.
--   - operational_expenses status supports draft/posted/cancelled.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Operational expenses table
-- ============================================================================

create table if not exists public.operational_expenses (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),

  expense_no text not null,
  expense_date date not null default current_date,

  expense_account_id uuid not null references public.chart_of_accounts(id),
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),

  total_amount numeric(18,2) not null default 0,
  description text,

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'cancelled'::text])),

  journal_entry_id uuid references public.journal_entries(id),
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id),

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint operational_expenses_amount_positive
    check (total_amount >= 0),

  constraint operational_expenses_unique_no_per_unit
    unique (tenant_id, unit_id, expense_no)
);

create index if not exists operational_expenses_tenant_idx
  on public.operational_expenses (tenant_id);

create index if not exists operational_expenses_unit_idx
  on public.operational_expenses (unit_id);

create index if not exists operational_expenses_status_idx
  on public.operational_expenses (status);

create index if not exists operational_expenses_expense_date_idx
  on public.operational_expenses (expense_date);

create index if not exists operational_expenses_expense_account_idx
  on public.operational_expenses (expense_account_id);

create index if not exists operational_expenses_cash_bank_account_idx
  on public.operational_expenses (cash_bank_account_id);

create index if not exists operational_expenses_journal_entry_idx
  on public.operational_expenses (journal_entry_id);

create index if not exists operational_expenses_cash_bank_transaction_idx
  on public.operational_expenses (cash_bank_transaction_id);

drop trigger if exists trg_operational_expenses_set_updated_at on public.operational_expenses;

create trigger trg_operational_expenses_set_updated_at
before update on public.operational_expenses
for each row
execute function public.set_updated_at();

-- ============================================================================
-- 2. Scope validation
-- ============================================================================

create or replace function public.validate_operational_expense_scope()
returns trigger
language plpgsql
as $$
declare
  v_unit_tenant_id uuid;
  v_expense_account record;
  v_cash_bank_account record;
begin
  v_unit_tenant_id := public.unit_tenant_id(new.unit_id);

  if v_unit_tenant_id is null then
    raise exception 'Unit tidak ditemukan'
      using errcode = '23503';
  end if;

  if v_unit_tenant_id is distinct from new.tenant_id then
    raise exception 'Operational expense scope does not match tenant/unit scope'
      using errcode = '23514';
  end if;

  select
    coa.id,
    coa.tenant_id,
    coa.unit_id,
    coa.tipe,
    coa.account_type,
    coa.normal_balance,
    coa.is_active,
    coa.is_postable
  into v_expense_account
  from public.chart_of_accounts coa
  where coa.id = new.expense_account_id;

  if v_expense_account.id is null then
    raise exception 'Akun beban tidak ditemukan'
      using errcode = '23503';
  end if;

  if v_expense_account.tenant_id is distinct from new.tenant_id
    or v_expense_account.unit_id is distinct from new.unit_id
    or v_expense_account.tipe <> 'beban'
    or v_expense_account.account_type <> 'BEBAN'
    or v_expense_account.normal_balance <> 'debit'
    or v_expense_account.is_active is distinct from true
    or v_expense_account.is_postable is distinct from true
  then
    raise exception 'Akun beban tidak valid, tidak aktif, atau tidak postable untuk unit ini'
      using errcode = '23514';
  end if;

  select
    cba.id,
    cba.tenant_id,
    cba.unit_id,
    cba.is_active
  into v_cash_bank_account
  from public.cash_bank_accounts cba
  where cba.id = new.cash_bank_account_id;

  if v_cash_bank_account.id is null then
    raise exception 'Akun kas/bank tidak ditemukan'
      using errcode = '23503';
  end if;

  if v_cash_bank_account.tenant_id is distinct from new.tenant_id
    or v_cash_bank_account.unit_id is distinct from new.unit_id
    or v_cash_bank_account.is_active is distinct from true
  then
    raise exception 'Akun kas/bank tidak valid atau tidak aktif untuk unit ini'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_operational_expenses_validate_scope_insert on public.operational_expenses;
drop trigger if exists trg_operational_expenses_validate_scope_update on public.operational_expenses;

create trigger trg_operational_expenses_validate_scope_insert
before insert on public.operational_expenses
for each row
execute function public.validate_operational_expense_scope();

create trigger trg_operational_expenses_validate_scope_update
before update on public.operational_expenses
for each row
execute function public.validate_operational_expense_scope();

-- ============================================================================
-- 3. Posted mutation guard
-- ============================================================================

create or replace function public.prevent_posted_operational_expense_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled') then
    raise exception 'posted or cancelled operational expense cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled') then
    if new.tenant_id is distinct from old.tenant_id
      or new.unit_id is distinct from old.unit_id
      or new.expense_no is distinct from old.expense_no
      or new.expense_date is distinct from old.expense_date
      or new.expense_account_id is distinct from old.expense_account_id
      or new.cash_bank_account_id is distinct from old.cash_bank_account_id
      or new.total_amount is distinct from old.total_amount
      or new.description is distinct from old.description
      or new.journal_entry_id is distinct from old.journal_entry_id
      or new.cash_bank_transaction_id is distinct from old.cash_bank_transaction_id
      or new.posted_at is distinct from old.posted_at
      or new.posted_by is distinct from old.posted_by
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'posted or cancelled operational expense cannot be changed directly'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_posted_operational_expense_mutation
on public.operational_expenses;

create trigger trg_prevent_posted_operational_expense_mutation
before update or delete on public.operational_expenses
for each row
execute function public.prevent_posted_operational_expense_mutation();

-- ============================================================================
-- 4. RPC: create operational expense draft
-- ============================================================================

create or replace function public.create_operational_expense(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_expense_no text,
  p_expense_date date,
  p_expense_account_id uuid,
  p_cash_bank_account_id uuid,
  p_total_amount numeric,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operational_expense_id uuid;
  v_expense_account record;
  v_cash_bank_account record;
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

  if p_expense_no is null or btrim(p_expense_no) = '' then
    raise exception 'Nomor transaksi Beban Operasional wajib diisi';
  end if;

  if p_expense_date is null then
    raise exception 'Tanggal Beban Operasional wajib diisi';
  end if;

  if p_expense_account_id is null then
    raise exception 'Jenis beban wajib dipilih';
  end if;

  if p_cash_bank_account_id is null then
    raise exception 'Akun kas/bank pembayaran wajib dipilih';
  end if;

  if p_total_amount is null or p_total_amount <= 0 then
    raise exception 'Nominal Beban Operasional harus lebih dari 0';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  select coa.*
  into v_expense_account
  from public.chart_of_accounts coa
  where coa.id = p_expense_account_id
    and coa.tenant_id = p_tenant_id
    and coa.unit_id is not distinct from p_unit_id
    and coa.tipe = 'beban'
    and coa.account_type = 'BEBAN'
    and coa.normal_balance = 'debit'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_expense_account.id is null then
    raise exception 'Akun beban tidak valid, tidak aktif, atau tidak postable untuk unit ini';
  end if;

  select cba.*
  into v_cash_bank_account
  from public.cash_bank_accounts cba
  where cba.id = p_cash_bank_account_id
    and cba.tenant_id = p_tenant_id
    and cba.unit_id is not distinct from p_unit_id
    and cba.is_active = true
  limit 1;

  if v_cash_bank_account.id is null then
    raise exception 'Akun kas/bank tidak valid atau tidak aktif untuk unit ini';
  end if;

  if exists (
    select 1
    from public.operational_expenses oe
    where oe.tenant_id = p_tenant_id
      and oe.unit_id = p_unit_id
      and oe.expense_no = upper(btrim(p_expense_no))
  ) then
    raise exception 'Nomor transaksi Beban Operasional sudah digunakan dalam unit ini';
  end if;

  insert into public.operational_expenses (
    tenant_id,
    unit_id,
    expense_no,
    expense_date,
    expense_account_id,
    cash_bank_account_id,
    total_amount,
    description,
    status,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(btrim(p_expense_no)),
    p_expense_date,
    p_expense_account_id,
    p_cash_bank_account_id,
    round(p_total_amount, 2),
    nullif(btrim(coalesce(p_description, '')), ''),
    'draft',
    auth.uid()
  )
  returning id into v_operational_expense_id;

  return v_operational_expense_id;
end;
$$;

-- ============================================================================
-- 5. RPC: post operational expense
-- ============================================================================

create or replace function public.post_operational_expense(
  p_operational_expense_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exp record;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_cash_account_id uuid;
  v_actor_role public.app_role;
  v_journal_no text;
  v_cash_transaction_no text;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select oe.*
  into v_exp
  from public.operational_expenses oe
  where oe.id = p_operational_expense_id
  for update;

  if v_exp.id is null then
    raise exception 'Beban Operasional tidak ditemukan';
  end if;

  if not public.can_access_unit(v_exp.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(v_exp.unit_id) is distinct from v_exp.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'purchase.manage',
    auth.uid(),
    v_exp.tenant_id,
    v_exp.unit_id
  );

  if v_exp.status <> 'draft' then
    raise exception 'Hanya Beban Operasional berstatus draft yang dapat diposting. Status saat ini: %', v_exp.status;
  end if;

  if v_exp.total_amount <= 0 then
    raise exception 'Nominal Beban Operasional harus lebih dari 0';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.source_type = 'operational_expense'
      and je.source_id = v_exp.id
  ) then
    raise exception 'Beban Operasional ini sudah memiliki jurnal';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.source_type = 'operational_expense'
      and cbt.source_id = v_exp.id
  ) then
    raise exception 'Beban Operasional ini sudah memiliki transaksi kas/bank';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_exp.tenant_id
    and ap.unit_id = v_exp.unit_id
    and v_exp.expense_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal Beban Operasional tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select cba.account_id
  into v_cash_account_id
  from public.cash_bank_accounts cba
  where cba.id = v_exp.cash_bank_account_id
    and cba.tenant_id = v_exp.tenant_id
    and cba.unit_id is not distinct from v_exp.unit_id
    and cba.is_active = true
  limit 1;

  if v_cash_account_id is null then
    raise exception 'Akun COA kas/bank Beban Operasional tidak ditemukan atau tidak aktif';
  end if;

  perform public.assert_cash_bank_account_sufficient_balance(
    v_exp.tenant_id,
    v_exp.unit_id,
    v_cash_account_id,
    v_exp.total_amount
  );

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_exp.unit_id
      or ur.tenant_id = v_exp.tenant_id
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

  v_journal_no := 'JBO-' || v_exp.expense_no;
  v_cash_transaction_no := 'CBBO-' || v_exp.expense_no;

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
    v_exp.tenant_id,
    v_exp.unit_id,
    v_period_id,
    v_journal_no,
    v_exp.expense_date,
    'operational_expense',
    v_exp.id,
    'Posting Beban Operasional ' || v_exp.expense_no,
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
    v_exp.expense_account_id,
    1,
    'Beban Operasional ' || v_exp.expense_no,
    v_exp.total_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_cash_account_id,
    2,
    'Kas/bank keluar untuk Beban Operasional ' || v_exp.expense_no,
    0,
    v_exp.total_amount
  );

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_journal_entry_id;

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
    v_exp.tenant_id,
    v_exp.unit_id,
    v_exp.cash_bank_account_id,
    v_cash_transaction_no,
    v_exp.expense_date,
    'payment',
    'operational_expense',
    v_exp.id,
    'Pembayaran Beban Operasional ' || v_exp.expense_no,
    v_exp.total_amount,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_cash_bank_transaction_id;

  update public.operational_expenses
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_exp.id;

  perform public.log_audit_event(
    v_exp.tenant_id,
    v_exp.unit_id,
    auth.uid(),
    v_actor_role,
    'operational_expense_posted'::text,
    'operational_expenses'::text,
    v_exp.id,
    'unit_dashboard'::text,
    v_exp.id,
    'Beban Operasional diposting.'::text,
    jsonb_build_object(
      'operational_expense_id', v_exp.id,
      'expense_no', v_exp.expense_no,
      'expense_date', v_exp.expense_date,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'expense_account_id', v_exp.expense_account_id,
      'cash_bank_account_id', v_exp.cash_bank_account_id,
      'total_amount', v_exp.total_amount
    )
  );

  return v_journal_entry_id;
end;
$$;

-- ============================================================================
-- 6. RPC wrapper: create and post
-- ============================================================================

create or replace function public.create_and_post_operational_expense(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_expense_no text,
  p_expense_date date,
  p_expense_account_id uuid,
  p_cash_bank_account_id uuid,
  p_total_amount numeric,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_operational_expense_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
begin
  v_operational_expense_id := public.create_operational_expense(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_expense_no := p_expense_no,
    p_expense_date := p_expense_date,
    p_expense_account_id := p_expense_account_id,
    p_cash_bank_account_id := p_cash_bank_account_id,
    p_total_amount := p_total_amount,
    p_description := p_description
  );

  v_journal_entry_id := public.post_operational_expense(v_operational_expense_id);

  select oe.cash_bank_transaction_id
  into v_cash_bank_transaction_id
  from public.operational_expenses oe
  where oe.id = v_operational_expense_id;

  return jsonb_build_object(
    'operational_expense_id', v_operational_expense_id,
    'journal_entry_id', v_journal_entry_id,
    'cash_bank_transaction_id', v_cash_bank_transaction_id,
    'expense_no', upper(btrim(p_expense_no)),
    'expense_date', p_expense_date,
    'total_amount', round(p_total_amount, 2),
    'status', 'posted'
  );
end;
$$;

-- ============================================================================
-- 7. Reporting / audit view
-- ============================================================================

create or replace view public.v_operational_expense_flow as
select
  oe.id as operational_expense_id,
  oe.tenant_id,
  oe.unit_id,
  bu.nama_unit,
  oe.expense_no,
  oe.expense_date,
  oe.expense_account_id,
  expense_coa.kode as expense_account_code,
  expense_coa.nama as expense_account_name,
  oe.cash_bank_account_id,
  cba.account_code as cash_bank_account_code,
  cba.account_name as cash_bank_account_name,
  cba.account_kind as cash_bank_account_kind,
  oe.total_amount,
  oe.description,
  oe.status as expense_status,
  oe.journal_entry_id,
  je.journal_no,
  je.status as journal_status,
  oe.cash_bank_transaction_id,
  cbt.transaction_no as cash_bank_transaction_no,
  cbt.transaction_type as cash_bank_transaction_type,
  cbt.status as cash_bank_transaction_status,
  coalesce(journal_totals.total_debit, 0)::numeric(18,2) as total_debit,
  coalesce(journal_totals.total_credit, 0)::numeric(18,2) as total_credit,
  (
    coalesce(journal_totals.total_debit, 0)
    - coalesce(journal_totals.total_credit, 0)
  )::numeric(18,2) as journal_diff,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = oe.journal_entry_id
      and jl.account_id = oe.expense_account_id
      and jl.debit = oe.total_amount
  ) as has_expense_debit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = oe.journal_entry_id
      and jl.account_id = cba.account_id
      and jl.credit = oe.total_amount
  ) as has_cash_credit,
  case
    when oe.status <> 'posted' then 'NOT_POSTED'
    when oe.journal_entry_id is null then 'FAIL_NO_JOURNAL'
    when oe.cash_bank_transaction_id is null then 'FAIL_NO_CASH_BANK_TX'
    when je.status <> 'posted' then 'FAIL_JOURNAL_NOT_POSTED'
    when cbt.status <> 'posted' then 'FAIL_CASH_BANK_NOT_POSTED'
    when cbt.transaction_type <> 'payment' then 'FAIL_CASH_BANK_TYPE'
    when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'FAIL_JOURNAL_NOT_BALANCED'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = oe.journal_entry_id
        and jl.account_id = oe.expense_account_id
        and jl.debit = oe.total_amount
    ) then 'FAIL_NO_EXPENSE_DEBIT'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = oe.journal_entry_id
        and jl.account_id = cba.account_id
        and jl.credit = oe.total_amount
    ) then 'FAIL_NO_CASH_CREDIT'
    when cbt.amount <> oe.total_amount then 'FAIL_CASH_AMOUNT_MISMATCH'
    else 'PASS'
  end as audit_result,
  oe.posted_at,
  oe.posted_by,
  oe.created_by,
  oe.created_at,
  oe.updated_at
from public.operational_expenses oe
left join public.business_units bu
  on bu.id = oe.unit_id
left join public.chart_of_accounts expense_coa
  on expense_coa.id = oe.expense_account_id
left join public.cash_bank_accounts cba
  on cba.id = oe.cash_bank_account_id
left join public.journal_entries je
  on je.id = oe.journal_entry_id
left join public.cash_bank_transactions cbt
  on cbt.id = oe.cash_bank_transaction_id
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit
  from public.journal_lines jl
  where jl.journal_entry_id = oe.journal_entry_id
) journal_totals on true;

create or replace view public.v_operational_expense_flow_audit as
select *
from public.v_operational_expense_flow;

grant select on public.operational_expenses to authenticated;
grant select on public.v_operational_expense_flow to authenticated;
grant select on public.v_operational_expense_flow_audit to authenticated;

grant execute on function public.create_operational_expense(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

grant execute on function public.post_operational_expense(uuid) to authenticated;

grant execute on function public.create_and_post_operational_expense(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

comment on table public.operational_expenses is
'Beban Operasional engine: posted operational expense integrated with journal, cash-bank payment, balance protection, and audit timeline.';

comment on function public.create_and_post_operational_expense(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) is
'Creates and posts operational expense: debit expense account, credit selected cash/bank account, create cash-bank payment, validate balance, and write audit timeline.';

comment on view public.v_operational_expense_flow is
'Audit/reporting view for Beban Operasional flow.';
