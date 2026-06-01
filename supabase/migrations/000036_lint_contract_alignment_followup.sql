-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000036_lint_contract_alignment_followup.sql
-- Purpose : Follow-up fresh-install lint contract alignment after 000035.
-- Notes   :
-- - Compatibility patch only.
-- - Does not change proven business flow semantics.
-- - Adds missing cash/bank sufficiency helper contracts.
-- - Replaces repayment RPC only to disambiguate RETURNING total_amount.
-- ============================================================

begin;

-- ============================================================
-- 1. Cash/bank sufficient balance helper: by cash_bank_account_id
-- ============================================================

create or replace function public.assert_cash_bank_account_sufficient_balance(
  p_cash_bank_account_id uuid,
  p_required_amount numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_current_balance numeric;
begin
  if p_cash_bank_account_id is null then
    raise exception 'cash/bank account id is required'
      using errcode = '23502';
  end if;

  if p_required_amount is null or p_required_amount < 0 then
    raise exception 'required amount must be zero or positive'
      using errcode = '23514';
  end if;

  select coalesce(v.current_balance, 0)
  into v_current_balance
  from public.v_cash_bank_balance v
  where v.cash_bank_account_id = p_cash_bank_account_id;

  v_current_balance := coalesce(v_current_balance, 0);

  if v_current_balance < p_required_amount then
    raise exception 'Saldo kas/bank tidak cukup. Saldo: %, dibutuhkan: %',
      v_current_balance, p_required_amount
      using errcode = '23514';
  end if;
end;
$function$;

grant execute on function public.assert_cash_bank_account_sufficient_balance(uuid, numeric) to authenticated;

-- ============================================================
-- 2. Cash/bank sufficient balance helper: by tenant/unit/COA account
-- ============================================================

create or replace function public.assert_cash_bank_account_sufficient_balance(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_account_id uuid,
  p_required_amount numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cash_bank_account_id uuid;
begin
  if p_tenant_id is null or p_account_id is null then
    raise exception 'tenant id and cash account id are required'
      using errcode = '23502';
  end if;

  select cba.id
  into v_cash_bank_account_id
  from public.cash_bank_accounts cba
  where cba.tenant_id = p_tenant_id
    and cba.unit_id is not distinct from p_unit_id
    and cba.account_id = p_account_id
    and cba.is_active = true
  order by cba.created_at
  limit 1;

  if v_cash_bank_account_id is null then
    raise exception 'Akun kas/bank aktif tidak ditemukan untuk COA %', p_account_id
      using errcode = '23503';
  end if;

  perform public.assert_cash_bank_account_sufficient_balance(
    v_cash_bank_account_id,
    p_required_amount
  );
end;
$function$;

grant execute on function public.assert_cash_bank_account_sufficient_balance(uuid, uuid, uuid, numeric) to authenticated;

-- ============================================================
-- 3. Savings loan repayment RETURNING disambiguation
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
    (select coalesce(max(line_no), 0) + 1 from public.journal_lines where journal_entry_id = v_journal_id),
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
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines where journal_entry_id = v_journal_id),
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
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines where journal_entry_id = v_journal_id),
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
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines where journal_entry_id = v_journal_id),
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
      (select coalesce(max(line_no), 0) + 1 from public.journal_lines where journal_entry_id = v_journal_id),
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