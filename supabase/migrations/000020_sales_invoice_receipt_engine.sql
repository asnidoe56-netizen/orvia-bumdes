-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000015: Sales Invoice Engine Alignment + Receivable Receipt Extension
--
-- DB-FIRST EVIDENCE:
--   Active sales engine already consists of:
--   - sales_invoices
--   - sales_invoice_lines
--   - create_sales_invoice()
--   - post_sales_invoice()
--   - create_and_post_sales_invoice()
--   - v_sales_invoice_flow_audit
--   - inventory_movements integration
--
-- This migration packages the missing fresh-install extension:
--   - sales_invoice_receipts
--   - create_and_post_sales_invoice_receipt()
--   - v_sales_receivable_flow
--   - posted invoice guard patch to allow controlled paid_amount update
--
-- Important compatibility decisions:
--   - chart_of_accounts uses kode/nama, not account_code/account_name.
--   - cash_bank_transactions uses transaction_type, not direction.
--   - accounting period validation uses assert_period_open(period_id).
--   - log_audit_event requires the full actor/event signature.
--   - sales_invoices.status currently supports draft/posted/cancelled/reversed,
--     so credit invoice settlement updates paid_amount while keeping status posted.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Controlled guard patch for posted sales invoices
-- ============================================================================

create or replace function public.prevent_posted_sales_invoice_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'reversed') then
    raise exception 'posted, cancelled, or reversed sales invoice cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled', 'reversed') then
    if new.tenant_id is distinct from old.tenant_id
      or new.unit_id is distinct from old.unit_id
      or new.customer_id is distinct from old.customer_id
      or new.invoice_no is distinct from old.invoice_no
      or new.invoice_date is distinct from old.invoice_date
      or new.due_date is distinct from old.due_date
      or new.payment_type is distinct from old.payment_type
      or new.subtotal is distinct from old.subtotal
      or new.discount_amount is distinct from old.discount_amount
      or new.tax_amount is distinct from old.tax_amount
      or new.total_amount is distinct from old.total_amount
      or new.notes is distinct from old.notes
      or new.journal_entry_id is distinct from old.journal_entry_id
      or new.posted_at is distinct from old.posted_at
      or new.posted_by is distinct from old.posted_by
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'posted, cancelled, or reversed sales invoice cannot be changed directly'
        using errcode = '42501';
    end if;

    if new.paid_amount < old.paid_amount then
      raise exception 'paid_amount cannot be decreased directly on posted sales invoice'
        using errcode = '23514';
    end if;

    if new.paid_amount > new.total_amount then
      raise exception 'paid_amount cannot exceed total_amount on sales invoice'
        using errcode = '23514';
    end if;

    if old.status in ('cancelled', 'reversed')
      and new.paid_amount is distinct from old.paid_amount
    then
      raise exception 'paid_amount cannot be changed for cancelled or reversed sales invoice'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

-- Existing trigger name is preserved. Fresh install safety:
drop trigger if exists trg_prevent_posted_sales_invoice_mutation on public.sales_invoices;

create trigger trg_prevent_posted_sales_invoice_mutation
before update or delete on public.sales_invoices
for each row
execute function public.prevent_posted_sales_invoice_mutation();

-- ============================================================================
-- 2. Sales invoice receipts table
-- ============================================================================

create table if not exists public.sales_invoice_receipts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  sales_invoice_id uuid not null references public.sales_invoices(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  receipt_no text not null,
  receipt_date date not null default current_date,
  amount numeric(18,2) not null check (amount > 0),
  notes text,

  status text not null default 'posted'
    check (status = any (array['posted'::text, 'cancelled'::text, 'reversed'::text])),

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

  constraint sales_invoice_receipts_scope_no_unique
    unique (tenant_id, unit_id, receipt_no)
);

create index if not exists sales_invoice_receipts_tenant_idx
  on public.sales_invoice_receipts (tenant_id);

create index if not exists sales_invoice_receipts_unit_idx
  on public.sales_invoice_receipts (unit_id);

create index if not exists sales_invoice_receipts_invoice_idx
  on public.sales_invoice_receipts (sales_invoice_id);

create index if not exists sales_invoice_receipts_customer_idx
  on public.sales_invoice_receipts (customer_id);

