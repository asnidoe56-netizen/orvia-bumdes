-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000016: Revenue Receipt Engine
--
-- DB-FIRST EVIDENCE:
--   Active Terima Pendapatan engine already uses:
--   - revenue_receipts
--   - create_revenue_receipt()
--   - post_revenue_receipt()
--   - create_and_post_revenue_receipt()
--
-- Compatibility decisions:
--   - chart_of_accounts uses kode/nama/tipe/account_type.
--   - cash_bank_transactions uses transaction_type.
--   - accounting period validation uses assert_period_open(period_id).
--   - audit logging uses full log_audit_event signature.
--   - revenue_receipts status supports draft/posted/cancelled.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Revenue receipts table
-- ============================================================================

create table if not exists public.revenue_receipts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),

  receipt_no text not null,
  receipt_date date not null default current_date,

  revenue_account_id uuid not null references public.chart_of_accounts(id),
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

  constraint revenue_receipts_amount_positive
    check (total_amount >= 0),

  constraint revenue_receipts_unique_no_per_unit
    unique (tenant_id, unit_id, receipt_no)
);

create index if not exists revenue_receipts_tenant_idx
  on public.revenue_receipts (tenant_id);

create index if not exists revenue_receipts_unit_idx
  on public.revenue_receipts (unit_id);

create index if not exists revenue_receipts_status_idx
  on public.revenue_receipts (status);

create index if not exists revenue_receipts_receipt_date_idx
  on public.revenue_receipts (receipt_date);

create index if not exists revenue_receipts_revenue_account_idx
  on public.revenue_receipts (revenue_account_id);

create index if not exists revenue_receipts_cash_bank_account_idx
  on public.revenue_receipts (cash_bank_account_id);

create index if not exists revenue_receipts_journal_entry_idx
  on public.revenue_receipts (journal_entry_id);

create index if not exists revenue_receipts_cash_bank_transaction_idx
  on public.revenue_receipts (cash_bank_transaction_id);

drop trigger if exists trg_revenue_receipts_set_updated_at on public.revenue_receipts;

create trigger trg_revenue_receipts_set_updated_at
before update on public.revenue_receipts
for each row
execute function public.set_updated_at();

-- ============================================================================
-- 2. Scope validation
-- ============================================================================

create or replace function public.validate_revenue_receipt_scope()
returns trigger
language plpgsql
as $$
declare
  v_unit_tenant_id uuid;
  v_revenue_account record;
  v_cash_bank_account record;
begin
  v_unit_tenant_id := public.unit_tenant_id(new.unit_id);

  if v_unit_tenant_id is null then
    raise exception 'Unit tidak ditemukan'
      using errcode = '23503';
  end if;

  if v_unit_tenant_id is distinct from new.tenant_id then
    raise exception 'Revenue receipt scope does not match tenant/unit scope'
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
  into v_revenue_account
  from public.chart_of_accounts coa
  where coa.id = new.revenue_account_id;

  if v_revenue_account.id is null then
    raise exception 'Akun pendapatan tidak ditemukan'
      using errcode = '23503';
  end if;

  if v_revenue_account.tenant_id is distinct from new.tenant_id
    or v_revenue_account.unit_id is distinct from new.unit_id
    or v_revenue_account.tipe <> 'pendapatan'
    or v_revenue_account.account_type <> 'PENDAPATAN'
    or v_revenue_account.normal_balance <> 'credit'
    or v_revenue_account.is_active is distinct from true
    or v_revenue_account.is_postable is distinct from true
  then
    raise exception 'Akun pendapatan tidak valid, tidak aktif, atau tidak postable untuk unit ini'
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

drop trigger if exists trg_revenue_receipts_validate_scope_insert on public.revenue_receipts;
drop trigger if exists trg_revenue_receipts_validate_scope_update on public.revenue_receipts;

create trigger trg_revenue_receipts_validate_scope_insert
before insert on public.revenue_receipts
for each row
execute function public.validate_revenue_receipt_scope();

create trigger trg_revenue_receipts_validate_scope_update
before update on public.revenue_receipts
for each row
execute function public.validate_revenue_receipt_scope();

-- ============================================================================
-- 3. Posted mutation guard
-- ============================================================================

create or replace function public.prevent_posted_revenue_receipt_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled') then
    raise exception 'posted or cancelled revenue receipt cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled') then
    if new.tenant_id is distinct from old.tenant_id
      or new.unit_id is distinct from old.unit_id
      or new.receipt_no is distinct from old.receipt_no
      or new.receipt_date is distinct from old.receipt_date
      or new.revenue_account_id is distinct from old.revenue_account_id
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
      raise exception 'posted or cancelled revenue receipt cannot be changed directly'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_posted_revenue_receipt_mutation
