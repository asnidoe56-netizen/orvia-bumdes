-- ============================================================================
-- 0000081_cash_bank_internal_transfer_engine.sql
-- Purpose:
--   Generic internal transfer engine for Kas & Bank:
--   - Kas Tunai -> Bank
--   - Bank -> Kas Tunai
--   - Bank -> Bank
--   - Kas -> Kas
--
-- Notes:
--   - This migration does not change existing cash-bank behavior.
--   - It uses the existing cash_bank_transactions ledger types:
--     transfer_out and transfer_in.
--   - It posts a balanced journal:
--     Dr target cash/bank COA
--     Cr source cash/bank COA
-- ============================================================================

create or replace function public.create_and_post_cash_bank_internal_transfer(
  p_source_cash_bank_account_id uuid,
  p_target_cash_bank_account_id uuid,
  p_transfer_no text,
  p_transfer_date date,
  p_amount numeric,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_source record;
  v_target record;
  v_period_id uuid;
  v_journal_entry_id uuid;
  v_source_transaction_id uuid;
  v_target_transaction_id uuid;
  v_actor_role public.app_role;
  v_source_balance numeric(18,2);
  v_base_no text;
  v_description text;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if p_source_cash_bank_account_id is null then
    raise exception 'Akun sumber kas/bank wajib diisi';
  end if;

  if p_target_cash_bank_account_id is null then
    raise exception 'Akun tujuan kas/bank wajib diisi';
  end if;

  if p_source_cash_bank_account_id = p_target_cash_bank_account_id then
    raise exception 'Akun sumber dan tujuan tidak boleh sama';
  end if;

  if nullif(trim(p_transfer_no), '') is null then
    raise exception 'Nomor transfer kas-bank wajib diisi';
  end if;

  if p_transfer_date is null then
    raise exception 'Tanggal transfer kas-bank wajib diisi';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal transfer kas-bank harus lebih dari 0';
  end if;

  v_base_no := upper(trim(p_transfer_no));
  v_description := coalesce(nullif(trim(p_description), ''), 'Transfer antar kas/bank ' || v_base_no);

  select
    cba.id,
    cba.tenant_id,
    cba.unit_id,
    cba.account_id,
    cba.account_code,
    cba.account_name,
    cba.account_kind,
    cba.is_active,
    coa.kode as coa_kode,
    coa.nama as coa_nama
  into v_source
  from public.cash_bank_accounts cba
  join public.chart_of_accounts coa
    on coa.id = cba.account_id
  where cba.id = p_source_cash_bank_account_id
  for update;

  if v_source.id is null then
    raise exception 'Akun sumber kas/bank tidak ditemukan';
  end if;

  select
    cba.id,
    cba.tenant_id,
    cba.unit_id,
    cba.account_id,
    cba.account_code,
    cba.account_name,
    cba.account_kind,
    cba.is_active,
    coa.kode as coa_kode,
    coa.nama as coa_nama
  into v_target
  from public.cash_bank_accounts cba
  join public.chart_of_accounts coa
    on coa.id = cba.account_id
  where cba.id = p_target_cash_bank_account_id
  for update;

  if v_target.id is null then
    raise exception 'Akun tujuan kas/bank tidak ditemukan';
  end if;

  if v_source.is_active is not true then
    raise exception 'Akun sumber kas/bank tidak aktif';
  end if;

  if v_target.is_active is not true then
    raise exception 'Akun tujuan kas/bank tidak aktif';
  end if;

  if v_source.tenant_id is distinct from v_target.tenant_id
    or v_source.unit_id is distinct from v_target.unit_id
  then
    raise exception 'Akun sumber dan tujuan harus berada pada tenant dan unit yang sama';
  end if;

  if not public.can_access_unit(v_source.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(v_source.unit_id) is distinct from v_source.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'cash_bank.manage',
    auth.uid(),
    v_source.tenant_id,
    v_source.unit_id
  );

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_source.tenant_id
    and ap.unit_id = v_source.unit_id
    and p_transfer_date between ap.period_start and ap.period_end
  limit 1;

  perform public.assert_period_open(v_period_id);

  perform pg_advisory_xact_lock(hashtext(v_source.id::text));
  perform pg_advisory_xact_lock(hashtext(v_target.id::text));

  select coalesce(v.current_balance, 0)::numeric(18,2)
  into v_source_balance
  from public.v_cash_bank_balance v
  where v.cash_bank_account_id = v_source.id;

  if coalesce(v_source_balance, 0) < p_amount then
    raise exception 'Saldo akun sumber tidak cukup. Akun: % - %. Saldo tersedia: Rp %, kebutuhan transfer: Rp %.',
      v_source.account_code,
      v_source.account_name,
      trim(to_char(coalesce(v_source_balance, 0), 'FM999G999G999G999G990D00')),
      trim(to_char(p_amount, 'FM999G999G999G999G990D00'));
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.tenant_id = v_source.tenant_id
      and cbt.unit_id is not distinct from v_source.unit_id
      and cbt.transaction_no in (v_base_no || '-OUT', v_base_no || '-IN')
  ) then
    raise exception 'Nomor transfer kas-bank sudah digunakan dalam unit ini';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.tenant_id = v_source.tenant_id
      and je.unit_id is not distinct from v_source.unit_id
      and je.journal_no = 'JKB-TRF-' || v_base_no
  ) then
    raise exception 'Nomor jurnal transfer kas-bank sudah digunakan dalam unit ini';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_source.unit_id
      or ur.tenant_id = v_source.tenant_id
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
    v_source.tenant_id,
    v_source.unit_id,
    v_period_id,
    'JKB-TRF-' || v_base_no,
    p_transfer_date,
    'cash_bank_internal_transfer',
    v_source.id,
    v_description,
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
    v_target.account_id,
    1,
    'Transfer masuk ke ' || v_target.account_name || ' dari ' || v_source.account_name,
    round(p_amount, 2),
    0
  ),
  (
    v_journal_entry_id,
    v_source.account_id,
    2,
    'Transfer keluar dari ' || v_source.account_name || ' ke ' || v_target.account_name,
    0,
    round(p_amount, 2)
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
    v_source.tenant_id,
    v_source.unit_id,
    v_source.id,
    v_base_no || '-OUT',
    p_transfer_date,
    'transfer_out',
    'cash_bank_internal_transfer',
    v_journal_entry_id,
    v_description,
    round(p_amount, 2),
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_source_transaction_id;

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
    v_target.tenant_id,
    v_target.unit_id,
    v_target.id,
    v_base_no || '-IN',
    p_transfer_date,
    'transfer_in',
    'cash_bank_internal_transfer',
    v_journal_entry_id,
    v_description,
    round(p_amount, 2),
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_target_transaction_id;

  perform public.log_audit_event(
    v_source.tenant_id,
    v_source.unit_id,
    auth.uid(),
    v_actor_role,
    'cash_bank_internal_transfer_posted'::text,
    'cash_bank_transactions'::text,
    v_source_transaction_id,
    'unit_dashboard'::text,
    v_journal_entry_id,
    'Transfer antar kas/bank dibuat dan diposting.'::text,
    jsonb_build_object(
      'transfer_no', v_base_no,
      'source_cash_bank_account_id', v_source.id,
      'source_cash_bank_account_name', v_source.account_name,
      'target_cash_bank_account_id', v_target.id,
      'target_cash_bank_account_name', v_target.account_name,
      'amount', round(p_amount, 2),
      'journal_entry_id', v_journal_entry_id,
      'source_transaction_id', v_source_transaction_id,
      'target_transaction_id', v_target_transaction_id
    )
  );

  return jsonb_build_object(
    'status', 'posted',
    'transfer_no', v_base_no,
    'journal_entry_id', v_journal_entry_id,
    'source_transaction_id', v_source_transaction_id,
    'target_transaction_id', v_target_transaction_id,
    'source_cash_bank_account_id', v_source.id,
    'target_cash_bank_account_id', v_target.id,
    'amount', round(p_amount, 2)
  );
end;
$function$;

revoke all on function public.create_and_post_cash_bank_internal_transfer(
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) from public;

grant execute on function public.create_and_post_cash_bank_internal_transfer(
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) to authenticated, service_role;

comment on function public.create_and_post_cash_bank_internal_transfer(
  uuid,
  uuid,
  text,
  date,
  numeric,
  text
) is
  'Posts a balanced internal transfer between cash/bank accounts using transfer_out and transfer_in cash_bank_transactions.';

