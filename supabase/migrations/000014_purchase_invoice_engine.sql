-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000014: Purchase Invoice Engine
-- Scope:
--   - Pembelian barang dagangan / persediaan
--   - Pembelian tunai dan kredit
--   - Pelunasan utang pembelian
--   - Journal + cash-bank + audit timeline integration
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_TEST
--
-- Notes:
--   - Designed for fresh-install commercial baseline.
--   - Supplier master comes from 000011_supplier_customer_master_engine.sql.
--   - Inventory item master comes from 000012_inventory_item_master_engine.sql.
--   - Cash-bank engine comes from 000008_cash_bank_engine.sql.
--   - Journal engine comes from 000006_accounting_period_journal_engine.sql.
-- ============================================================================

create table if not exists public.purchase_invoices (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.business_units(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,

  invoice_no text not null,
  invoice_date date not null,
  due_date date,

  payment_type text not null default 'cash'
    check (payment_type in ('cash', 'credit')),

  status text not null default 'draft'
    check (status in ('draft', 'posted', 'partially_paid', 'paid', 'cancelled')),

  subtotal numeric(18,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(18,2) not null default 0 check (total_amount >= 0),
  paid_amount numeric(18,2) not null default 0 check (paid_amount >= 0),

  notes text,

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_invoices_scope_no_unique unique (tenant_id, unit_id, invoice_no),
  constraint purchase_invoices_paid_not_over_total check (paid_amount <= total_amount)
);

create table if not exists public.purchase_invoice_lines (
  id uuid primary key default gen_random_uuid(),

  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,

  line_no integer not null,
  description text,

  quantity numeric(18,2) not null check (quantity > 0),
  unit_cost numeric(18,2) not null check (unit_cost >= 0),
  discount_amount numeric(18,2) not null default 0 check (discount_amount >= 0),
  tax_amount numeric(18,2) not null default 0 check (tax_amount >= 0),
  line_total numeric(18,2) not null check (line_total >= 0),

  created_at timestamptz not null default now(),

  constraint purchase_invoice_lines_unique unique (purchase_invoice_id, line_no)
);

create table if not exists public.purchase_invoice_payments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete restrict,
  unit_id uuid not null references public.business_units(id) on delete restrict,
  purchase_invoice_id uuid not null references public.purchase_invoices(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,

  payment_no text not null,
  payment_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  notes text,

  status text not null default 'posted'
    check (status in ('posted', 'cancelled')),

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id) on delete restrict,

  posted_at timestamptz not null default now(),
  posted_by uuid references auth.users(id) on delete set null,

  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_invoice_payments_scope_no_unique unique (tenant_id, unit_id, payment_no)
);

create index if not exists purchase_invoices_tenant_idx
  on public.purchase_invoices (tenant_id);

create index if not exists purchase_invoices_unit_idx
  on public.purchase_invoices (unit_id);

create index if not exists purchase_invoices_supplier_idx
  on public.purchase_invoices (supplier_id);

create index if not exists purchase_invoices_status_idx
  on public.purchase_invoices (status);

create index if not exists purchase_invoice_lines_invoice_idx
  on public.purchase_invoice_lines (purchase_invoice_id);

create index if not exists purchase_invoice_lines_item_idx
  on public.purchase_invoice_lines (item_id);

create index if not exists idx_purchase_invoice_payments_tenant_unit
  on public.purchase_invoice_payments (tenant_id, unit_id);

create index if not exists idx_purchase_invoice_payments_invoice_id
  on public.purchase_invoice_payments (purchase_invoice_id);

create index if not exists idx_purchase_invoice_payments_status
  on public.purchase_invoice_payments (status);

-- ============================================================================
-- updated_at helper
-- ============================================================================

create or replace function public.set_purchase_invoice_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_purchase_invoices_updated_at on public.purchase_invoices;
create trigger trg_purchase_invoices_updated_at
before update on public.purchase_invoices
for each row
execute function public.set_purchase_invoice_updated_at();

drop trigger if exists trg_purchase_invoice_payments_updated_at on public.purchase_invoice_payments;
create trigger trg_purchase_invoice_payments_updated_at
before update on public.purchase_invoice_payments
for each row
execute function public.set_purchase_invoice_updated_at();

-- ============================================================================
-- Posted document mutation guard
-- ============================================================================

create or replace function public.prevent_posted_purchase_invoice_mutation()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('posted', 'partially_paid', 'paid', 'cancelled') then
    if (
      old.tenant_id is distinct from new.tenant_id or
      old.unit_id is distinct from new.unit_id or
      old.supplier_id is distinct from new.supplier_id or
      old.invoice_no is distinct from new.invoice_no or
      old.invoice_date is distinct from new.invoice_date or
      old.payment_type is distinct from new.payment_type or
      old.subtotal is distinct from new.subtotal or
      old.discount_amount is distinct from new.discount_amount or
      old.tax_amount is distinct from new.tax_amount or
      old.total_amount is distinct from new.total_amount or
      old.journal_entry_id is distinct from new.journal_entry_id
    ) then
      raise exception 'Posted purchase invoice cannot be mutated. Use correction/cancellation governance.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_posted_purchase_invoice_mutation on public.purchase_invoices;
create trigger trg_prevent_posted_purchase_invoice_mutation
before update on public.purchase_invoices
for each row
execute function public.prevent_posted_purchase_invoice_mutation();

create or replace function public.prevent_purchase_invoice_line_mutation_after_posted()
returns trigger
language plpgsql
as $$
declare
  v_status text;
begin
  select status
  into v_status
  from public.purchase_invoices
  where id = coalesce(old.purchase_invoice_id, new.purchase_invoice_id);

  if v_status in ('posted', 'partially_paid', 'paid', 'cancelled') then
    raise exception 'Purchase invoice lines cannot be changed after invoice is posted.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_purchase_invoice_lines_no_update_after_posted on public.purchase_invoice_lines;
create trigger trg_purchase_invoice_lines_no_update_after_posted
before update or delete on public.purchase_invoice_lines
for each row
execute function public.prevent_purchase_invoice_line_mutation_after_posted();

-- ============================================================================
-- Internal helper: find COA account by code
-- ============================================================================

create or replace function public.get_purchase_engine_account_id(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_account_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  select id
  into v_account_id
  from public.chart_of_accounts
  where tenant_id = p_tenant_id
    and (
      unit_id = p_unit_id
      or unit_id is null
    )
    and account_code = p_account_code
    and is_postable = true
    and is_active = true
  order by
    case when unit_id = p_unit_id then 0 else 1 end
  limit 1;

  if v_account_id is null then
    raise exception 'Required COA account % not found for tenant %, unit %',
      p_account_code, p_tenant_id, p_unit_id;
  end if;

  return v_account_id;
end;
$$;

-- ============================================================================
-- RPC: create and post purchase invoice
-- ============================================================================
-- Expected p_lines JSONB:
-- [
--   {
--     "item_id": "uuid",
--     "description": "Barang A",
--     "quantity": 10,
--     "unit_cost": 5000,
--     "discount_amount": 0,
--     "tax_amount": 0
--   }
-- ]
--
-- Accounting:
--   Cash purchase:
--     Dr 1300 Persediaan
--       Cr 1110 Kas/Bank melalui selected cash_bank_account COA
--
--   Credit purchase:
--     Dr 1300 Persediaan
--       Cr 2100 Utang Usaha
-- ============================================================================

create or replace function public.create_and_post_purchase_invoice(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_supplier_id uuid,
  p_invoice_no text,
  p_invoice_date date,
  p_due_date date,
  p_payment_type text,
  p_lines jsonb,
  p_cash_bank_account_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;

  v_inventory_account_id uuid;
  v_payable_account_id uuid;
  v_cash_account_id uuid;

  v_line jsonb;
  v_line_no integer := 0;
  v_item_id uuid;
  v_description text;
  v_quantity numeric(18,2);
  v_unit_cost numeric(18,2);
  v_discount_amount numeric(18,2);
  v_tax_amount numeric(18,2);
  v_line_total numeric(18,2);

  v_subtotal numeric(18,2) := 0;
  v_total_discount numeric(18,2) := 0;
  v_total_tax numeric(18,2) := 0;
  v_total_amount numeric(18,2) := 0;

  v_cash_bank_account_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_payment_type not in ('cash', 'credit') then
    raise exception 'Invalid payment_type %. Allowed: cash, credit.', p_payment_type;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Purchase invoice requires at least one line.';
  end if;

  perform public.assert_period_open(p_tenant_id, p_unit_id, p_invoice_date);

  select id
  into v_invoice_id
  from public.purchase_invoices
  where tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and invoice_no = p_invoice_no;

  if v_invoice_id is not null then
    raise exception 'Purchase invoice number % already exists in this unit.', p_invoice_no;
  end if;

  perform 1
  from public.suppliers
  where id = p_supplier_id
    and tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and is_active = true;

  if not found then
    raise exception 'Supplier not found or inactive for this tenant/unit.';
  end if;

  if p_payment_type = 'cash' and p_cash_bank_account_id is null then
    raise exception 'Cash purchase requires cash_bank_account_id.';
  end if;

  if p_payment_type = 'cash' then
    select account_code
    into v_cash_bank_account_code
    from public.cash_bank_accounts
    where id = p_cash_bank_account_id
      and tenant_id = p_tenant_id
      and unit_id = p_unit_id
      and is_active = true;

    if v_cash_bank_account_code is null then
      raise exception 'Cash-bank account not found or inactive for this tenant/unit.';
    end if;
  end if;

  v_inventory_account_id := public.get_purchase_engine_account_id(p_tenant_id, p_unit_id, '1300');

  if p_payment_type = 'credit' then
    v_payable_account_id := public.get_purchase_engine_account_id(p_tenant_id, p_unit_id, '2100');
  else
    v_cash_account_id := public.get_purchase_engine_account_id(p_tenant_id, p_unit_id, v_cash_bank_account_code);
  end if;

  insert into public.purchase_invoices (
    tenant_id,
    unit_id,
    supplier_id,
    invoice_no,
    invoice_date,
    due_date,
    payment_type,
    status,
    notes,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_supplier_id,
    p_invoice_no,
    p_invoice_date,
    p_due_date,
    p_payment_type,
    'draft',
    p_notes,
    auth.uid()
  )
  returning id into v_invoice_id;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_no := v_line_no + 1;
    v_item_id := (v_line ->> 'item_id')::uuid;
    v_description := nullif(v_line ->> 'description', '');
    v_quantity := coalesce((v_line ->> 'quantity')::numeric, 0);
    v_unit_cost := coalesce((v_line ->> 'unit_cost')::numeric, 0);
    v_discount_amount := coalesce((v_line ->> 'discount_amount')::numeric, 0);
    v_tax_amount := coalesce((v_line ->> 'tax_amount')::numeric, 0);

    if v_quantity <= 0 then
      raise exception 'Line % quantity must be greater than zero.', v_line_no;
    end if;

    if v_unit_cost < 0 then
      raise exception 'Line % unit_cost cannot be negative.', v_line_no;
    end if;

    perform 1
    from public.inventory_items
    where id = v_item_id
      and tenant_id = p_tenant_id
      and unit_id = p_unit_id
      and is_active = true;

    if not found then
      raise exception 'Inventory item % not found or inactive for this tenant/unit.', v_item_id;
    end if;

    v_line_total := (v_quantity * v_unit_cost) - v_discount_amount + v_tax_amount;

    if v_line_total < 0 then
      raise exception 'Line % total cannot be negative.', v_line_no;
    end if;

    insert into public.purchase_invoice_lines (
      purchase_invoice_id,
      item_id,
      line_no,
      description,
      quantity,
      unit_cost,
      discount_amount,
      tax_amount,
      line_total
    )
    values (
      v_invoice_id,
      v_item_id,
      v_line_no,
      v_description,
      v_quantity,
      v_unit_cost,
      v_discount_amount,
      v_tax_amount,
      v_line_total
    );

    v_subtotal := v_subtotal + (v_quantity * v_unit_cost);
    v_total_discount := v_total_discount + v_discount_amount;
    v_total_tax := v_total_tax + v_tax_amount;
    v_total_amount := v_total_amount + v_line_total;
  end loop;

  if v_total_amount <= 0 then
    raise exception 'Purchase invoice total amount must be greater than zero.';
  end if;

  if p_payment_type = 'cash' then
    perform public.assert_cash_bank_account_sufficient_balance(
      p_cash_bank_account_id,
      v_total_amount
    );
  end if;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
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
    p_tenant_id,
    p_unit_id,
    'JRN-' || p_invoice_no,
    p_invoice_date,
    'purchase_invoice',
    v_invoice_id,
    'Pembelian ' || upper(p_payment_type) || ' - ' || p_invoice_no,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  )
  values (
    v_journal_entry_id,
    v_inventory_account_id,
    v_total_amount,
    0,
    'Persediaan dari pembelian ' || p_invoice_no
  );

  if p_payment_type = 'credit' then
    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_entry_id,
      v_payable_account_id,
      0,
      v_total_amount,
      'Utang pembelian ' || p_invoice_no
    );
  else
    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_entry_id,
      v_cash_account_id,
      0,
      v_total_amount,
      'Kas/bank keluar untuk pembelian ' || p_invoice_no
    );

    insert into public.cash_bank_transactions (
      tenant_id,
      unit_id,
      cash_bank_account_id,
      transaction_no,
      transaction_date,
      direction,
      amount,
      source_type,
      source_id,
      description,
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
      'CB-' || p_invoice_no,
      p_invoice_date,
      'out',
      v_total_amount,
      'purchase_invoice',
      v_invoice_id,
      'Pembayaran tunai pembelian ' || p_invoice_no,
      'posted',
      v_journal_entry_id,
      now(),
      auth.uid(),
      auth.uid()
    )
    returning id into v_cash_bank_transaction_id;
  end if;

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.purchase_invoices
  set
    subtotal = v_subtotal,
    discount_amount = v_total_discount,
    tax_amount = v_total_tax,
    total_amount = v_total_amount,
    paid_amount = case when p_payment_type = 'cash' then v_total_amount else 0 end,
    status = case when p_payment_type = 'cash' then 'paid' else 'posted' end,
    journal_entry_id = v_journal_entry_id,
    posted_at = now(),
    posted_by = auth.uid()
  where id = v_invoice_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    'purchase_invoice.posted',
    'purchase_invoice',
    v_invoice_id,
    jsonb_build_object(
      'invoice_no', p_invoice_no,
      'payment_type', p_payment_type,
      'total_amount', v_total_amount,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id
    )
  );

  return v_invoice_id;
