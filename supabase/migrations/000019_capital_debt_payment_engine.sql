-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000019: Capital Debt Payment Engine
--
-- Scope:
--   Pelunasan Hutang Belanja Modal.
--
-- Accounting flow:
--   Debit  : 2120 Utang Belanja Modal / capital expenditure liability account
--   Credit : Cash/Bank account selected by user
--
-- Engine rules:
--   - Only posted capital_expenditures with payment_type = credit can be paid.
--   - Payment amount must be > 0.
--   - Payment amount cannot exceed outstanding amount.
--   - Cash/bank balance must be sufficient.
--   - Creates journal entry and cash-bank payment.
--   - Updates capital_expenditures.paid_amount.
--   - Prevents direct mutation after posted/reversed.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Capital debt payments table
-- ============================================================================

create table if not exists public.capital_debt_payments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  capital_expenditure_id uuid not null references public.capital_expenditures(id) on delete restrict,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  payment_no text not null,
  payment_date date not null default current_date,

  payment_amount numeric(18,2) not null,
  notes text,

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'cancelled'::text, 'reversed'::text])),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint capital_debt_payments_amount_check
    check (payment_amount > 0),

  constraint capital_debt_payments_scope_no_unique
    unique nulls not distinct (tenant_id, unit_id, payment_no)
);

create index if not exists capital_debt_payments_tenant_idx
  on public.capital_debt_payments (tenant_id);

create index if not exists capital_debt_payments_unit_idx
  on public.capital_debt_payments (unit_id);

create index if not exists capital_debt_payments_capital_expenditure_idx
  on public.capital_debt_payments (capital_expenditure_id);

create index if not exists capital_debt_payments_cash_bank_account_idx
  on public.capital_debt_payments (cash_bank_account_id);

create index if not exists capital_debt_payments_status_idx
  on public.capital_debt_payments (status);

create index if not exists capital_debt_payments_payment_date_idx
  on public.capital_debt_payments (payment_date);

create index if not exists capital_debt_payments_journal_entry_idx
  on public.capital_debt_payments (journal_entry_id);

create index if not exists capital_debt_payments_cash_bank_transaction_idx
  on public.capital_debt_payments (cash_bank_transaction_id);

-- ============================================================================
-- 2. Scope validation / posted mutation guard
-- ============================================================================

create or replace function public.validate_capital_debt_payment_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_ce record;
begin
  if new.unit_id is null then
    raise exception 'unit_id wajib diisi untuk Pelunasan Hutang Belanja Modal';
  end if;

  select count(*)
  into v_count
  from public.business_units bu
  where bu.id = new.unit_id
    and bu.tenant_id = new.tenant_id;

  if v_count = 0 then
    raise exception 'Unit tidak sesuai dengan tenant pada Pelunasan Hutang Belanja Modal';
  end if;

  select ce.*
  into v_ce
  from public.capital_expenditures ce
  where ce.id = new.capital_expenditure_id;

  if v_ce.id is null then
    raise exception 'Belanja Modal tidak ditemukan';
  end if;

  if v_ce.tenant_id is distinct from new.tenant_id
    or v_ce.unit_id is distinct from new.unit_id then
    raise exception 'Belanja Modal tidak sesuai dengan tenant/unit pembayaran';
  end if;

  if v_ce.payment_type <> 'credit' then
    raise exception 'Hanya Belanja Modal kredit yang dapat dilunasi';
  end if;

  if v_ce.status <> 'posted' then
    raise exception 'Hanya Belanja Modal posted yang dapat dilunasi';
  end if;

  if v_ce.liability_account_id is null then
    raise exception 'Belanja Modal kredit tidak memiliki akun utang';
  end if;

  select count(*)
  into v_count
  from public.cash_bank_accounts cba
  where cba.id = new.cash_bank_account_id
    and cba.tenant_id = new.tenant_id
    and cba.unit_id is not distinct from new.unit_id
    and cba.is_active = true;

  if v_count = 0 then
    raise exception 'Akun kas/bank pembayaran hutang belanja modal tidak valid untuk tenant/unit ini';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_posted_capital_debt_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'reversed') then
    raise exception 'Pelunasan Hutang Belanja Modal yang sudah posted/reversed tidak boleh dihapus';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'reversed') then
    if new.status = old.status then
      raise exception 'Pelunasan Hutang Belanja Modal yang sudah posted/reversed tidak boleh diubah langsung';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_capital_debt_payments_set_updated_at
