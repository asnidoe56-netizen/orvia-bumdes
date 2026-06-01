-- =========================================================
-- Migration 000024: Journal Correction Governance Engine
-- ORVIA-BUMDES / ERP BUMDes
--
-- DB-first alignment:
--   Active engine uses:
--     - journal_corrections
--     - journal_correction_notes
--     - replacement journal via prepare_journal_correction_replacement(... p_lines jsonb)
--
-- Important:
--   This migration intentionally DOES NOT create journal_correction_lines.
--   Correction lines are stored as normal journal_lines under corrected_journal_entry_id.
-- =========================================================

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.journal_corrections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  correction_no text not null,
  correction_date date not null default current_date,
  original_journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  reversal_journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  corrected_journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  reason text not null,
  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'pending_approval'::text,
      'approved'::text,
      'rejected'::text,
      'posted'::text,
      'cancelled'::text
    ])),
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.journal_correction_notes (
  id uuid primary key default gen_random_uuid(),
  correction_id uuid not null references public.journal_corrections(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  note_type text not null default 'note'
    check (note_type = any (array[
      'note'::text,
      'review'::text,
      'approval'::text,
      'rejection'::text,
      'posting'::text
    ])),
  note text not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- Indexes
-- =========================================================

create unique index if not exists journal_corrections_scope_no_unique
  on public.journal_corrections (tenant_id, unit_id, correction_no) nulls not distinct;

create index if not exists journal_corrections_tenant_idx
  on public.journal_corrections (tenant_id);

create index if not exists journal_corrections_unit_idx
  on public.journal_corrections (unit_id);

create index if not exists journal_corrections_status_idx
  on public.journal_corrections (status);

create index if not exists journal_corrections_original_journal_idx
  on public.journal_corrections (original_journal_entry_id);

create index if not exists journal_correction_notes_correction_idx
  on public.journal_correction_notes (correction_id);

-- =========================================================
-- Trigger functions
-- =========================================================

create or replace function public.validate_journal_correction_scope()
returns trigger
language plpgsql
as $function$
declare
  v_original_tenant_id uuid;
  v_original_unit_id uuid;
  v_original_status text;
  v_reversal_tenant_id uuid;
  v_reversal_unit_id uuid;
  v_corrected_tenant_id uuid;
  v_corrected_unit_id uuid;
begin
  select je.tenant_id, je.unit_id, je.status
  into v_original_tenant_id, v_original_unit_id, v_original_status
  from public.journal_entries je
  where je.id = new.original_journal_entry_id;

  if v_original_tenant_id is null then
    raise exception 'original journal entry not found'
      using errcode = '23503';
  end if;

  if new.status = 'posted' then
    if v_original_status <> 'reversed' then
      raise exception 'posted correction must reference reversed original journal entry'
        using errcode = '42501';
    end if;
  else
    if v_original_status <> 'posted' then
      raise exception 'only posted journal entry can be corrected'
        using errcode = '42501';
    end if;
  end if;

  if new.tenant_id <> v_original_tenant_id
    or new.unit_id is distinct from v_original_unit_id
  then
    raise exception 'journal correction scope does not match original journal scope'
      using errcode = '23514';
  end if;

  if new.reversal_journal_entry_id is not null then
    select je.tenant_id, je.unit_id
    into v_reversal_tenant_id, v_reversal_unit_id
    from public.journal_entries je
    where je.id = new.reversal_journal_entry_id;

    if v_reversal_tenant_id is null then
      raise exception 'reversal journal entry not found'
        using errcode = '23503';
    end if;

    if new.tenant_id <> v_reversal_tenant_id
      or new.unit_id is distinct from v_reversal_unit_id
    then
      raise exception 'journal correction scope does not match reversal journal scope'
        using errcode = '23514';
    end if;
  end if;

  if new.corrected_journal_entry_id is not null then
    select je.tenant_id, je.unit_id
    into v_corrected_tenant_id, v_corrected_unit_id
    from public.journal_entries je
    where je.id = new.corrected_journal_entry_id;

    if v_corrected_tenant_id is null then
      raise exception 'corrected journal entry not found'
        using errcode = '23503';
    end if;

    if new.tenant_id <> v_corrected_tenant_id
      or new.unit_id is distinct from v_corrected_unit_id
    then
      raise exception 'journal correction scope does not match corrected journal scope'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_final_journal_correction_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'rejected') then
    raise exception 'final journal correction cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled', 'rejected') then
    raise exception 'final journal correction cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- =========================================================