on public.revenue_receipts;

create trigger trg_prevent_posted_revenue_receipt_mutation
before update or delete on public.revenue_receipts
for each row
execute function public.prevent_posted_revenue_receipt_mutation();

-- ============================================================================
-- 4. RPC: create revenue receipt draft
-- ============================================================================

create or replace function public.create_revenue_receipt(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_receipt_no text,
  p_receipt_date date,
  p_revenue_account_id uuid,
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
  v_receipt_id uuid;
  v_unit_tenant_id uuid;
  v_revenue_account_exists boolean;
  v_cash_bank_account_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'Unit wajib diisi';
  end if;

  if not public.can_access_unit(p_unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(coalesce(p_receipt_no, '')), '') is null then
    raise exception 'Nomor penerimaan pendapatan wajib diisi';
  end if;

  if p_receipt_date is null then
    raise exception 'Tanggal penerimaan pendapatan wajib diisi';
  end if;

  if p_revenue_account_id is null then
    raise exception 'Akun pendapatan wajib diisi';
  end if;

  if p_cash_bank_account_id is null then
    raise exception 'Akun kas/bank wajib diisi';
  end if;

  if coalesce(p_total_amount, 0) <= 0 then
    raise exception 'Nominal penerimaan pendapatan harus lebih dari 0';
  end if;

  v_unit_tenant_id := public.unit_tenant_id(p_unit_id);

  if v_unit_tenant_id is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  select exists (
    select 1
    from public.chart_of_accounts coa
    where coa.id = p_revenue_account_id
      and coa.tenant_id = p_tenant_id
      and coa.unit_id is not distinct from p_unit_id
      and coa.tipe = 'pendapatan'
      and coa.account_type = 'PENDAPATAN'
      and coa.normal_balance = 'credit'
      and coa.is_active = true
      and coa.is_postable = true
  )
  into v_revenue_account_exists;

  if not v_revenue_account_exists then
    raise exception 'Akun pendapatan tidak valid, tidak aktif, atau tidak postable untuk unit ini';
  end if;

  select exists (
    select 1
    from public.cash_bank_accounts cba
    where cba.id = p_cash_bank_account_id
      and cba.tenant_id = p_tenant_id
      and cba.unit_id is not distinct from p_unit_id
      and cba.is_active = true
  )
  into v_cash_bank_account_exists;

  if not v_cash_bank_account_exists then
    raise exception 'Akun kas/bank tidak valid atau tidak aktif untuk unit ini';
  end if;

  if exists (
    select 1
    from public.revenue_receipts rr
    where rr.tenant_id = p_tenant_id
      and rr.unit_id = p_unit_id
      and rr.receipt_no = upper(trim(p_receipt_no))
  ) then
    raise exception 'Nomor penerimaan pendapatan sudah digunakan dalam unit ini';
  end if;

  insert into public.revenue_receipts (
    tenant_id,
    unit_id,
    receipt_no,
    receipt_date,
    revenue_account_id,
    cash_bank_account_id,
    total_amount,
    description,
    status,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(trim(p_receipt_no)),
    p_receipt_date,
    p_revenue_account_id,
    p_cash_bank_account_id,
    round(p_total_amount, 2),
    nullif(trim(coalesce(p_description, '')), ''),
    'draft',
    auth.uid()
  )
  returning id into v_receipt_id;

  return v_receipt_id;
end;
$$;

-- ============================================================================
-- 5. RPC: post revenue receipt
-- ============================================================================

create or replace function public.post_revenue_receipt(
  p_revenue_receipt_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_receipt public.revenue_receipts%rowtype;
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_period_id uuid;
  v_cash_account_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_journal_no text;
  v_cash_transaction_no text;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  select *
  into v_receipt
  from public.revenue_receipts
  where id = p_revenue_receipt_id
  for update;

  if not found then
    raise exception 'Data penerimaan pendapatan tidak ditemukan';
  end if;

  if public.unit_tenant_id(v_receipt.unit_id) is distinct from v_receipt.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  if not public.can_access_unit(v_receipt.unit_id, v_actor_id) then
    raise exception 'Anda tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    v_actor_id,
    v_receipt.tenant_id,
    v_receipt.unit_id
  );

  if v_receipt.status <> 'draft' then
    raise exception 'Penerimaan pendapatan hanya bisa diposting dari status draft';
  end if;

  if coalesce(v_receipt.total_amount, 0) <= 0 then
    raise exception 'Nominal penerimaan pendapatan harus lebih dari 0';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.tenant_id = v_receipt.tenant_id
      and je.unit_id is not distinct from v_receipt.unit_id
      and je.source_type = 'revenue_receipt'
      and je.source_id = v_receipt.id
  ) then
    raise exception 'Jurnal penerimaan pendapatan sudah pernah dibuat';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.tenant_id = v_receipt.tenant_id
      and cbt.unit_id is not distinct from v_receipt.unit_id
      and cbt.source_type = 'revenue_receipt'
      and cbt.source_id = v_receipt.id
  ) then
    raise exception 'Transaksi kas/bank penerimaan pendapatan sudah pernah dibuat';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_receipt.tenant_id
    and ap.unit_id is not distinct from v_receipt.unit_id
    and v_receipt.receipt_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal penerimaan pendapatan tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select cba.account_id
  into v_cash_account_id
  from public.cash_bank_accounts cba
  where cba.id = v_receipt.cash_bank_account_id
    and cba.tenant_id = v_receipt.tenant_id
    and cba.unit_id is not distinct from v_receipt.unit_id
    and cba.is_active = true;

  if v_cash_account_id is null then
    raise exception 'Akun kas/bank tidak valid atau tidak aktif';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_receipt.unit_id
      or ur.tenant_id is not distinct from v_receipt.tenant_id
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
    end,
    ur.created_at desc
  limit 1;

  v_journal_no := 'JTP-' || v_receipt.receipt_no;
  v_cash_transaction_no := 'CBTP-' || v_receipt.receipt_no;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    description,
    source_type,
    source_id,
    status,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_receipt.tenant_id,
    v_receipt.unit_id,
    v_period_id,
    v_journal_no,
    v_receipt.receipt_date,
    coalesce(v_receipt.description, 'Terima Pendapatan ' || v_receipt.receipt_no),
    'revenue_receipt',
    v_receipt.id,
    'draft',
    v_actor_id,
    now(),
    now()
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
      v_cash_account_id,
      1,
      'Kas/bank masuk dari penerimaan pendapatan ' || v_receipt.receipt_no,
      round(v_receipt.total_amount, 2),
      0
    ),
    (
      v_journal_entry_id,
      v_receipt.revenue_account_id,
      2,
      'Pendapatan ' || v_receipt.receipt_no,
      0,
      round(v_receipt.total_amount, 2)
    );

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_journal_entry_id;

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    amount,
    description,
    source_type,
    source_id,
    journal_entry_id,
    status,
    posted_at,
    posted_by,
    created_by,
    created_at,
    updated_at
  )
  values (
    v_receipt.tenant_id,
    v_receipt.unit_id,
    v_receipt.cash_bank_account_id,
    v_cash_transaction_no,
    v_receipt.receipt_date,
    'receipt',
    round(v_receipt.total_amount, 2),
    coalesce(v_receipt.description, 'Terima Pendapatan ' || v_receipt.receipt_no),
    'revenue_receipt',
    v_receipt.id,
    v_journal_entry_id,
    'posted',
    now(),
    v_actor_id,
    v_actor_id,
    now(),
    now()
  )
  returning id into v_cash_bank_transaction_id;

  update public.revenue_receipts
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_receipt.id;

  perform public.log_audit_event(
    p_tenant_id := v_receipt.tenant_id,
    p_unit_id := v_receipt.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'revenue_receipt_posted',
    p_entity_type := 'revenue_receipts',
    p_entity_id := v_receipt.id,
    p_source_type := 'unit_dashboard',
    p_source_id := v_receipt.id,
    p_description := 'Penerimaan pendapatan diposting: ' || v_receipt.receipt_no,
    p_metadata := jsonb_build_object(
      'receipt_no', v_receipt.receipt_no,
      'receipt_date', v_receipt.receipt_date,
      'total_amount', v_receipt.total_amount,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id
    )
  );

  return v_journal_entry_id;