on public.capital_debt_payments;

drop trigger if exists trg_capital_debt_payments_validate_scope
on public.capital_debt_payments;

drop trigger if exists trg_prevent_posted_capital_debt_payment_mutation
on public.capital_debt_payments;

create trigger trg_capital_debt_payments_set_updated_at
before update on public.capital_debt_payments
for each row
execute function public.set_updated_at();

create trigger trg_capital_debt_payments_validate_scope
before insert or update on public.capital_debt_payments
for each row
execute function public.validate_capital_debt_payment_scope();

create trigger trg_prevent_posted_capital_debt_payment_mutation
before update or delete on public.capital_debt_payments
for each row
execute function public.prevent_posted_capital_debt_payment_mutation();

-- ============================================================================
-- 3. RPC: create capital debt payment draft
-- ============================================================================

create or replace function public.create_capital_debt_payment(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_capital_expenditure_id uuid,
  p_cash_bank_account_id uuid,
  p_payment_no text,
  p_payment_date date,
  p_payment_amount numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_ce record;
  v_total_existing_posted_payment numeric(18,2);
  v_outstanding_amount numeric(18,2);
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

  if p_capital_expenditure_id is null then
    raise exception 'Belanja Modal wajib dipilih';
  end if;

  if p_cash_bank_account_id is null then
    raise exception 'Akun kas/bank pembayaran wajib dipilih';
  end if;

  if p_payment_no is null or btrim(p_payment_no) = '' then
    raise exception 'Nomor Pelunasan Hutang Belanja Modal wajib diisi';
  end if;

  if p_payment_date is null then
    raise exception 'Tanggal pembayaran wajib diisi';
  end if;

  if p_payment_amount is null or p_payment_amount <= 0 then
    raise exception 'Nominal pembayaran harus lebih dari 0';
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

  select ce.*
  into v_ce
  from public.capital_expenditures ce
  where ce.id = p_capital_expenditure_id
    and ce.tenant_id = p_tenant_id
    and ce.unit_id = p_unit_id
  for update;

  if v_ce.id is null then
    raise exception 'Belanja Modal tidak ditemukan untuk tenant/unit ini';
  end if;

  if v_ce.payment_type <> 'credit' then
    raise exception 'Hanya Belanja Modal kredit yang dapat dilunasi';
  end if;

  if v_ce.status <> 'posted' then
    raise exception 'Hanya Belanja Modal posted yang dapat dilunasi';
  end if;

  if v_ce.liability_account_id is null then
    raise exception 'Belanja Modal kredit tidak memiliki akun utang';
  end if;

  if exists (
    select 1
    from public.capital_debt_payments cdp
    where cdp.tenant_id = p_tenant_id
      and cdp.unit_id = p_unit_id
      and cdp.payment_no = upper(btrim(p_payment_no))
  ) then
    raise exception 'Nomor Pelunasan Hutang Belanja Modal sudah digunakan dalam unit ini';
  end if;

  if not exists (
    select 1
    from public.cash_bank_accounts cba
    where cba.id = p_cash_bank_account_id
      and cba.tenant_id = p_tenant_id
      and cba.unit_id is not distinct from p_unit_id
      and cba.is_active = true
  ) then
    raise exception 'Akun kas/bank pembayaran tidak valid atau tidak aktif untuk unit ini';
  end if;

  select coalesce(sum(cdp.payment_amount), 0)
  into v_total_existing_posted_payment
  from public.capital_debt_payments cdp
  where cdp.capital_expenditure_id = p_capital_expenditure_id
    and cdp.status = 'posted';

  v_outstanding_amount := v_ce.total_amount - coalesce(v_total_existing_posted_payment, 0);

  if v_outstanding_amount <= 0 then
    raise exception 'Hutang Belanja Modal sudah lunas';
  end if;

  if round(p_payment_amount, 2) > round(v_outstanding_amount, 2) then
    raise exception 'Nominal pembayaran melebihi sisa hutang. Sisa: %, Dibayar: %',
      v_outstanding_amount,
      p_payment_amount;
  end if;

  insert into public.capital_debt_payments (
    tenant_id,
    unit_id,
    capital_expenditure_id,
    cash_bank_account_id,
    payment_no,
    payment_date,
    payment_amount,
    notes,
    status,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_capital_expenditure_id,
    p_cash_bank_account_id,
    upper(btrim(p_payment_no)),
    p_payment_date,
    round(p_payment_amount, 2),
    nullif(btrim(coalesce(p_notes, '')), ''),
    'draft',
    auth.uid()
  )
  returning id into v_payment_id;

  return v_payment_id;
end;
$$;

-- ============================================================================
-- 4. RPC: post capital debt payment
-- ============================================================================

create or replace function public.post_capital_debt_payment(
  p_capital_debt_payment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_ce record;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_cash_account_id uuid;
  v_liability_account_id uuid;
  v_total_existing_posted_payment numeric(18,2);
  v_outstanding_amount numeric(18,2);
  v_actor_role public.app_role;
  v_journal_no text;
  v_cash_transaction_no text;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select cdp.*
  into v_payment
  from public.capital_debt_payments cdp
  where cdp.id = p_capital_debt_payment_id
  for update;

  if v_payment.id is null then
    raise exception 'Pelunasan Hutang Belanja Modal tidak ditemukan';
  end if;

  if not public.can_access_unit(v_payment.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'purchase.manage',
    auth.uid(),
    v_payment.tenant_id,
    v_payment.unit_id
  );

  if v_payment.status <> 'draft' then
    raise exception 'Hanya Pelunasan Hutang Belanja Modal draft yang dapat diposting. Status saat ini: %', v_payment.status;
  end if;

  select ce.*
  into v_ce
  from public.capital_expenditures ce
  where ce.id = v_payment.capital_expenditure_id
    and ce.tenant_id = v_payment.tenant_id
    and ce.unit_id = v_payment.unit_id
  for update;

  if v_ce.id is null then
    raise exception 'Belanja Modal tidak ditemukan untuk pembayaran ini';
  end if;

  if v_ce.payment_type <> 'credit' then
    raise exception 'Hanya Belanja Modal kredit yang dapat dilunasi';
  end if;

  if v_ce.status <> 'posted' then
    raise exception 'Hanya Belanja Modal posted yang dapat dilunasi';
  end if;

  if v_ce.liability_account_id is null then
    raise exception 'Belanja Modal kredit tidak memiliki akun utang';
  end if;

  select coalesce(sum(cdp.payment_amount), 0)
  into v_total_existing_posted_payment
  from public.capital_debt_payments cdp
  where cdp.capital_expenditure_id = v_payment.capital_expenditure_id
    and cdp.status = 'posted';

  v_outstanding_amount := v_ce.total_amount - coalesce(v_total_existing_posted_payment, 0);

  if v_outstanding_amount <= 0 then
    raise exception 'Hutang Belanja Modal sudah lunas';
  end if;

  if round(v_payment.payment_amount, 2) > round(v_outstanding_amount, 2) then
    raise exception 'Nominal pembayaran melebihi sisa hutang. Sisa: %, Dibayar: %',
      v_outstanding_amount,
      v_payment.payment_amount;
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_payment.tenant_id
    and ap.unit_id = v_payment.unit_id
    and v_payment.payment_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi untuk tanggal Pelunasan Hutang Belanja Modal tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select cba.account_id
  into v_cash_account_id
  from public.cash_bank_accounts cba
  where cba.id = v_payment.cash_bank_account_id
    and cba.tenant_id = v_payment.tenant_id
    and cba.unit_id is not distinct from v_payment.unit_id
    and cba.is_active = true
  limit 1;

  if v_cash_account_id is null then
    raise exception 'Akun COA kas/bank pembayaran tidak ditemukan atau tidak aktif';
  end if;

  v_liability_account_id := v_ce.liability_account_id;

  perform public.assert_cash_bank_account_sufficient_balance(
    v_payment.tenant_id,
    v_payment.unit_id,
    v_cash_account_id,
    v_payment.payment_amount
  );

  if exists (
    select 1
    from public.journal_entries je
    where je.source_type = 'capital_debt_payment'
      and je.source_id = v_payment.id
  ) then
    raise exception 'Pelunasan Hutang Belanja Modal ini sudah memiliki jurnal';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.source_type = 'capital_debt_payment'
      and cbt.source_id = v_payment.id
  ) then
    raise exception 'Pelunasan Hutang Belanja Modal ini sudah memiliki transaksi kas/bank';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_payment.unit_id
      or ur.tenant_id = v_payment.tenant_id
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

  v_journal_no := 'JPBM-' || v_payment.payment_no;
  v_cash_transaction_no := 'CBPBM-' || v_payment.payment_no;

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
    v_payment.tenant_id,
    v_payment.unit_id,
    v_period_id,
    v_journal_no,
    v_payment.payment_date,
    'capital_debt_payment',
    v_payment.id,
    'Posting Pelunasan Hutang Belanja Modal ' || v_payment.payment_no,
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
    v_liability_account_id,
    1,
    'Pelunasan Utang Belanja Modal ' || v_ce.transaction_no,
    v_payment.payment_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_cash_account_id,
    2,
    'Kas/bank keluar untuk Pelunasan Hutang Belanja Modal ' || v_payment.payment_no,
    0,
    v_payment.payment_amount
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
    v_payment.tenant_id,
    v_payment.unit_id,
    v_payment.cash_bank_account_id,
    v_cash_transaction_no,
    v_payment.payment_date,
    'payment',
    'capital_debt_payment',
    v_payment.id,
    'Pembayaran Hutang Belanja Modal ' || v_payment.payment_no,
    v_payment.payment_amount,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_cash_bank_transaction_id;

  update public.capital_debt_payments
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id,
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_payment.id;

  update public.capital_expenditures
  set
    paid_amount = least(
      total_amount,
      coalesce(paid_amount, 0) + v_payment.payment_amount
    ),
    updated_at = now()
  where id = v_ce.id;

  perform public.log_audit_event(
    v_payment.tenant_id,
    v_payment.unit_id,
    auth.uid(),
    v_actor_role,
    'capital_debt_payment_posted'::text,
    'capital_debt_payments'::text,
    v_payment.id,
    'unit_dashboard'::text,
    v_ce.id,
    'Pelunasan Hutang Belanja Modal diposting.'::text,
    jsonb_build_object(
      'capital_debt_payment_id', v_payment.id,
      'capital_expenditure_id', v_ce.id,
      'payment_no', v_payment.payment_no,
      'capital_expenditure_no', v_ce.transaction_no,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'payment_amount', v_payment.payment_amount,
      'previous_paid_amount', v_ce.paid_amount,
      'new_paid_amount', least(v_ce.total_amount, coalesce(v_ce.paid_amount, 0) + v_payment.payment_amount),
      'total_amount', v_ce.total_amount
    )
  );

  return v_journal_entry_id;
end;
$$;

-- ============================================================================
-- 5. RPC wrapper: create and post
-- ============================================================================

create or replace function public.create_and_post_capital_debt_payment(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_capital_expenditure_id uuid,
  p_cash_bank_account_id uuid,
  p_payment_no text,
  p_payment_date date,
  p_payment_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;
  v_capital_expenditure_id uuid;
  v_total_amount numeric(18,2);
  v_paid_amount numeric(18,2);
  v_outstanding_amount numeric(18,2);
begin
  v_payment_id := public.create_capital_debt_payment(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_capital_expenditure_id := p_capital_expenditure_id,
    p_cash_bank_account_id := p_cash_bank_account_id,
    p_payment_no := p_payment_no,
    p_payment_date := p_payment_date,
    p_payment_amount := p_payment_amount,
    p_notes := p_notes
  );

  v_journal_entry_id := public.post_capital_debt_payment(v_payment_id);

  select
    cdp.cash_bank_transaction_id,
    cdp.capital_expenditure_id,
    ce.total_amount,
    ce.paid_amount,
    ce.total_amount - ce.paid_amount
  into
    v_cash_bank_transaction_id,
    v_capital_expenditure_id,
    v_total_amount,
    v_paid_amount,
    v_outstanding_amount
  from public.capital_debt_payments cdp
  join public.capital_expenditures ce on ce.id = cdp.capital_expenditure_id
  where cdp.id = v_payment_id;

  return jsonb_build_object(
    'capital_debt_payment_id', v_payment_id,
    'capital_expenditure_id', v_capital_expenditure_id,
    'journal_entry_id', v_journal_entry_id,
    'cash_bank_transaction_id', v_cash_bank_transaction_id,
    'payment_amount', round(p_payment_amount, 2),
    'total_amount', v_total_amount,
    'paid_amount', v_paid_amount,
    'outstanding_amount', v_outstanding_amount,
    'is_paid_off', v_outstanding_amount = 0,
    'status', 'posted'
  );
end;
$$;

-- ============================================================================
-- 6. Reporting / audit views
-- ============================================================================

create or replace view public.v_capital_debt_payment_flow_audit as
select
  cdp.id as capital_debt_payment_id,
  cdp.tenant_id,
  cdp.unit_id,
  cdp.payment_no,
  cdp.payment_date,
  cdp.payment_amount,
  cdp.status as payment_status,
  cdp.notes,
  cdp.capital_expenditure_id,
  ce.transaction_no as capital_expenditure_no,
  ce.transaction_date as capital_expenditure_date,
  ce.payment_type as capital_expenditure_payment_type,
  ce.total_amount as capital_expenditure_total_amount,
  ce.paid_amount as capital_expenditure_paid_amount,
  (ce.total_amount - ce.paid_amount) as capital_expenditure_outstanding_amount,
  liability_coa.kode as liability_account_code,
  liability_coa.nama as liability_account_name,
  cdp.cash_bank_account_id,
  cba.account_code as cash_bank_account_code,
  cba.account_name as cash_bank_account_name,
  cdp.journal_entry_id,
  je.journal_no,
  je.status as journal_status,
  cdp.cash_bank_transaction_id,
  cbt.transaction_no as cash_bank_transaction_no,
  cbt.transaction_type as cash_bank_transaction_type,
  cbt.status as cash_bank_transaction_status,
  coalesce(journal_totals.total_debit, 0)::numeric(18,2) as total_debit,
  coalesce(journal_totals.total_credit, 0)::numeric(18,2) as total_credit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = cdp.journal_entry_id
      and jl.account_id = ce.liability_account_id
      and jl.debit = cdp.payment_amount
  ) as has_liability_debit,
  exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = cdp.journal_entry_id
      and jl.account_id = cba.account_id
      and jl.credit = cdp.payment_amount
  ) as has_cash_credit,
  case
    when cdp.status <> 'posted' then 'NOT_POSTED'
    when cdp.journal_entry_id is null then 'FAIL_NO_JOURNAL'
    when cdp.cash_bank_transaction_id is null then 'FAIL_NO_CASH_BANK_TX'
    when je.status <> 'posted' then 'FAIL_JOURNAL_NOT_POSTED'
    when cbt.status <> 'posted' then 'FAIL_CASH_BANK_NOT_POSTED'
    when cbt.transaction_type <> 'payment' then 'FAIL_CASH_BANK_TYPE'
    when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'FAIL_JOURNAL_NOT_BALANCED'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = cdp.journal_entry_id
        and jl.account_id = ce.liability_account_id
        and jl.debit = cdp.payment_amount
    ) then 'FAIL_NO_LIABILITY_DEBIT'
    when not exists (
      select 1
      from public.journal_lines jl
      where jl.journal_entry_id = cdp.journal_entry_id
        and jl.account_id = cba.account_id
        and jl.credit = cdp.payment_amount
    ) then 'FAIL_NO_CASH_CREDIT'
    when cbt.amount <> cdp.payment_amount then 'FAIL_CASH_AMOUNT_MISMATCH'
    when ce.paid_amount > ce.total_amount then 'FAIL_OVERPAID_CAPITAL_EXPENDITURE'
    else 'PASS'
  end as audit_result,
  array_remove(array[
    case when cdp.status <> 'posted' then 'payment not posted' end,
    case when cdp.journal_entry_id is null then 'missing journal entry' end,
    case when cdp.cash_bank_transaction_id is null then 'missing cash-bank transaction' end,
    case when je.status <> 'posted' then 'journal not posted' end,
    case when cbt.status <> 'posted' then 'cash-bank transaction not posted' end,
    case when cbt.transaction_type <> 'payment' then 'cash-bank transaction type is not payment' end,
    case when coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'journal not balanced' end,
    case when ce.paid_amount > ce.total_amount then 'capital expenditure overpaid' end
  ], null) as audit_notes,
  cdp.created_at,
  cdp.updated_at,
  cdp.posted_at,
  cdp.posted_by,
  cdp.created_by