create index if not exists sales_invoice_receipts_status_idx
  on public.sales_invoice_receipts (status);

drop trigger if exists trg_sales_invoice_receipts_set_updated_at on public.sales_invoice_receipts;

create trigger trg_sales_invoice_receipts_set_updated_at
before update on public.sales_invoice_receipts
for each row
execute function public.set_updated_at();

-- ============================================================================
-- 3. Receipt mutation guard
-- ============================================================================

create or replace function public.prevent_posted_sales_invoice_receipt_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'reversed') then
    raise exception 'posted, cancelled, or reversed sales invoice receipt cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled', 'reversed') then
    if new.tenant_id is distinct from old.tenant_id
      or new.unit_id is distinct from old.unit_id
      or new.sales_invoice_id is distinct from old.sales_invoice_id
      or new.customer_id is distinct from old.customer_id
      or new.cash_bank_account_id is distinct from old.cash_bank_account_id
      or new.receipt_no is distinct from old.receipt_no
      or new.receipt_date is distinct from old.receipt_date
      or new.amount is distinct from old.amount
      or new.notes is distinct from old.notes
      or new.journal_entry_id is distinct from old.journal_entry_id
      or new.cash_bank_transaction_id is distinct from old.cash_bank_transaction_id
      or new.posted_at is distinct from old.posted_at
      or new.posted_by is distinct from old.posted_by
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception 'posted, cancelled, or reversed sales invoice receipt cannot be changed directly'
        using errcode = '42501';
    end if;

    return new;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_prevent_posted_sales_invoice_receipt_mutation
on public.sales_invoice_receipts;

create trigger trg_prevent_posted_sales_invoice_receipt_mutation
before update or delete on public.sales_invoice_receipts
for each row
execute function public.prevent_posted_sales_invoice_receipt_mutation();

-- ============================================================================
-- 4. RPC: create and post sales invoice receipt
-- ============================================================================
-- Flow:
--   Dr selected Cash/Bank COA
--     Cr 1130 Piutang Penjualan Kredit
--
-- Notes:
--   - Only credit sales invoices can be settled here.
--   - Invoice status remains posted because active constraint does not include paid.
--   - paid_amount is updated under controlled posted-invoice guard.
-- ============================================================================