end;
$$;

-- ============================================================================
-- 6. RPC wrapper: create and post
-- ============================================================================

create or replace function public.create_and_post_revenue_receipt(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_receipt_no text,
  p_receipt_date date,
  p_revenue_account_id uuid,
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
  v_revenue_receipt_id uuid;
  v_journal_entry_id uuid;
  v_result jsonb;
begin
  v_revenue_receipt_id := public.create_revenue_receipt(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_receipt_no := p_receipt_no,
    p_receipt_date := p_receipt_date,
    p_revenue_account_id := p_revenue_account_id,
    p_cash_bank_account_id := p_cash_bank_account_id,
    p_total_amount := p_total_amount,
    p_description := p_description
  );

  v_journal_entry_id := public.post_revenue_receipt(v_revenue_receipt_id);

  select jsonb_build_object(
    'revenue_receipt_id', rr.id,
    'journal_entry_id', rr.journal_entry_id,
    'cash_bank_transaction_id', rr.cash_bank_transaction_id,
    'receipt_no', rr.receipt_no,
    'receipt_date', rr.receipt_date,
    'total_amount', rr.total_amount,
    'status', rr.status
  )
  into v_result
  from public.revenue_receipts rr
  where rr.id = v_revenue_receipt_id;

  return v_result;
end;
$$;

-- ============================================================================
-- 7. Reporting / audit view
-- ============================================================================

create or replace view public.v_revenue_receipt_flow as
select
  rr.id as revenue_receipt_id,
  rr.tenant_id,
  rr.unit_id,
  bu.nama_unit,
  rr.receipt_no,
  rr.receipt_date,
  rr.revenue_account_id,
  revenue_coa.kode as revenue_account_code,
  revenue_coa.nama as revenue_account_name,
  rr.cash_bank_account_id,
  cba.account_code as cash_bank_account_code,
  cba.account_name as cash_bank_account_name,
  cba.account_kind as cash_bank_account_kind,
  rr.total_amount,
  rr.description,
  rr.status as receipt_status,
  rr.journal_entry_id,
  je.journal_no,
  je.status as journal_status,
  rr.cash_bank_transaction_id,
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
    where jl.journal_entry_id = rr.journal_entry_id
      and jl.account_id = cba.account_id
      and jl.debit = rr.total_amount
  ) as has_cash_debit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = rr.journal_entry_id
      and jl.account_id = rr.revenue_account_id
      and jl.credit = rr.total_amount
  ) as has_revenue_credit,
  case
    when rr.status <> 'posted' then 'NOT_POSTED'
    when rr.journal_entry_id is null then 'FAIL_NO_JOURNAL'
    when rr.cash_bank_transaction_id is null then 'FAIL_NO_CASH_BANK_TX'
    when je.status <> 'posted' then 'FAIL_JOURNAL_NOT_POSTED'
    when cbt.status <> 'posted' then 'FAIL_CASH_BANK_NOT_POSTED'
    when cbt.transaction_type <> 'receipt' then 'FAIL_CASH_BANK_TYPE'
    when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'FAIL_JOURNAL_NOT_BALANCED'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = rr.journal_entry_id
        and jl.account_id = cba.account_id
        and jl.debit = rr.total_amount
    ) then 'FAIL_NO_CASH_DEBIT'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = rr.journal_entry_id
        and jl.account_id = rr.revenue_account_id
        and jl.credit = rr.total_amount
    ) then 'FAIL_NO_REVENUE_CREDIT'
    when cbt.amount <> rr.total_amount then 'FAIL_CASH_AMOUNT_MISMATCH'
    else 'PASS'
  end as audit_result,
  rr.posted_at,
  rr.posted_by,
  rr.created_by,
  rr.created_at,
  rr.updated_at
