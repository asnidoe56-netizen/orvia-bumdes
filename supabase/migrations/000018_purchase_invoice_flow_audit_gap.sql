-- Migration 0000142: Purchase Invoice Flow Audit Gap
-- Purpose:
--   Package legacy frontend audit view v_purchase_invoice_flow_audit
--   into numbered commercial migration order.
-- Source:
--   20260525071500_create_purchase_invoice_flow_audit.sql
-- Rule:
--   Preserve existing proven engine behavior. Do not alter posting logic.
create or replace view public.v_purchase_invoice_flow_audit as
with line_sum as (
  select
    pil.purchase_invoice_id,
    count(*) as line_count,
    sum(pil.quantity) as total_quantity,
    sum(pil.line_total) as total_line_amount,
    bool_and(ii.item_type = 'stock') as all_stock_items
  from public.purchase_invoice_lines pil
  join public.inventory_items ii
    on ii.id = pil.item_id
  group by pil.purchase_invoice_id
),
inventory_sum as (
  select
    im.source_id as purchase_invoice_id,
    count(*) as movement_count,
    sum(im.quantity_in) as total_qty_in,
    sum(im.quantity_out) as total_qty_out,
    sum(im.total_cost) as total_inventory_cost
  from public.inventory_movements im
  where im.source_type = 'purchase_invoice'
  group by im.source_id
),
journal_sum as (
  select
    je.source_id as purchase_invoice_id,
    je.id as journal_entry_id,
    je.status as journal_status,
    je.journal_no,
    sum(jl.debit) as total_debit,
    sum(jl.credit) as total_credit,
    sum(jl.debit) - sum(jl.credit) as journal_diff
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  where je.source_type = 'purchase_invoice'
  group by
    je.source_id,
    je.id,
    je.status,
    je.journal_no
),
journal_accounts as (
  select
    je.source_id as purchase_invoice_id,
    bool_or(coa.kode = '1300' and jl.debit > 0) as has_inventory_debit,
    bool_or(coa.kode = '1110' and jl.credit > 0) as has_cash_credit,
    bool_or(coa.kode = '2100' and jl.credit > 0) as has_payable_credit
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  where je.source_type = 'purchase_invoice'
  group by je.source_id
),
cash_sum as (
  select
    cbt.source_id as purchase_invoice_id,
    count(*) as cash_tx_count,
    max(cbt.transaction_type) as transaction_type,
    max(cbt.status) as cash_tx_status,
    sum(cbt.amount) as total_cash_amount
  from public.cash_bank_transactions cbt
  where cbt.source_type = 'purchase_invoice'
  group by cbt.source_id
)
select
  pi.id as purchase_invoice_id,
  pi.tenant_id,
  pi.unit_id,
  bu.nama_unit,
  pi.supplier_id,
  s.supplier_code,
  s.supplier_name,
  pi.invoice_no,
  pi.invoice_date,
  pi.due_date,
  pi.payment_type,
  pi.status as invoice_status,
  pi.subtotal,
  pi.discount_amount,
  pi.tax_amount,
  pi.total_amount,
  pi.paid_amount,
  pi.journal_entry_id as invoice_journal_entry_id,
  pi.posted_at,
  pi.posted_by,
  pi.created_by,
  pi.created_at,

  coalesce(ls.line_count, 0) as line_count,
  coalesce(ls.total_quantity, 0) as total_quantity,
  coalesce(ls.total_line_amount, 0) as total_line_amount,
  coalesce(ls.all_stock_items, false) as all_stock_items,

  coalesce(inv.movement_count, 0) as movement_count,
  coalesce(inv.total_qty_in, 0) as total_qty_in,
  coalesce(inv.total_qty_out, 0) as total_qty_out,
  coalesce(inv.total_inventory_cost, 0) as total_inventory_cost,

  js.journal_entry_id,
  js.journal_no,
  js.journal_status,
  coalesce(js.total_debit, 0) as total_debit,
  coalesce(js.total_credit, 0) as total_credit,
  coalesce(js.journal_diff, 0) as journal_diff,

  coalesce(ja.has_inventory_debit, false) as has_inventory_debit,
  coalesce(ja.has_cash_credit, false) as has_cash_credit,
  coalesce(ja.has_payable_credit, false) as has_payable_credit,

  coalesce(cs.cash_tx_count, 0) as cash_tx_count,
  cs.transaction_type as cash_transaction_type,
  cs.cash_tx_status,
  coalesce(cs.total_cash_amount, 0) as total_cash_amount,

  case
    when pi.status <> 'posted'
      then 'CHECK'
    when pi.payment_type = 'cash'
      and pi.paid_amount = pi.total_amount
      and coalesce(ls.total_line_amount, 0) = pi.total_amount
      and coalesce(ls.all_stock_items, false) = true
      and coalesce(inv.total_inventory_cost, 0) = pi.total_amount
      and coalesce(inv.total_qty_in, 0) > 0
      and coalesce(inv.total_qty_out, 0) = 0
      and js.journal_status = 'posted'
      and coalesce(js.total_debit, 0) = coalesce(js.total_credit, 0)
      and coalesce(js.journal_diff, 0) = 0
      and coalesce(ja.has_inventory_debit, false) = true
      and coalesce(ja.has_cash_credit, false) = true
      and coalesce(ja.has_payable_credit, false) = false
      and coalesce(cs.cash_tx_count, 0) = 1
      and cs.transaction_type = 'payment'
      and cs.cash_tx_status = 'posted'
      and coalesce(cs.total_cash_amount, 0) = pi.total_amount
      then 'PASS'
    when pi.payment_type = 'credit'
      and pi.paid_amount = 0
      and coalesce(ls.total_line_amount, 0) = pi.total_amount
      and coalesce(ls.all_stock_items, false) = true
      and coalesce(inv.total_inventory_cost, 0) = pi.total_amount
      and coalesce(inv.total_qty_in, 0) > 0
      and coalesce(inv.total_qty_out, 0) = 0
      and js.journal_status = 'posted'
      and coalesce(js.total_debit, 0) = coalesce(js.total_credit, 0)
      and coalesce(js.journal_diff, 0) = 0
      and coalesce(ja.has_inventory_debit, false) = true
      and coalesce(ja.has_payable_credit, false) = true
      and coalesce(ja.has_cash_credit, false) = false
      and coalesce(cs.cash_tx_count, 0) = 0
      then 'PASS'
    else 'CHECK'
  end as audit_result,

  array_remove(array[
    case when pi.status <> 'posted' then 'Invoice belum posted' end,
    case when coalesce(ls.line_count, 0) = 0 then 'Detail barang belum ada' end,
    case when coalesce(ls.total_line_amount, 0) <> pi.total_amount then 'Total detail tidak sama dengan total invoice' end,
    case when coalesce(ls.all_stock_items, false) = false then 'Ada item yang bukan tipe stock' end,
    case when coalesce(inv.movement_count, 0) = 0 then 'Mutasi stok belum ada' end,
    case when coalesce(inv.total_inventory_cost, 0) <> pi.total_amount then 'Nilai mutasi stok tidak sama dengan total invoice' end,
    case when js.journal_entry_id is null then 'Jurnal belum ada' end,
    case when js.journal_status is distinct from 'posted' then 'Jurnal belum posted' end,
    case when coalesce(js.journal_diff, 0) <> 0 then 'Jurnal tidak balance' end,
    case when coalesce(ja.has_inventory_debit, false) = false then 'Debit persediaan belum ada' end,
    case when pi.payment_type = 'cash' and coalesce(ja.has_cash_credit, false) = false then 'Kredit kas belum ada untuk pembelian tunai' end,
    case when pi.payment_type = 'cash' and coalesce(cs.cash_tx_count, 0) = 0 then 'Transaksi kas-bank belum ada untuk pembelian tunai' end,
    case when pi.payment_type = 'credit' and coalesce(ja.has_payable_credit, false) = false then 'Kredit utang usaha belum ada untuk pembelian kredit' end,
    case when pi.payment_type = 'credit' and coalesce(cs.cash_tx_count, 0) > 0 then 'Pembelian kredit tidak boleh langsung membuat kas-bank payment' end
  ], null) as audit_notes
from public.purchase_invoices pi
left join public.business_units bu
  on bu.id = pi.unit_id
left join public.suppliers s
  on s.id = pi.supplier_id
left join line_sum ls
  on ls.purchase_invoice_id = pi.id
left join inventory_sum inv
  on inv.purchase_invoice_id = pi.id
left join journal_sum js
  on js.purchase_invoice_id = pi.id
left join journal_accounts ja
  on ja.purchase_invoice_id = pi.id
left join cash_sum cs
  on cs.purchase_invoice_id = pi.id;

grant select on public.v_purchase_invoice_flow_audit to authenticated;