create or replace function public.create_and_post_sales_invoice_receipt(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_sales_invoice_id uuid,
  p_cash_bank_account_id uuid,
  p_receipt_no text,
  p_receipt_date date,
  p_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_period_id uuid;

  v_receipt_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;

  v_cash_account_id uuid;
  v_receivable_account_id uuid;

  v_journal_no text;
  v_cash_transaction_no text;

  v_remaining_amount numeric(18,2);
  v_actor_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if not public.can_access_unit(p_unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(p_receipt_no), '') is null then
    raise exception 'Nomor penerimaan piutang penjualan wajib diisi';
  end if;

  if p_receipt_date is null then
    raise exception 'Tanggal penerimaan piutang penjualan wajib diisi';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal penerimaan piutang harus lebih dari 0';
  end if;

  select si.*
  into v_invoice
  from public.sales_invoices si
  where si.id = p_sales_invoice_id
    and si.tenant_id = p_tenant_id
    and si.unit_id = p_unit_id
  for update;

  if v_invoice.id is null then
    raise exception 'Invoice penjualan tidak ditemukan';
  end if;

  if v_invoice.payment_type <> 'credit' then
    raise exception 'Penerimaan piutang hanya berlaku untuk invoice penjualan kredit';
  end if;

  if v_invoice.status <> 'posted' then
    raise exception 'Hanya invoice penjualan kredit berstatus posted yang dapat dilunasi. Status saat ini: %',
      v_invoice.status;
  end if;

  if v_invoice.total_amount <= 0 then
    raise exception 'Total invoice penjualan tidak valid';
  end if;

  v_remaining_amount := v_invoice.total_amount - v_invoice.paid_amount;

  if v_remaining_amount <= 0 then
    raise exception 'Invoice penjualan ini sudah lunas';
  end if;

  if p_amount > v_remaining_amount then
    raise exception 'Nominal penerimaan Rp % melebihi sisa piutang Rp %',
      trim(to_char(p_amount, 'FM999G999G999G999G990D00')),
      trim(to_char(v_remaining_amount, 'FM999G999G999G999G990D00'));
  end if;

  if exists (
    select 1
    from public.sales_invoice_receipts sir
    where sir.tenant_id = p_tenant_id
      and sir.unit_id = p_unit_id
      and sir.receipt_no = upper(trim(p_receipt_no))
  ) then
    raise exception 'Nomor penerimaan piutang penjualan sudah digunakan dalam unit ini';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = p_tenant_id
    and ap.unit_id = p_unit_id
    and p_receipt_date between ap.period_start and ap.period_end
  limit 1;

  perform public.assert_period_open(v_period_id);

  select cba.account_id
  into v_cash_account_id
  from public.cash_bank_accounts cba
  where cba.id = p_cash_bank_account_id
    and cba.tenant_id = p_tenant_id
    and cba.unit_id = p_unit_id
    and cba.is_active = true
  limit 1;

  if v_cash_account_id is null then
    raise exception 'Akun kas/bank aktif tidak ditemukan';
  end if;

  select coa.id
  into v_receivable_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.kode = '1130'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_receivable_account_id is null then
    raise exception 'Akun Piutang Penjualan Kredit kode 1130 tidak ditemukan atau tidak aktif';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = p_unit_id
      or ur.tenant_id = p_tenant_id
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

  v_journal_no := 'JRP-' || upper(trim(p_receipt_no));
  v_cash_transaction_no := 'CBR-' || upper(trim(p_receipt_no));

  insert into public.sales_invoice_receipts (
    tenant_id,
    unit_id,
    sales_invoice_id,
    customer_id,
    cash_bank_account_id,
    receipt_no,
    receipt_date,
    amount,
    notes,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_sales_invoice_id,
    v_invoice.customer_id,
    p_cash_bank_account_id,
    upper(trim(p_receipt_no)),
    p_receipt_date,
    p_amount,
    nullif(trim(coalesce(p_notes, '')), ''),
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_receipt_id;

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
    p_tenant_id,
    p_unit_id,
    v_period_id,
    v_journal_no,
    p_receipt_date,
    'sales_invoice_receipt',
    v_receipt_id,
    'Penerimaan piutang penjualan ' || v_invoice.invoice_no,
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
    v_cash_account_id,
    1,
    'Kas/bank masuk dari pelunasan piutang ' || v_invoice.invoice_no,
    p_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_receivable_account_id,
    2,
    'Pengurangan piutang penjualan kredit ' || v_invoice.invoice_no,
    0,
    p_amount
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
    p_tenant_id,
    p_unit_id,
    p_cash_bank_account_id,
    v_cash_transaction_no,
    p_receipt_date,
    'receipt',
    'sales_invoice_receipt',
    v_receipt_id,
    'Penerimaan piutang penjualan ' || v_invoice.invoice_no,
    p_amount,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_cash_bank_transaction_id;

  update public.sales_invoice_receipts
  set
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id,
    updated_at = now()
  where id = v_receipt_id;

  update public.sales_invoices
  set
    paid_amount = paid_amount + p_amount,
    updated_at = now()
  where id = p_sales_invoice_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'sales_invoice_receipt_posted'::text,
    'sales_invoice_receipts'::text,
    v_receipt_id,
    'unit_dashboard'::text,
    v_receipt_id,
    'Penerimaan piutang penjualan kredit diposting.'::text,
    jsonb_build_object(
      'sales_invoice_id', p_sales_invoice_id,
      'sales_invoice_receipt_id', v_receipt_id,
      'invoice_no', v_invoice.invoice_no,
      'receipt_no', upper(trim(p_receipt_no)),
      'amount', p_amount,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id,
      'remaining_before', v_remaining_amount,
      'remaining_after', v_remaining_amount - p_amount
    )
  );

  return jsonb_build_object(
    'sales_invoice_id', p_sales_invoice_id,
    'sales_invoice_receipt_id', v_receipt_id,
    'journal_entry_id', v_journal_entry_id,
    'cash_bank_transaction_id', v_cash_bank_transaction_id,
    'amount', p_amount,
    'remaining_before', v_remaining_amount,
    'remaining_after', v_remaining_amount - p_amount,
    'status', 'posted'
  );
end;
$$;

-- ============================================================================
-- 5. Receivable reporting/audit view
-- ============================================================================

create or replace view public.v_sales_receivable_flow as
with receipt_summary as (
  select
    sir.sales_invoice_id,
    count(*) filter (where sir.status = 'posted') as receipt_count,
    coalesce(sum(sir.amount) filter (where sir.status = 'posted'), 0)::numeric(18,2) as total_receipt_amount,
    count(distinct sir.journal_entry_id) filter (where sir.status = 'posted') as receipt_journal_count,
    count(distinct sir.cash_bank_transaction_id) filter (where sir.status = 'posted') as receipt_cash_tx_count
  from public.sales_invoice_receipts sir
  group by sir.sales_invoice_id
),
journal_receipt_summary as (
  select
    sir.sales_invoice_id,
    coalesce(sum(jl.debit), 0)::numeric(18,2) as total_receipt_debit,
    coalesce(sum(jl.credit), 0)::numeric(18,2) as total_receipt_credit
  from public.sales_invoice_receipts sir
  join public.journal_entries je
    on je.id = sir.journal_entry_id
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  where sir.status = 'posted'
  group by sir.sales_invoice_id
)
select
  si.id as sales_invoice_id,
  si.tenant_id,
  si.unit_id,
  bu.nama_unit,
  si.customer_id,
  c.customer_code,
  c.customer_name,
  si.invoice_no,
  si.invoice_date,
  si.due_date,
  si.payment_type,
  si.status as invoice_status,
  si.total_amount,
  si.paid_amount,
  (si.total_amount - si.paid_amount)::numeric(18,2) as remaining_amount,
  coalesce(rs.receipt_count, 0) as receipt_count,
  coalesce(rs.total_receipt_amount, 0)::numeric(18,2) as total_receipt_amount,
  coalesce(rs.receipt_journal_count, 0) as receipt_journal_count,
  coalesce(rs.receipt_cash_tx_count, 0) as receipt_cash_tx_count,
  coalesce(jrs.total_receipt_debit, 0)::numeric(18,2) as total_receipt_debit,
  coalesce(jrs.total_receipt_credit, 0)::numeric(18,2) as total_receipt_credit,
  case
    when si.payment_type <> 'credit' then 'NOT_CREDIT_SALE'
    when si.status <> 'posted' then 'NOT_POSTED'
    when si.paid_amount = 0 then 'OPEN_RECEIVABLE'
    when si.paid_amount < si.total_amount then 'PARTIAL_RECEIVED'
    when si.paid_amount = si.total_amount then 'FULLY_RECEIVED'
    when si.paid_amount > si.total_amount then 'OVER_RECEIVED'
    else 'CHECK_RECEIVABLE'
  end as receivable_status,
  case
    when si.payment_type <> 'credit' then 'N/A'
    when si.paid_amount > si.total_amount then 'FAIL'
    when coalesce(rs.total_receipt_amount, 0) <> si.paid_amount then 'FAIL'
    when coalesce(jrs.total_receipt_debit, 0) <> coalesce(jrs.total_receipt_credit, 0) then 'FAIL'
    else 'PASS'
  end as audit_result,
  si.created_at,
  si.updated_at
from public.sales_invoices si
left join public.business_units bu
  on bu.id = si.unit_id
left join public.customers c
  on c.id = si.customer_id
left join receipt_summary rs
  on rs.sales_invoice_id = si.id
left join journal_receipt_summary jrs
  on jrs.sales_invoice_id = si.id;

grant select on public.sales_invoice_receipts to authenticated;
grant select on public.v_sales_receivable_flow to authenticated;

grant execute on function public.create_and_post_sales_invoice_receipt(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) to authenticated;

comment on table public.sales_invoice_receipts is
'Posted receipts for credit sales invoices, integrated with journal and cash-bank transactions.';

comment on function public.create_and_post_sales_invoice_receipt(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) is
'Creates and posts receipt for credit sales invoice: debit cash/bank, credit receivable 1130, update paid_amount, write audit timeline.';

comment on view public.v_sales_receivable_flow is
'Audit/reporting view for credit sales receivable settlement flow.';
