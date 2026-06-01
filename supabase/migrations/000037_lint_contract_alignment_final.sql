-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000037_lint_contract_alignment_final.sql
-- Purpose : Final lint contract alignment after 000036.
-- Notes   :
-- - Compatibility patch only.
-- - Keeps proven business flow semantics.
-- - Aligns purchase cash-bank inserts to cash_bank_transactions.transaction_type.
-- - Qualifies repayment journal_lines subqueries to avoid PL/pgSQL ambiguity.
-- ============================================================

begin;

-- ============================================================
-- 1. Purchase invoice cash-bank transaction_type alignment
-- ============================================================

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
      transaction_type,
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
      'payment',
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

-- ============================================================
-- 2. Purchase invoice payment cash-bank transaction_type alignment
-- ============================================================

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
    transaction_type,
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
    'payment',
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

-- ============================================================
-- 3. Savings loan repayment journal_lines ambiguity alignment
-- ============================================================

create or replace function public.create_and_post_savings_loan_repayment(
  p_application_id uuid,
  p_repayment_no text,
  p_repayment_date date,
  p_cash_bank_account_id uuid,
  p_principal_amount numeric,
  p_service_amount numeric default 0,
  p_admin_amount numeric default 0,
  p_penalty_amount numeric default 0,
  p_notes text default null
)
returns table (
  repayment_id uuid,
  application_id uuid,
  repayment_no text,
  principal_amount numeric,
  service_amount numeric,
  admin_amount numeric,
  penalty_amount numeric,
  total_amount numeric,
  outstanding_principal_after numeric,
  journal_entry_id uuid,
  cash_bank_transaction_id uuid,
  audit_timeline_id uuid,
  audit_result text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_disbursement record;
  v_cash_bank record;
  v_period_id uuid;
  v_receivable_account_id uuid;
  v_cash_account_id uuid;
  v_service_income_account_id uuid;
  v_admin_income_account_id uuid;
  v_penalty_income_account_id uuid;
  v_journal_id uuid;
  v_cash_tx_id uuid;
  v_repayment_id uuid;
  v_audit_id uuid;
  v_total_amount numeric;
  v_paid_principal numeric;
  v_outstanding_before numeric;
  v_outstanding_after numeric;
  v_new_status public.savings_loan_application_status;
begin
  select *
  into v_context
  from public.get_user_login_context(auth.uid())
  limit 1;

  perform public.assert_user_has_permission('savings_loan.repayment.create', auth.uid(), v_context.tenant_id, v_context.unit_id
  );

  select *
  into v_application
  from public.savings_loan_applications a
  where a.id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'Pengajuan pinjaman tidak ditemukan.';
  end if;

  if v_application.tenant_id <> v_context.tenant_id
     or v_application.unit_id <> v_context.unit_id then
    raise exception 'Pengajuan pinjaman tidak sesuai scope login.';
  end if;

  if v_application.verification_status <> 'verified' then
    raise exception 'Pengajuan pinjaman belum verified.';
  end if;

  if v_application.status not in ('disbursed', 'partial_paid') then
    raise exception 'Angsuran hanya dapat dicatat untuk pinjaman yang sudah cair atau masih berjalan.';
  end if;

  select *
  into v_disbursement
  from public.savings_loan_disbursements d
  where d.application_id = p_application_id
    and d.status = 'posted'
  order by d.created_at
  limit 1;

  if v_disbursement.id is null then
    raise exception 'Bukti pencairan posted tidak ditemukan.';
  end if;

  select coalesce(sum(r.principal_amount), 0)
  into v_paid_principal
  from public.savings_loan_repayments r
  where r.application_id = p_application_id
    and r.status = 'posted';

  v_outstanding_before := v_disbursement.principal_amount - v_paid_principal;

  if coalesce(p_principal_amount, 0) > v_outstanding_before then
    raise exception 'Angsuran pokok melebihi sisa pokok pinjaman.';
  end if;

  v_total_amount :=
    coalesce(p_principal_amount, 0)
    + coalesce(p_service_amount, 0)
    + coalesce(p_admin_amount, 0)
    + coalesce(p_penalty_amount, 0);

  if v_total_amount <= 0 then
    raise exception 'Total angsuran harus lebih dari nol.';
  end if;

  select *
  into v_cash_bank
  from public.cash_bank_accounts cba
  where cba.id = p_cash_bank_account_id
    and cba.tenant_id = v_application.tenant_id
    and cba.unit_id = v_application.unit_id
    and cba.is_active = true;

  if v_cash_bank.id is null then
    raise exception 'Akun kas/bank penerimaan angsuran tidak valid.';
  end if;

  v_cash_account_id := v_cash_bank.account_id;

  if v_cash_account_id is null
     and nullif(trim(coalesce(v_cash_bank.account_code, '')), '') is not null then
    select coa.id
    into v_cash_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_application.tenant_id
      and (
        coa.unit_id = v_application.unit_id
        or coa.unit_id is null
      )
      and coa.kode = v_cash_bank.account_code
      and coa.is_postable = true
      and coa.is_active = true
    order by
      case when coa.unit_id = v_application.unit_id then 0 else 1 end
    limit 1;
  end if;

  if v_cash_account_id is null then
    raise exception 'COA kas/bank penerimaan angsuran belum terhubung.';
  end if;

  select coa.id
  into v_receivable_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_application.tenant_id
    and coa.unit_id = v_application.unit_id
    and coa.kode = '1210'
    and coa.is_postable = true
    and coa.is_active = true
  limit 1;

  if v_receivable_account_id is null then
    raise exception 'Akun piutang pinjaman anggota 1210 belum tersedia untuk unit ini.';
  end if;

  if coalesce(p_service_amount, 0) > 0 then
    select coa.id
    into v_service_income_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_application.tenant_id
      and coa.unit_id = v_application.unit_id
      and coa.kode = '4210'
      and coa.is_postable = true
      and coa.is_active = true
    limit 1;

    if v_service_income_account_id is null then
      raise exception 'Akun pendapatan jasa pinjaman 4210 belum tersedia untuk unit ini.';
    end if;
  end if;

  if coalesce(p_admin_amount, 0) > 0 then
    select coa.id
    into v_admin_income_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_application.tenant_id
      and coa.unit_id = v_application.unit_id
      and coa.kode = '4220'
      and coa.is_postable = true
      and coa.is_active = true
    limit 1;

    if v_admin_income_account_id is null then
      raise exception 'Akun pendapatan administrasi pinjaman 4220 belum tersedia untuk unit ini.';
    end if;
  end if;

  if coalesce(p_penalty_amount, 0) > 0 then
    select coa.id
    into v_penalty_income_account_id
    from public.chart_of_accounts coa
    where coa.tenant_id = v_application.tenant_id
      and coa.unit_id = v_application.unit_id
      and coa.is_postable = true
      and coa.is_active = true
      and (
        coa.kode = '4230'
        or coa.nama ilike '%denda%'
        or coa.kode = '4220'
      )
    order by
      case
        when coa.kode = '4230' then 1
        when coa.nama ilike '%denda%' then 2
        when coa.kode = '4220' then 3
        else 9
      end
    limit 1;

    if v_penalty_income_account_id is null then
      raise exception 'Akun pendapatan denda pinjaman belum tersedia untuk unit ini.';
    end if;
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_application.tenant_id
    and ap.unit_id = v_application.unit_id
    and coalesce(p_repayment_date, current_date) between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi angsuran tidak ditemukan.';
  end if;

  perform public.assert_period_open(v_period_id);

  insert into public.savings_loan_repayments (
    tenant_id,
    unit_id,
    application_id,
    cash_bank_account_id,
    repayment_no,
    repayment_date,
    principal_amount,
    service_amount,
    admin_amount,
    penalty_amount,
    notes,
    status,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_application.tenant_id,
    v_application.unit_id,
    p_application_id,
    p_cash_bank_account_id,
    p_repayment_no,
    coalesce(p_repayment_date, current_date),
    coalesce(p_principal_amount, 0),
    coalesce(p_service_amount, 0),
    coalesce(p_admin_amount, 0),
    coalesce(p_penalty_amount, 0),
    p_notes,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning public.savings_loan_repayments.id, public.savings_loan_repayments.total_amount
  into v_repayment_id, v_total_amount;

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
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_application.tenant_id,
    v_application.unit_id,
    v_period_id,
    'JA-' || upper(trim(p_repayment_no)),
    coalesce(p_repayment_date, current_date),
    'Angsuran pinjaman ' || upper(trim(p_repayment_no)),
    'savings_loan_repayment',
    v_repayment_id,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_journal_id;

  insert into public.journal_lines (
    journal_entry_id,
    line_no,
    account_id,
    debit,
    credit,
    description
  )
  values (
    v_journal_id,
    (select coalesce(max(line_no), 0) + 1 from public.journal_lines jl where jl.journal_entry_id = v_journal_id),
    v_cash_account_id,
    v_total_amount,
    0,
    'Kas/bank masuk angsuran pinjaman'
  );

  if coalesce(p_principal_amount, 0) > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_id,
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines jl where jl.journal_entry_id = v_journal_id),
      v_receivable_account_id,
      0,
      coalesce(p_principal_amount, 0),
      'Pelunasan piutang pokok pinjaman'
    );
  end if;

  if coalesce(p_service_amount, 0) > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_id,
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines jl where jl.journal_entry_id = v_journal_id),
      v_service_income_account_id,
      0,
      coalesce(p_service_amount, 0),
      'Pendapatan jasa pinjaman'
    );
  end if;

  if coalesce(p_admin_amount, 0) > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_id,
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines jl where jl.journal_entry_id = v_journal_id),
      v_admin_income_account_id,
      0,
      coalesce(p_admin_amount, 0),
      'Pendapatan administrasi pinjaman'
    );
  end if;

  if coalesce(p_penalty_amount, 0) > 0 then
    insert into public.journal_lines (
      journal_entry_id,
      line_no,
      account_id,
      debit,
      credit,
      description
    )
    values (
      v_journal_id,
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines jl where jl.journal_entry_id = v_journal_id),
      v_penalty_income_account_id,
      0,
      coalesce(p_penalty_amount, 0),
      'Pendapatan denda pinjaman'
    );
  end if;

  perform public.assert_journal_balanced(v_journal_id);

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_date,
    transaction_no,
    transaction_type,
    amount,
    description,
    source_type,
    source_id,
    journal_entry_id,
    status,
    created_by
  )
  values (
    v_application.tenant_id,
    v_application.unit_id,
    p_cash_bank_account_id,
    coalesce(p_repayment_date, current_date),
    'CB-' || upper(trim(p_repayment_no)),
    'receipt',
    v_total_amount,
    'Angsuran pinjaman ' || upper(trim(p_repayment_no)),
    'savings_loan_repayment',
    v_repayment_id,
    v_journal_id,
    'posted',
    auth.uid()
  )
  returning id into v_cash_tx_id;

  update public.savings_loan_repayments
  set
    journal_entry_id = v_journal_id,
    cash_bank_transaction_id = v_cash_tx_id,
    updated_at = now()
  where id = v_repayment_id;

  v_outstanding_after := v_outstanding_before - coalesce(p_principal_amount, 0);

  if v_outstanding_after <= 0 then
    v_new_status := 'paid_off';
  else
    v_new_status := 'partial_paid';
  end if;

  update public.savings_loan_applications
  set
    status = v_new_status,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_application_id;

  insert into public.audit_timeline (
    tenant_id,
    unit_id,
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    source_type,
    source_id,
    description,
    metadata
  )
  values (
    v_application.tenant_id,
    v_application.unit_id,
    auth.uid(),
    v_context.role,
    'savings_loan_repayment.posted',
    'savings_loan_repayments',
    v_repayment_id,
    'savings_loan_repayment',
    v_repayment_id,
    'Angsuran pinjaman diposting',
    jsonb_build_object(
      'application_id', p_application_id,
      'repayment_no', upper(trim(p_repayment_no)),
      'principal_amount', coalesce(p_principal_amount, 0),
      'service_amount', coalesce(p_service_amount, 0),
      'admin_amount', coalesce(p_admin_amount, 0),
      'penalty_amount', coalesce(p_penalty_amount, 0),
      'total_amount', v_total_amount,
      'outstanding_principal_after', v_outstanding_after,
      'journal_entry_id', v_journal_id,
      'cash_bank_transaction_id', v_cash_tx_id
    )
  )
  returning id into v_audit_id;

  repayment_id := v_repayment_id;
  application_id := p_application_id;
  repayment_no := upper(trim(p_repayment_no));
  principal_amount := coalesce(p_principal_amount, 0);
  service_amount := coalesce(p_service_amount, 0);
  admin_amount := coalesce(p_admin_amount, 0);
  penalty_amount := coalesce(p_penalty_amount, 0);
  total_amount := v_total_amount;
  outstanding_principal_after := v_outstanding_after;
  journal_entry_id := v_journal_id;
  cash_bank_transaction_id := v_cash_tx_id;
  audit_timeline_id := v_audit_id;
  audit_result := 'PASS';

  return next;
end;
$function$;

commit;