-- RPC: create draft
-- =========================================================

create or replace function public.create_journal_correction_draft(
  p_original_journal_entry_id uuid,
  p_reason text,
  p_correction_date date default current_date
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_original public.journal_entries%rowtype;
  v_period_id uuid;
  v_correction_id uuid;
  v_correction_no text;
begin
  select *
  into v_original
  from public.journal_entries
  where id = p_original_journal_entry_id
  for update;

  if v_original.id is null then
    raise exception 'original journal entry not found'
      using errcode = '23503';
  end if;

  if v_original.status <> 'posted' then
    raise exception 'only posted journal entry can be corrected'
      using errcode = '42501';
  end if;

  if nullif(trim(p_reason), '') is null then
    raise exception 'correction reason is required'
      using errcode = '23514';
  end if;

  perform public.assert_user_has_permission(
    'journal_correction.create',
    auth.uid(),
    v_original.tenant_id,
    v_original.unit_id
  );

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_original.tenant_id
    and ap.unit_id is not distinct from v_original.unit_id
    and p_correction_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  perform public.assert_period_open(v_period_id);

  if exists (
    select 1
    from public.journal_corrections jc
    where jc.original_journal_entry_id = p_original_journal_entry_id
      and jc.status in ('draft', 'pending_approval', 'approved', 'posted')
  ) then
    raise exception 'active correction already exists for this journal entry'
      using errcode = '23505';
  end if;

  v_correction_no :=
    'KOR-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.journal_corrections (
    tenant_id,
    unit_id,
    correction_no,
    correction_date,
    original_journal_entry_id,
    reason,
    status,
    created_by
  )
  values (
    v_original.tenant_id,
    v_original.unit_id,
    v_correction_no,
    p_correction_date,
    p_original_journal_entry_id,
    trim(p_reason),
    'draft',
    auth.uid()
  )
  returning id into v_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    v_correction_id,
    auth.uid(),
    'note',
    'Draft koreksi dibuat: ' || trim(p_reason)
  );

  perform public.log_audit_event(
    v_original.tenant_id,
    v_original.unit_id,
    auth.uid(),
    null,
    'journal_correction_draft_created',
    'journal_correction',
    v_correction_id,
    'journal_entry',
    p_original_journal_entry_id,
    'Draft koreksi transaksi dibuat',
    jsonb_build_object(
      'correction_no', v_correction_no,
      'original_journal_entry_id', p_original_journal_entry_id,
      'original_journal_no', v_original.journal_no,
      'correction_date', p_correction_date,
      'reason', trim(p_reason)
    )
  );

  return v_correction_id;
end;
$function$;

-- =========================================================
-- RPC: prepare replacement journal
-- =========================================================

