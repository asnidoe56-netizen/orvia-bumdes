-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 0000141: Sales Invoice Base Tables Gap
--
-- Purpose:
--   Fresh-install safety patch for the Sales Invoice Engine.
--
-- Evidence:
--   Later migrations/functions reference:
--   - public.sales_invoices
--   - public.sales_invoice_lines
--
--   However, exact CREATE TABLE audit found these base tables were not packaged
--   in official migrations before 000015_sales_invoice_engine.sql.
--
-- Scope:
--   - Create sales_invoices
--   - Create sales_invoice_lines
--   - Create minimal indexes
--   - Create updated_at trigger for sales_invoices
--   - Grant authenticated access consistent with existing engine pattern
--
-- Non-scope:
--   - No posting logic changes
--   - No RPC changes
--   - No trigger behavior changes beyond updated_at
--   - No seed/demo/tenant data
-- ============================================================================

create table if not exists public.sales_invoices (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,

  invoice_no text not null,
  invoice_date date not null default current_date,
  due_date date,

  payment_type text not null default 'cash'
    check (payment_type = any (array['cash'::text, 'credit'::text])),

  status text not null default 'draft'
    check (status = any (array['draft'::text, 'posted'::text, 'cancelled'::text, 'reversed'::text])),

  subtotal numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  total_amount numeric(18,2) not null default 0,
  paid_amount numeric(18,2) not null default 0,

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

  constraint sales_invoices_scope_no_unique
    unique (tenant_id, unit_id, invoice_no),

  constraint sales_invoices_amount_check
    check (
      subtotal >= 0
      and discount_amount >= 0
      and tax_amount >= 0
      and total_amount >= 0
      and paid_amount >= 0
      and paid_amount <= total_amount
    ),

  constraint sales_invoices_credit_due_date_check
    check (
      payment_type <> 'credit'
      or due_date is not null
    )
);

create table if not exists public.sales_invoice_lines (
  id uuid primary key default gen_random_uuid(),

  sales_invoice_id uuid not null
    references public.sales_invoices(id) on delete cascade,

  item_id uuid not null
    references public.inventory_items(id) on delete restrict,

  line_no integer not null,
  description text,

  quantity numeric(18,2) not null,
  unit_price numeric(18,2) not null default 0,
  discount_amount numeric(18,2) not null default 0,
  tax_amount numeric(18,2) not null default 0,
  line_total numeric(18,2) not null default 0,
  unit_cost numeric(18,2) not null default 0,

  created_at timestamptz not null default now(),

  constraint sales_invoice_lines_unique
    unique (sales_invoice_id, line_no),

  constraint sales_invoice_lines_qty_check
    check (quantity > 0),

  constraint sales_invoice_lines_amount_check
    check (
      unit_price >= 0
      and discount_amount >= 0
      and tax_amount >= 0
      and line_total >= 0
      and unit_cost >= 0
    )
);

create index if not exists sales_invoices_tenant_idx
  on public.sales_invoices (tenant_id);

create index if not exists sales_invoices_unit_idx
  on public.sales_invoices (unit_id);

create index if not exists sales_invoices_customer_idx
  on public.sales_invoices (customer_id);

create index if not exists sales_invoices_status_idx
  on public.sales_invoices (status);

create index if not exists sales_invoices_invoice_date_idx
  on public.sales_invoices (invoice_date);

create index if not exists sales_invoices_payment_type_idx
  on public.sales_invoices (payment_type);

create index if not exists sales_invoice_lines_invoice_idx
  on public.sales_invoice_lines (sales_invoice_id);

create index if not exists sales_invoice_lines_item_idx
  on public.sales_invoice_lines (item_id);

drop trigger if exists trg_sales_invoices_set_updated_at
on public.sales_invoices;

create trigger trg_sales_invoices_set_updated_at
before update on public.sales_invoices
for each row
execute function public.set_updated_at();

grant select, insert, update on public.sales_invoices to authenticated;
grant select, insert, update on public.sales_invoice_lines to authenticated;

comment on table public.sales_invoices is
  'Fresh-install base table for Sales Invoice Engine. Added as packaging gap before 000015.';

comment on table public.sales_invoice_lines is
  'Fresh-install line table for Sales Invoice Engine. Added as packaging gap before 000015.';