from public.capital_debt_payments cdp
join public.capital_expenditures ce
  on ce.id = cdp.capital_expenditure_id
left join public.chart_of_accounts liability_coa
  on liability_coa.id = ce.liability_account_id
left join public.cash_bank_accounts cba
  on cba.id = cdp.cash_bank_account_id
left join public.journal_entries je
  on je.id = cdp.journal_entry_id
left join public.cash_bank_transactions cbt
  on cbt.id = cdp.cash_bank_transaction_id
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit
  from public.journal_lines jl
  where jl.journal_entry_id = cdp.journal_entry_id
) journal_totals on true;

create or replace view public.v_capital_debt_payment_flow as
select *
from public.v_capital_debt_payment_flow_audit;

-- ============================================================================
-- 7. Grants / comments
-- ============================================================================

grant select on public.capital_debt_payments to authenticated;
grant select on public.v_capital_debt_payment_flow to authenticated;
grant select on public.v_capital_debt_payment_flow_audit to authenticated;

grant execute on function public.create_capital_debt_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) to authenticated;

grant execute on function public.post_capital_debt_payment(uuid) to authenticated;

grant execute on function public.create_and_post_capital_debt_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) to authenticated;

comment on table public.capital_debt_payments is
'Pelunasan Hutang Belanja Modal: debit utang belanja modal, kredit kas/bank, update paid_amount belanja modal, and audit trail.';

comment on function public.create_and_post_capital_debt_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) is
'Creates and posts capital debt payment for credit capital expenditure, with overpayment guard, cash/bank balance protection, journal, cash-bank payment, and audit timeline.';

comment on view public.v_capital_debt_payment_flow_audit is
'Audit/reporting view for Pelunasan Hutang Belanja Modal flow.';