from public.revenue_receipts rr
left join public.business_units bu
  on bu.id = rr.unit_id
left join public.chart_of_accounts revenue_coa
  on revenue_coa.id = rr.revenue_account_id
left join public.cash_bank_accounts cba
  on cba.id = rr.cash_bank_account_id
left join public.journal_entries je
  on je.id = rr.journal_entry_id
left join public.cash_bank_transactions cbt
  on cbt.id = rr.cash_bank_transaction_id
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit
  from public.journal_lines jl
  where jl.journal_entry_id = rr.journal_entry_id
) journal_totals on true;

create or replace view public.v_revenue_receipt_flow_audit as
select *
from public.v_revenue_receipt_flow;

grant select on public.revenue_receipts to authenticated;
grant select on public.v_revenue_receipt_flow to authenticated;
grant select on public.v_revenue_receipt_flow_audit to authenticated;

grant execute on function public.create_revenue_receipt(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

grant execute on function public.post_revenue_receipt(uuid) to authenticated;

grant execute on function public.create_and_post_revenue_receipt(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) to authenticated;

comment on table public.revenue_receipts is
'Terima Pendapatan engine: posted non-sales revenue receipts integrated with journal, cash-bank transaction, and audit timeline.';

comment on function public.create_and_post_revenue_receipt(
  uuid,
  uuid,
  text,
  date,
  uuid,
  uuid,
  numeric,
  text
) is
'Creates and posts non-sales revenue receipt: debit cash/bank, credit selected revenue account, create cash-bank receipt, and write audit timeline.';

comment on view public.v_revenue_receipt_flow is
'Audit/reporting view for Terima Pendapatan flow.';