end;
$$;

-- ============================================================================
-- RPC: create and post purchase invoice payment
-- ============================================================================
-- Accounting:
--   Dr 2100 Utang Usaha
--     Cr selected cash/bank account
-- ============================================================================

create or replace function public.create_and_post_purchase_invoice_payment(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_purchase_invoice_id uuid,
  p_cash_bank_account_id uuid,
  p_payment_no text,
  p_payment_date date,
  p_amount numeric,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_supplier_id uuid;
  v_invoice_no text;
  v_invoice_status text;
  v_total_amount numeric(18,2);
  v_paid_amount numeric(18,2);
  v_remaining_amount numeric(18,2);

  v_journal_entry_id uuid;
  v_cash_bank_transaction_id uuid;

  v_payable_account_id uuid;
  v_cash_account_id uuid;
  v_cash_bank_account_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  perform public.assert_period_open(p_tenant_id, p_unit_id, p_payment_date);

  select
    supplier_id,
    invoice_no,
    status,
    total_amount,
    paid_amount,
    total_amount - paid_amount
  into
    v_supplier_id,
    v_invoice_no,
    v_invoice_status,
    v_total_amount,
    v_paid_amount,
    v_remaining_amount
  from public.purchase_invoices
  where id = p_purchase_invoice_id
    and tenant_id = p_tenant_id
    and unit_id = p_unit_id
  for update;

  if v_invoice_no is null then
    raise exception 'Purchase invoice not found for this tenant/unit.';
  end if;

  if v_invoice_status not in ('posted', 'partially_paid') then
    raise exception 'Only posted or partially_paid credit purchase invoices can be paid. Current status: %', v_invoice_status;
  end if;

  if p_amount > v_remaining_amount then
    raise exception 'Payment amount % exceeds remaining payable %.', p_amount, v_remaining_amount;
  end if;

  select account_code
  into v_cash_bank_account_code
  from public.cash_bank_accounts
  where id = p_cash_bank_account_id
    and tenant_id = p_tenant_id
    and unit_id = p_unit_id
    and is_active = true;

  if v_cash_bank_account_code is null then
    raise exception 'Cash-bank account not found or inactive for this tenant/unit.';
  end if;

  perform public.assert_cash_bank_account_sufficient_balance(
    p_cash_bank_account_id,
    p_amount
  );

  v_payable_account_id := public.get_purchase_engine_account_id(p_tenant_id, p_unit_id, '2100');
  v_cash_account_id := public.get_purchase_engine_account_id(p_tenant_id, p_unit_id, v_cash_bank_account_code);

  insert into public.purchase_invoice_payments (
    tenant_id,
    unit_id,
    purchase_invoice_id,
    supplier_id,
    cash_bank_account_id,
    payment_no,
    payment_date,
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
    p_purchase_invoice_id,
    v_supplier_id,
    p_cash_bank_account_id,
    p_payment_no,
    p_payment_date,
    p_amount,
    p_notes,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_payment_id;

  insert into public.journal_entries (
    tenant_id,
    unit_id,
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
    p_tenant_id,
    p_unit_id,
    'JRN-' || p_payment_no,
    p_payment_date,
    'purchase_invoice_payment',
    v_payment_id,
    'Pelunasan utang pembelian - ' || v_invoice_no,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  )
  values (
    v_journal_entry_id,
    v_payable_account_id,
    p_amount,
    0,
    'Debit utang pembelian ' || v_invoice_no
  );

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    description
  )
  values (
    v_journal_entry_id,
    v_cash_account_id,
    0,
    p_amount,
    'Kas/bank keluar untuk pelunasan ' || v_invoice_no
  );

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    direction,
    amount,
    source_type,
    source_id,
    description,
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
    'CB-' || p_payment_no,
    p_payment_date,
    'out',
    p_amount,
    'purchase_invoice_payment',
    v_payment_id,
    'Pelunasan utang pembelian ' || v_invoice_no,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_cash_bank_transaction_id;

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.purchase_invoice_payments
  set
    journal_entry_id = v_journal_entry_id,
    cash_bank_transaction_id = v_cash_bank_transaction_id
  where id = v_payment_id;

  update public.purchase_invoices
  set
    paid_amount = paid_amount + p_amount,
    status = case
      when paid_amount + p_amount >= total_amount then 'paid'
      else 'partially_paid'
    end
  where id = p_purchase_invoice_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    'purchase_invoice_payment.posted',
    'purchase_invoice_payment',
    v_payment_id,
    jsonb_build_object(
      'payment_no', p_payment_no,
      'invoice_no', v_invoice_no,
      'amount', p_amount,
      'journal_entry_id', v_journal_entry_id,
      'cash_bank_transaction_id', v_cash_bank_transaction_id
    )
  );

  return v_payment_id;