create or replace function public.prepare_journal_correction_replacement(
  p_correction_id uuid,
  p_corrected_journal_date date,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correction public.journal_corrections%rowtype;
  v_original public.journal_entries%rowtype;
  v_period_id uuid;
  v_existing_corrected_journal_id uuid;
  v_corrected_journal_id uuid;
  v_corrected_journal_no text;
  v_line record;
  v_line_no integer := 0;
  v_account_tenant_id uuid;
  v_account_unit_id uuid;
  v_account_is_postable boolean;
  v_account_is_active boolean;
begin
  select *
  into v_correction
  from public.journal_corrections
  where id = p_correction_id
  for update;

  if v_correction.id is null then
    raise exception 'journal correction not found'
      using errcode = '23503';
  end if;

  if v_correction.status <> 'draft' then
    raise exception 'replacement journal can only be prepared while correction is draft'
      using errcode = '42501';
  end if;

  perform public.assert_user_has_permission(
    'journal_correction.create',
    auth.uid(),
    v_correction.tenant_id,
    v_correction.unit_id
  );

  if p_corrected_journal_date is null then
    raise exception 'corrected journal date is required'
      using errcode = '23514';
  end if;

  if nullif(trim(coalesce(p_description, '')), '') is null then
    raise exception 'corrected journal description is required'
      using errcode = '23514';
  end if;

  if p_lines is null
    or jsonb_typeof(p_lines) <> 'array'
    or jsonb_array_length(p_lines) < 2
  then
    raise exception 'corrected journal must contain at least two lines'
      using errcode = '23514';
  end if;

  select *
  into v_original
  from public.journal_entries
  where id = v_correction.original_journal_entry_id
  for update;

  if v_original.id is null then
    raise exception 'original journal entry not found'
      using errcode = '23503';
  end if;

  if v_original.status <> 'posted' then
    raise exception 'only posted original journal can be corrected'
      using errcode = '42501';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_correction.tenant_id
    and ap.unit_id is not distinct from v_correction.unit_id
    and p_corrected_journal_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  perform public.assert_period_open(v_period_id);

  v_existing_corrected_journal_id := v_correction.corrected_journal_entry_id;

  if v_existing_corrected_journal_id is not null then
    if exists (
      select 1
      from public.journal_entries je
      where je.id = v_existing_corrected_journal_id
        and je.status <> 'draft'
    ) then
      raise exception 'existing corrected journal is not draft and cannot be replaced'
        using errcode = '42501';
    end if;

    update public.journal_corrections
    set corrected_journal_entry_id = null
    where id = p_correction_id;

    delete from public.journal_entries
    where id = v_existing_corrected_journal_id;
  end if;

  v_corrected_journal_no :=
    'JKK-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

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
    v_correction.tenant_id,
    v_correction.unit_id,
    v_period_id,
    v_corrected_journal_no,
    p_corrected_journal_date,
    'journal_correction_replacement',
    p_correction_id,
    trim(p_description),
    'draft',
    auth.uid()
  )
  returning id into v_corrected_journal_id;

  for v_line in
    select *
    from jsonb_to_recordset(p_lines) as x(
      account_id uuid,
      description text,
      debit numeric,
      credit numeric
    )
  loop
    v_line_no := v_line_no + 1;

    if v_line.account_id is null then
      raise exception 'account_id is required on line %', v_line_no
        using errcode = '23514';
    end if;

    select
      coa.tenant_id,
      coa.unit_id,
      coa.is_postable,
      coa.is_active
    into
      v_account_tenant_id,
      v_account_unit_id,
      v_account_is_postable,
      v_account_is_active
    from public.chart_of_accounts coa
    where coa.id = v_line.account_id;

    if v_account_tenant_id is null then
      raise exception 'account not found on line %', v_line_no
        using errcode = '23503';
    end if;

    if v_account_tenant_id <> v_correction.tenant_id then
      raise exception 'account tenant scope mismatch on line %', v_line_no
        using errcode = '23514';
    end if;

    if not (
      v_account_unit_id is not distinct from v_correction.unit_id
      or v_account_unit_id is null
    ) then
      raise exception 'account unit scope mismatch on line %', v_line_no
        using errcode = '23514';
    end if;

    if coalesce(v_account_is_active, false) is not true then
      raise exception 'account is not active on line %', v_line_no
        using errcode = '23514';
    end if;

    if coalesce(v_account_is_postable, false) is not true then
      raise exception 'account is not postable on line %', v_line_no
        using errcode = '23514';
    end if;

    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values (
      v_corrected_journal_id,
      v_line.account_id,
      v_line_no,
      nullif(trim(coalesce(v_line.description, '')), ''),
      coalesce(v_line.debit, 0),
      coalesce(v_line.credit, 0)
    );
  end loop;

  if exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = v_corrected_journal_id
      and (
        jl.debit < 0
        or jl.credit < 0
      )
  ) then
    raise exception 'corrected journal line cannot contain negative debit or credit'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = v_corrected_journal_id
      and jl.debit > 0
      and jl.credit > 0
  ) then
    raise exception 'corrected journal line cannot contain debit and credit at the same time'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.journal_lines jl
    where jl.journal_entry_id = v_corrected_journal_id
      and coalesce(jl.debit, 0) = 0
      and coalesce(jl.credit, 0) = 0
  ) then
    raise exception 'corrected journal line cannot be empty'
      using errcode = '23514';
  end if;

  if (
    select count(distinct jl.account_id)
    from public.journal_lines jl
    where jl.journal_entry_id = v_corrected_journal_id
  ) < 2 then
    raise exception 'corrected journal must use at least two different accounts'
      using errcode = '23514';
  end if;

  perform public.assert_journal_balanced(v_corrected_journal_id);

  update public.journal_corrections
  set corrected_journal_entry_id = v_corrected_journal_id
  where id = p_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    p_correction_id,
    auth.uid(),
    'note',
    'Draft jurnal pengganti disiapkan: ' || v_corrected_journal_no
  );

  perform public.log_audit_event(
    v_correction.tenant_id,
    v_correction.unit_id,
    auth.uid(),
    null,
    'journal_correction_replacement_prepared',
    'journal_correction',
    p_correction_id,
    'journal_entry',
    v_corrected_journal_id,
    'Draft jurnal pengganti koreksi disiapkan',
    jsonb_build_object(
      'correction_id', p_correction_id,
      'corrected_journal_entry_id', v_corrected_journal_id,
      'corrected_journal_no', v_corrected_journal_no,
      'original_journal_entry_id', v_original.id,
      'original_journal_no', v_original.journal_no
    )
  );

  return v_corrected_journal_id;