end;
$$;

-- ============================================================================
-- Reporting view: purchase invoice flow
-- ============================================================================

create or replace view public.v_purchase_invoice_flow as
select
  pi.tenant_id,
  pi.unit_id,
  pi.id as purchase_invoice_id,
  pi.invoice_no,
  pi.invoice_date,
  pi.due_date,
  pi.payment_type,
  pi.status,

  pi.supplier_id,
  s.supplier_code,
  s.supplier_name,

  pi.subtotal,
  pi.discount_amount,
  pi.tax_amount,
  pi.total_amount,
  pi.paid_amount,
  pi.total_amount - pi.paid_amount as remaining_amount,

  count(distinct pil.id) as line_count,
  coalesce(sum(pil.quantity), 0) as total_quantity,
  coalesce(sum(pil.line_total), 0) as line_total_audit,

  pi.journal_entry_id,
  je.status as journal_status,

  coalesce(pay.payment_count, 0) as payment_count,
  coalesce(pay.total_payment_amount, 0) as total_payment_amount,

  case
    when pi.status = 'cancelled' then 'CANCELLED'
    when pi.status = 'paid'
      and pi.paid_amount = pi.total_amount
      and pi.total_amount = coalesce(sum(pil.line_total), 0)
      then 'PAID_PASS'
    when pi.status in ('posted', 'partially_paid')
      and pi.payment_type = 'credit'
      and pi.total_amount = coalesce(sum(pil.line_total), 0)
      then 'PAYABLE_OPEN_PASS'
    when pi.status = 'paid'
      and pi.payment_type = 'cash'
      and pi.paid_amount = pi.total_amount
      and pi.total_amount = coalesce(sum(pil.line_total), 0)
      then 'CASH_PURCHASE_PASS'
    else 'CHECK_PURCHASE_FLOW'
  end as purchase_flow_status,

  case
    when pi.total_amount = coalesce(sum(pil.line_total), 0)
      and pi.paid_amount <= pi.total_amount
      and pi.journal_entry_id is not null
      then 'PASS'
    else 'FAIL'
  end as audit_result,

  pi.created_at,
  pi.updated_at