end;
$function$;

-- =========================================================
-- RPC: request / approve / reject
-- =========================================================

create or replace function public.request_journal_correction(p_correction_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correction public.journal_corrections%rowtype;
begin
  select *
  into v_correction
  from public.journal_corrections
  where id = p_correction_id
  for update;

  if v_correction.id is null then
    raise exception 'journal correction not found'
      using errcode = '23503';
  end if;

  perform public.assert_user_has_permission(
    'journal_correction.request',
    auth.uid(),
    v_correction.tenant_id,
    v_correction.unit_id
  );

  if v_correction.status <> 'draft' then
    raise exception 'only draft correction can be requested'
      using errcode = '42501';
  end if;

  update public.journal_corrections
  set
    status = 'pending_approval',
    requested_by = auth.uid(),
    requested_at = now()
  where id = p_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    p_correction_id,
    auth.uid(),
    'review',
    'Correction requested for approval'
  );

  perform public.log_audit_event(
    v_correction.tenant_id,
    v_correction.unit_id,
    auth.uid(),
    null,
    'journal_correction_requested',
    'journal_correction',
    p_correction_id,
    'journal_correction',
    p_correction_id,
    'Journal correction requested',
    '{}'::jsonb
  );

  return p_correction_id;
end;
$function$;

create or replace function public.approve_journal_correction(p_correction_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correction public.journal_corrections%rowtype;
begin
  select *
  into v_correction
  from public.journal_corrections
  where id = p_correction_id
  for update;

  if v_correction.id is null then
    raise exception 'journal correction not found'
      using errcode = '23503';
  end if;

  perform public.assert_user_has_permission(
    'journal_correction.approve',
    auth.uid(),
    v_correction.tenant_id,
    v_correction.unit_id
  );

  if v_correction.status <> 'pending_approval' then
    raise exception 'only pending correction can be approved'
      using errcode = '42501';
  end if;

  update public.journal_corrections
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now()
  where id = p_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    p_correction_id,
    auth.uid(),
    'approval',
    'Correction approved by pengawas'
  );

  perform public.log_audit_event(
    v_correction.tenant_id,
    v_correction.unit_id,
    auth.uid(),
    null,
    'journal_correction_approved',
    'journal_correction',
    p_correction_id,
    'journal_correction',
    p_correction_id,
    'Journal correction approved by pengawas',
    '{}'::jsonb
  );

  return p_correction_id;
end;
$function$;

create or replace function public.reject_journal_correction(
  p_correction_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correction public.journal_corrections%rowtype;
begin
  select *
  into v_correction
  from public.journal_corrections
  where id = p_correction_id
  for update;

  if v_correction.id is null then
    raise exception 'journal correction not found'
      using errcode = '23503';
  end if;

  perform public.assert_user_has_permission(
    'journal_correction.reject',
    auth.uid(),
    v_correction.tenant_id,
    v_correction.unit_id
  );

  if v_correction.status <> 'pending_approval' then
    raise exception 'only pending correction can be rejected'
      using errcode = '42501';
  end if;

  if nullif(trim(p_rejection_reason), '') is null then
    raise exception 'rejection reason is required'
      using errcode = '23514';
  end if;

  update public.journal_corrections
  set
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = p_rejection_reason
  where id = p_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    p_correction_id,
    auth.uid(),
    'rejection',
    p_rejection_reason
  );

  perform public.log_audit_event(
    v_correction.tenant_id,
    v_correction.unit_id,
    auth.uid(),
    null,
    'journal_correction_rejected',
    'journal_correction',
    p_correction_id,
    'journal_correction',
    p_correction_id,
    'Journal correction rejected by pengawas',
    jsonb_build_object('reason', p_rejection_reason)
  );

  return p_correction_id;
end;
$function$;

-- =========================================================
-- RPC: post correction
-- =========================================================

create or replace function public.post_journal_correction(p_correction_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_correction public.journal_corrections%rowtype;
  v_original public.journal_entries%rowtype;
  v_corrected public.journal_entries%rowtype;
  v_reversal_period_id uuid;
  v_reversal_journal_id uuid;
  v_reversal_journal_no text;
begin
  select *
  into v_correction
  from public.journal_corrections
  where id = p_correction_id
  for update;

  if v_correction.id is null then
    raise exception 'journal correction not found'
      using errcode = '23503';
  end if;

  if not public.has_permission(
    'journal_correction.post',
    auth.uid(),
    v_correction.tenant_id,
    v_correction.unit_id
  ) then
    if v_correction.requested_by is distinct from auth.uid() then
      raise exception 'only correction requester or authorized poster can post this correction'
        using errcode = '42501';
    end if;

    perform public.assert_user_has_permission(
      'journal_correction.request',
      auth.uid(),
      v_correction.tenant_id,
      v_correction.unit_id
    );
  end if;

  if v_correction.status <> 'approved' then
    raise exception 'only approved correction can be posted'
      using errcode = '42501';
  end if;

  if v_correction.reversal_journal_entry_id is not null then
    raise exception 'correction already has reversal journal'
      using errcode = '23505';
  end if;

  if v_correction.corrected_journal_entry_id is null then
    raise exception 'corrected journal must be prepared before posting correction'
      using errcode = '23514';
  end if;

  select *
  into v_original
  from public.journal_entries
  where id = v_correction.original_journal_entry_id
  for update;

  if v_original.id is null then
    raise exception 'original journal entry not found'
      using errcode = '23503';
  end if;

  if v_original.status <> 'posted' then
    raise exception 'original journal must be posted and not yet reversed'
      using errcode = '42501';
  end if;

  select *
  into v_corrected
  from public.journal_entries
  where id = v_correction.corrected_journal_entry_id
  for update;

  if v_corrected.id is null then
    raise exception 'corrected journal entry not found'
      using errcode = '23503';
  end if;

  if v_corrected.status <> 'draft' then
    raise exception 'corrected journal must still be draft before posting correction'
      using errcode = '42501';
  end if;

  if v_corrected.tenant_id <> v_correction.tenant_id
    or v_corrected.unit_id is distinct from v_correction.unit_id
  then
    raise exception 'corrected journal scope mismatch'
      using errcode = '23514';
  end if;

  if v_corrected.source_type <> 'journal_correction_replacement'
    or v_corrected.source_id is distinct from p_correction_id
  then
    raise exception 'corrected journal is not linked to this correction'
      using errcode = '23514';
  end if;

  perform public.assert_period_open(v_corrected.period_id);
  perform public.assert_journal_balanced(v_corrected.id);

  select ap.id
  into v_reversal_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_correction.tenant_id
    and ap.unit_id is not distinct from v_correction.unit_id
    and v_correction.correction_date between ap.period_start and ap.period_end
  order by ap.period_start desc
  limit 1;

  perform public.assert_period_open(v_reversal_period_id);

  v_reversal_journal_no :=
    'JRK-' ||
    to_char(clock_timestamp(), 'YYYYMMDD-HH24MISSMS') ||
    '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

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
    reversal_of,
    created_by
  )
  values (
    v_correction.tenant_id,
    v_correction.unit_id,
    v_reversal_period_id,
    v_reversal_journal_no,
    v_correction.correction_date,
    'journal_correction_reversal',
    p_correction_id,
    'Pembalik otomatis untuk koreksi ' || v_correction.correction_no || ' atas jurnal ' || v_original.journal_no,
    'draft',
    v_original.id,
    auth.uid()
  )
  returning id into v_reversal_journal_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    line_no,
    description,
    debit,
    credit
  )
  select
    v_reversal_journal_id,
    jl.account_id,
    jl.line_no,
    'Pembalik: ' || coalesce(jl.description, v_original.description, v_original.journal_no),
    jl.credit,
    jl.debit
  from public.journal_lines jl
  where jl.journal_entry_id = v_original.id
  order by jl.line_no;

  perform public.assert_journal_balanced(v_reversal_journal_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = now()
  where id = v_reversal_journal_id;

  update public.journal_entries
  set
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = now()
  where id = v_corrected.id;

  update public.journal_entries
  set
    status = 'reversed',
    reversed_by = auth.uid(),
    reversed_at = now()
  where id = v_original.id;

  update public.journal_corrections
  set
    reversal_journal_entry_id = v_reversal_journal_id,
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = now()
  where id = p_correction_id;

  insert into public.journal_correction_notes (
    correction_id,
    actor_id,
    note_type,
    note
  )
  values (
    p_correction_id,
    auth.uid(),
    'posting',
    'Koreksi diposting. Jurnal pembalik: ' || v_reversal_journal_no || ', jurnal pengganti: ' || v_corrected.journal_no
  );

  perform public.log_audit_event(
    v_correction.tenant_id,
    v_correction.unit_id,
    auth.uid(),
    null,
    'journal_correction_posted',
    'journal_correction',
    p_correction_id,
    'journal_entry',
    v_original.id,
    'Koreksi jurnal/transaksi diposting',
    jsonb_build_object(
      'correction_id', p_correction_id,
      'correction_no', v_correction.correction_no,
      'original_journal_entry_id', v_original.id,
      'original_journal_no', v_original.journal_no,
      'reversal_journal_entry_id', v_reversal_journal_id,
      'reversal_journal_no', v_reversal_journal_no,
      'corrected_journal_entry_id', v_corrected.id,
      'corrected_journal_no', v_corrected.journal_no
    )
  );

  return p_correction_id;
end;
$function$;

-- =========================================================
-- RPC: audit result
-- =========================================================

create or replace function public.audit_journal_correction_result(p_correction_id uuid)
returns table(
  correction_no text,
  correction_status text,
  journal_role text,
  journal_no text,
  source_type text,
  journal_status text,
  reversal_of uuid,
  total_debit numeric,
  total_credit numeric,
  line_count bigint,
  balance_audit text
)
language sql
security definer
set search_path to 'public'
as $function$
  with correction_data as (
    select
      jc.id as correction_id,
      jc.correction_no,
      jc.status as correction_status,
      jc.original_journal_entry_id,
      jc.reversal_journal_entry_id,
      jc.corrected_journal_entry_id
    from public.journal_corrections jc
    where jc.id = p_correction_id
  ),
  journal_audit as (
    select
      'original'::text as journal_role,
      je.id,
      je.journal_no,
      je.source_type,
      je.status,
      je.reversal_of,
      coalesce(sum(jl.debit), 0) as total_debit,
      coalesce(sum(jl.credit), 0) as total_credit,
      count(jl.id) as line_count
    from correction_data cd
    join public.journal_entries je
      on je.id = cd.original_journal_entry_id
    left join public.journal_lines jl
      on jl.journal_entry_id = je.id
    group by je.id, je.journal_no, je.source_type, je.status, je.reversal_of

    union all

    select
      'reversal'::text as journal_role,
      je.id,
      je.journal_no,
      je.source_type,
      je.status,
      je.reversal_of,
      coalesce(sum(jl.debit), 0) as total_debit,
      coalesce(sum(jl.credit), 0) as total_credit,
      count(jl.id) as line_count
    from correction_data cd
    join public.journal_entries je
      on je.id = cd.reversal_journal_entry_id
    left join public.journal_lines jl
      on jl.journal_entry_id = je.id
    group by je.id, je.journal_no, je.source_type, je.status, je.reversal_of

    union all

    select
      'corrected'::text as journal_role,
      je.id,
      je.journal_no,
      je.source_type,
      je.status,
      je.reversal_of,
      coalesce(sum(jl.debit), 0) as total_debit,
      coalesce(sum(jl.credit), 0) as total_credit,
      count(jl.id) as line_count
    from correction_data cd
    join public.journal_entries je
      on je.id = cd.corrected_journal_entry_id
    left join public.journal_lines jl
      on jl.journal_entry_id = je.id
    group by je.id, je.journal_no, je.source_type, je.status, je.reversal_of
  )
  select
    cd.correction_no,
    cd.correction_status,
    ja.journal_role,
    ja.journal_no,
    ja.source_type,
    ja.status as journal_status,
    ja.reversal_of,
    ja.total_debit,
    ja.total_credit,
    ja.line_count,
    case
      when ja.total_debit = ja.total_credit
       and ja.total_debit > 0
      then 'PASS'
      else 'FAIL'
    end as balance_audit
  from correction_data cd
  join journal_audit ja
    on true
  order by
    case ja.journal_role
      when 'original' then 1
      when 'reversal' then 2
      when 'corrected' then 3
      else 9
    end;
$function$;

-- =========================================================
-- Triggers
-- =========================================================

drop trigger if exists trg_journal_corrections_set_updated_at on public.journal_corrections;
create trigger trg_journal_corrections_set_updated_at
before update on public.journal_corrections
for each row
execute function public.set_updated_at();

drop trigger if exists trg_journal_corrections_validate_scope on public.journal_corrections;
create trigger trg_journal_corrections_validate_scope
before insert or update on public.journal_corrections
for each row
execute function public.validate_journal_correction_scope();

drop trigger if exists trg_prevent_final_journal_correction_mutation on public.journal_corrections;
create trigger trg_prevent_final_journal_correction_mutation
before update or delete on public.journal_corrections
for each row
execute function public.prevent_final_journal_correction_mutation();

-- =========================================================
-- Permissions
-- =========================================================

insert into public.permissions (code, name, description)
values
  ('journal_correction.create', 'Create journal correction', 'Create draft journal correction'),
  ('journal_correction.request', 'Request journal correction approval', 'Submit journal correction for approval'),
  ('journal_correction.approve', 'Approve journal correction', 'Approve journal correction as pengawas'),
  ('journal_correction.reject', 'Reject journal correction', 'Reject journal correction as pengawas'),
  ('journal_correction.post', 'Post journal correction', 'Post approved journal correction'),
  ('journal_correction.view', 'View journal correction', 'View journal correction workflow and audit')
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description;

insert into public.role_permissions (permission_id, role)
select p.id, x.role::public.app_role
from public.permissions p
join (
  values
    ('journal_correction.create', 'super_admin_platform'),
    ('journal_correction.create', 'admin_bumdes'),
    ('journal_correction.create', 'manager_unit'),
    ('journal_correction.create', 'operator_unit'),

    ('journal_correction.request', 'super_admin_platform'),
    ('journal_correction.request', 'admin_bumdes'),
    ('journal_correction.request', 'manager_unit'),
    ('journal_correction.request', 'operator_unit'),

    ('journal_correction.approve', 'super_admin_platform'),
    ('journal_correction.approve', 'pengawas'),

    ('journal_correction.reject', 'super_admin_platform'),
    ('journal_correction.reject', 'pengawas'),

    ('journal_correction.post', 'super_admin_platform'),
    ('journal_correction.post', 'admin_bumdes'),

    ('journal_correction.view', 'super_admin_platform'),
    ('journal_correction.view', 'direktur_bumdes'),
    ('journal_correction.view', 'admin_bumdes'),
    ('journal_correction.view', 'manager_unit'),
    ('journal_correction.view', 'operator_unit'),
    ('journal_correction.view', 'pengawas')
) as x(permission_code, role)
  on x.permission_code = p.code
on conflict do nothing;

-- =========================================================
-- Grants
-- =========================================================

grant select, insert, update on public.journal_corrections to authenticated;
grant select, insert on public.journal_correction_notes to authenticated;

grant execute on function public.create_journal_correction_draft(uuid, text, date) to authenticated;
grant execute on function public.prepare_journal_correction_replacement(uuid, date, text, jsonb) to authenticated;
grant execute on function public.request_journal_correction(uuid) to authenticated;
grant execute on function public.approve_journal_correction(uuid) to authenticated;
grant execute on function public.reject_journal_correction(uuid, text) to authenticated;
grant execute on function public.post_journal_correction(uuid) to authenticated;
grant execute on function public.audit_journal_correction_result(uuid) to authenticated;

-- =========================================================
-- Comments
-- =========================================================

comment on table public.journal_corrections is
'Governance table for correcting posted journals through draft, approval, reversal, and replacement journal flow.';

comment on table public.journal_correction_notes is
'Auditable notes for journal correction workflow: note, review, approval, rejection, and posting.';

comment on function public.prepare_journal_correction_replacement(uuid, date, text, jsonb) is
'Prepares a draft corrected journal for a journal correction using JSONB line input.';

comment on function public.post_journal_correction(uuid) is
'Posts approved journal correction by creating reversal journal, posting corrected journal, and marking original journal as reversed.';