from public.purchase_invoices pi
join public.suppliers s
  on s.id = pi.supplier_id
left join public.purchase_invoice_lines pil
  on pil.purchase_invoice_id = pi.id
left join public.journal_entries je
  on je.id = pi.journal_entry_id
left join (
  select
    purchase_invoice_id,
    count(*) as payment_count,
    sum(amount) as total_payment_amount
  from public.purchase_invoice_payments
  where status = 'posted'
  group by purchase_invoice_id
) pay
  on pay.purchase_invoice_id = pi.id
group by
  pi.tenant_id,
  pi.unit_id,
  pi.id,
  pi.invoice_no,
  pi.invoice_date,
  pi.due_date,
  pi.payment_type,
  pi.status,
  pi.supplier_id,
  s.supplier_code,
  s.supplier_name,
  pi.subtotal,
  pi.discount_amount,
  pi.tax_amount,
  pi.total_amount,
  pi.paid_amount,
  pi.journal_entry_id,
  je.status,
  pay.payment_count,
  pay.total_payment_amount,
  pi.created_at,
  pi.updated_at;

grant select on public.purchase_invoices to authenticated;
grant select on public.purchase_invoice_lines to authenticated;
grant select on public.purchase_invoice_payments to authenticated;
grant select on public.v_purchase_invoice_flow to authenticated;

grant execute on function public.get_purchase_engine_account_id(uuid, uuid, text) to authenticated;
grant execute on function public.create_and_post_purchase_invoice(uuid, uuid, uuid, text, date, date, text, jsonb, uuid, text) to authenticated;
grant execute on function public.create_and_post_purchase_invoice_payment(uuid, uuid, uuid, uuid, text, date, numeric, text) to authenticated;

comment on table public.purchase_invoices is
'Purchase invoice header for cash and credit inventory purchasing.';

comment on table public.purchase_invoice_lines is
'Purchase invoice lines linked to inventory item master.';

comment on table public.purchase_invoice_payments is
'Posted payments for credit purchase invoices, integrated with cash-bank and journal engine.';

comment on view public.v_purchase_invoice_flow is
'Audit/reporting view for purchase invoice lifecycle: invoice, lines, journal, payment, and payable balance.';
