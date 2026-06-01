-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000035_lint_contract_alignment.sql
-- Purpose : Fresh-install lint contract alignment after 000001-000034.
-- Notes   :
-- - Compatibility patch only.
-- - Does not change proven business flow semantics.
-- - Aligns helper/function contracts exposed by earlier packaged migrations.
-- ============================================================

begin;

-- ============================================================
-- 1. Compatibility helper: can_access_unit(unit_id, user_id)
-- ============================================================

create or replace function public.can_access_unit(
  p_unit_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
begin
  if p_user_id is null or p_unit_id is null then
    return false;
  end if;

  if public.is_super_admin_platform(p_user_id) then
    return true;
  end if;

  select bu.tenant_id
  into v_tenant_id
  from public.business_units bu
  where bu.id = p_unit_id;

  if v_tenant_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and (
        ur.unit_id = p_unit_id
        or (
          ur.unit_id is null
          and ur.tenant_id = v_tenant_id
          and ur.role in (
            'direktur_bumdes'::public.app_role,
            'admin_bumdes'::public.app_role,
            'pengawas'::public.app_role
          )
        )
      )
  );
end;
$function$;

grant execute on function public.can_access_unit(uuid, uuid) to authenticated;

-- ============================================================
-- 2. Compatibility overload: assert_period_open(tenant_id, unit_id, date)
-- ============================================================

create or replace function public.assert_period_open(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_period_date date
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_period_id uuid;
begin
  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = p_tenant_id
    and ap.unit_id = p_unit_id
    and p_period_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'accounting period not found for tenant %, unit %, date %',
      p_tenant_id, p_unit_id, p_period_date
      using errcode = '23503';
  end if;

  perform public.assert_period_open(v_period_id);
end;
$function$;

grant execute on function public.assert_period_open(uuid, uuid, date) to authenticated;

-- ============================================================
-- 3. Purchase helper alignment: chart_of_accounts uses kode, not account_code
-- ============================================================

create or replace function public.get_purchase_engine_account_id(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_account_code text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_id uuid;
begin
  select coa.id
  into v_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and (
      coa.unit_id = p_unit_id
      or coa.unit_id is null
    )
    and coa.kode = p_account_code
    and coa.is_postable = true
    and coa.is_active = true
  order by
    case when coa.unit_id = p_unit_id then 0 else 1 end
  limit 1;

  if v_account_id is null then
    raise exception 'Required COA account % not found for tenant %, unit %',
      p_account_code, p_tenant_id, p_unit_id;
  end if;

  return v_account_id;
end;
$function$;

grant execute on function public.get_purchase_engine_account_id(uuid, uuid, text) to authenticated;


-- ============================================================
-- 4. Savings Loan lint contract alignment
-- ============================================================

create or replace function public.activate_savings_loan_public_application_link(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_public_slug text,
  p_title text default 'Form Pengajuan Pinjaman',
  p_description text default null,
  p_allow_individual boolean default true,
  p_allow_group boolean default true,
  p_require_pdf boolean default true,
  p_max_requested_amount numeric default null,
  p_min_tenor_months integer default null,
  p_max_tenor_months integer default null
)
returns table (
  public_link_id uuid,
  public_slug text,
  public_token text,
  public_path text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_public_link_id uuid;
  v_public_token text;
  v_slug text;
begin
  v_slug := lower(trim(p_public_slug));

  if v_slug is null or v_slug = '' then
    raise exception 'Slug publik wajib diisi.';
  end if;

  v_public_token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.savings_loan_public_application_links (
    tenant_id,
    unit_id,
    public_slug,
    public_token,
    title,
    description,
    is_active,
    allow_individual,
    allow_group,
    require_pdf,
    max_requested_amount,
    min_tenor_months,
    max_tenor_months,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    v_slug,
    v_public_token,
    coalesce(nullif(trim(p_title), ''), 'Form Pengajuan Pinjaman'),
    nullif(trim(coalesce(p_description, '')), ''),
    true,
    coalesce(p_allow_individual, true),
    coalesce(p_allow_group, true),
    coalesce(p_require_pdf, true),
    p_max_requested_amount,
    p_min_tenor_months,
    p_max_tenor_months,
    auth.uid()
  )
  on conflict (tenant_id, unit_id)
  do update set
    public_slug = excluded.public_slug,
    public_token = excluded.public_token,
    title = excluded.title,
    description = excluded.description,
    is_active = true,
    allow_individual = excluded.allow_individual,
    allow_group = excluded.allow_group,
    require_pdf = excluded.require_pdf,
    max_requested_amount = excluded.max_requested_amount,
    min_tenor_months = excluded.min_tenor_months,
    max_tenor_months = excluded.max_tenor_months,
    disabled_by = null,
    disabled_at = null,
    updated_at = now()
  returning id, savings_loan_public_application_links.public_slug, savings_loan_public_application_links.public_token
  into v_public_link_id, public_slug, public_token;

  public_link_id := v_public_link_id;
  public_path := '/ajukan-pinjaman/' || public_slug || '/' || public_token;

  return next;
end;
$function$;

create or replace function public.create_savings_loan_applicant_intake_group(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_application_no text,
  p_application_date date,
  p_group_no text,
  p_group_name text,
  p_group_address text,
  p_requested_amount numeric,
  p_tenor_months integer,
  p_loan_purpose text,
  p_income_source text,
  p_estimated_repayment_capacity numeric,
  p_business_or_job_type text,
  p_notes text,
  p_supporting_document_url text,
  p_supporting_document_name text,
  p_supporting_document_mime_type text,
  p_declaration_text text,
  p_declaration_accepted boolean,
  p_members jsonb,
  p_input_mode public.savings_loan_application_input_mode default 'self_service',
  p_assisted_by uuid default null,
  p_assisted_reason text default null,
  p_assisted_statement_text text default null
)
returns table (
  application_id uuid,
  group_id uuid,
  application_no text,
  group_members_count integer,
  input_mode public.savings_loan_application_input_mode,
  verification_status public.savings_loan_application_verification_status,
  intake_audit_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_id uuid;
  v_application_id uuid;
  v_leader_member_id uuid;
  v_member_id uuid;
  v_member_no text;
  v_member jsonb;
  v_member_count integer := 0;
  v_leader_count integer := 0;
  v_share numeric;
  v_remainder numeric;
  v_declaration_accepted_at timestamptz;
begin
  if jsonb_typeof(p_members) <> 'array' then
    raise exception 'Daftar anggota kelompok wajib berupa array.';
  end if;

  v_member_count := jsonb_array_length(p_members);

  if v_member_count < 2 then
    raise exception 'Pengajuan kelompok minimal memiliki 2 anggota.';
  end if;

  select count(*)
  into v_leader_count
  from jsonb_array_elements(p_members) m
  where coalesce((m ->> 'role_in_group'), '') = 'leader';

  if v_leader_count <> 1 then
    raise exception 'Pengajuan kelompok wajib memiliki tepat 1 ketua.';
  end if;

  if p_input_mode = 'self_service'::public.savings_loan_application_input_mode then
    if coalesce(p_declaration_accepted, false) is not true then
      raise exception 'Pernyataan pemohon wajib disetujui.';
    end if;

    v_declaration_accepted_at := now();
  else
    if p_assisted_by is null or nullif(trim(coalesce(p_assisted_statement_text, '')), '') is null then
      raise exception 'Mode dibantu petugas wajib menyimpan petugas dan pernyataan pendampingan.';
    end if;
  end if;

  for v_member in
    select value
    from jsonb_array_elements(p_members)
  loop
    select m.id
    into v_member_id
    from public.savings_loan_members m
    where m.tenant_id = p_tenant_id
      and m.unit_id = p_unit_id
      and (
        (
          nullif(trim(coalesce(v_member ->> 'identity_number', '')), '') is not null
          and m.identity_number = nullif(trim(coalesce(v_member ->> 'identity_number', '')), '')
        )
        or
        (
          nullif(trim(coalesce(v_member ->> 'phone', '')), '') is not null
          and m.phone = nullif(trim(coalesce(v_member ->> 'phone', '')), '')
        )
      )
    order by m.created_at
    limit 1;

    if v_member_id is null then
      v_member_no := 'AGT-AUTO-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

      insert into public.savings_loan_members (
        tenant_id,
        unit_id,
        member_no,
        full_name,
        identity_number,
        phone,
        address,
        join_date,
        notes,
        created_by,
        updated_by
      )
      values (
        p_tenant_id,
        p_unit_id,
        v_member_no,
        coalesce(v_member ->> 'full_name', ''),
        nullif(trim(coalesce(v_member ->> 'identity_number', '')), ''),
        nullif(trim(coalesce(v_member ->> 'phone', '')), ''),
        nullif(trim(coalesce(v_member ->> 'address', '')), ''),
        current_date,
        'Auto-created from group applicant intake',
        auth.uid(),
        auth.uid()
      )
      returning id into v_member_id;
    else
      update public.savings_loan_members
      set
        full_name = coalesce(nullif(trim(coalesce(v_member ->> 'full_name', '')), ''), full_name),
        identity_number = coalesce(nullif(trim(coalesce(v_member ->> 'identity_number', '')), ''), identity_number),
        phone = coalesce(nullif(trim(coalesce(v_member ->> 'phone', '')), ''), phone),
        address = coalesce(nullif(trim(coalesce(v_member ->> 'address', '')), ''), address),
        updated_by = auth.uid(),
        updated_at = now()
      where id = v_member_id;
    end if;

    if coalesce(v_member ->> 'role_in_group', '') = 'leader' then
      v_leader_member_id := v_member_id;
    end if;
  end loop;

  if v_leader_member_id is null then
    raise exception 'Ketua kelompok tidak ditemukan.';
  end if;

  select g.id
  into v_group_id
  from public.savings_loan_groups g
  where g.tenant_id = p_tenant_id
    and g.unit_id = p_unit_id
    and g.group_no = upper(trim(p_group_no))
  limit 1;

  if v_group_id is null then
    insert into public.savings_loan_groups (
      tenant_id,
      unit_id,
      group_no,
      group_name,
      leader_member_id,
      formation_date,
      address,
      notes,
      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      p_unit_id,
      p_group_no,
      p_group_name,
      v_leader_member_id,
      current_date,
      p_group_address,
      'Auto-created from group applicant intake',
      auth.uid(),
      auth.uid()
    )
    returning id into v_group_id;
  else
    update public.savings_loan_groups
    set
      group_name = coalesce(nullif(trim(p_group_name), ''), group_name),
      leader_member_id = v_leader_member_id,
      address = coalesce(nullif(trim(coalesce(p_group_address, '')), ''), address),
      updated_by = auth.uid(),
      updated_at = now()
    where id = v_group_id;
  end if;

  for v_member in
    select value
    from jsonb_array_elements(p_members)
  loop
    select m.id
    into v_member_id
    from public.savings_loan_members m
    where m.tenant_id = p_tenant_id
      and m.unit_id = p_unit_id
      and (
        (
          nullif(trim(coalesce(v_member ->> 'identity_number', '')), '') is not null
          and m.identity_number = nullif(trim(coalesce(v_member ->> 'identity_number', '')), '')
        )
        or
        (
          nullif(trim(coalesce(v_member ->> 'phone', '')), '') is not null
          and m.phone = nullif(trim(coalesce(v_member ->> 'phone', '')), '')
        )
      )
    order by m.created_at
    limit 1;

    insert into public.savings_loan_group_members (
      tenant_id,
      unit_id,
      group_id,
      member_id,
      role_in_group,
      joined_at,
      is_active,
      notes,
      created_by,
      updated_by
    )
    values (
      p_tenant_id,
      p_unit_id,
      v_group_id,
      v_member_id,
      coalesce((v_member ->> 'role_in_group')::public.savings_loan_group_member_role, 'member'),
      current_date,
      true,
      'Auto-linked from group applicant intake',
      auth.uid(),
      auth.uid()
    )
    on conflict on constraint savings_loan_group_members_unique_active_member
    do update set
      role_in_group = excluded.role_in_group,
      is_active = true,
      left_at = null,
      updated_by = auth.uid(),
      updated_at = now();
  end loop;

  insert into public.savings_loan_applications (
    tenant_id,
    unit_id,
    application_no,
    application_date,
    application_method,
    group_id,
    requested_amount,
    tenor_months,
    loan_purpose,
    income_source,
    estimated_repayment_capacity,
    business_or_job_type,
    notes,
    supporting_document_url,
    supporting_document_name,
    supporting_document_mime_type,
    status,
    input_mode,
    verification_status,
    applicant_full_name,
    applicant_phone,
    applicant_address,
    applicant_confirmed_at,
    applicant_declaration_accepted,
    assisted_by,
    assisted_reason,
    assisted_statement_required,
    assisted_statement_generated_at,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_application_no,
    coalesce(p_application_date, current_date),
    'group',
    v_group_id,
    p_requested_amount,
    p_tenor_months,
    p_loan_purpose,
    p_income_source,
    p_estimated_repayment_capacity,
    p_business_or_job_type,
    p_notes,
    p_supporting_document_url,
    p_supporting_document_name,
    p_supporting_document_mime_type,
    'draft',
    p_input_mode,
    'pending_verification',
    p_group_name,
    null,
    p_group_address,
    now(),
    coalesce(p_declaration_accepted, false),
    p_assisted_by,
    p_assisted_reason,
    p_input_mode = 'assisted_by_officer',
    case when p_input_mode = 'assisted_by_officer' then now() else null end,
    auth.uid(),
    auth.uid()
  )
  returning id into v_application_id;

  v_share := trunc((p_requested_amount / v_member_count)::numeric, 2);
  v_remainder := p_requested_amount - (v_share * v_member_count);

  for v_member in
    select value
    from jsonb_array_elements(p_members)
  loop
    select m.id
    into v_member_id
    from public.savings_loan_members m
    where m.tenant_id = p_tenant_id
      and m.unit_id = p_unit_id
      and (
        (
          nullif(trim(coalesce(v_member ->> 'identity_number', '')), '') is not null
          and m.identity_number = nullif(trim(coalesce(v_member ->> 'identity_number', '')), '')
        )
        or
        (
          nullif(trim(coalesce(v_member ->> 'phone', '')), '') is not null
          and m.phone = nullif(trim(coalesce(v_member ->> 'phone', '')), '')
        )
      )
    order by m.created_at
    limit 1;

    insert into public.savings_loan_application_group_members (
      tenant_id,
      unit_id,
      application_id,
      group_id,
      member_id,
      role_in_group,
      requested_amount_share,
      notes,
      created_by,
      updated_by
    )
    select
      p_tenant_id,
      p_unit_id,
      v_application_id,
      v_group_id,
      v_member_id,
      gm.role_in_group,
      case
        when gm.role_in_group = 'leader'::public.savings_loan_group_member_role
          then v_share + v_remainder
        else v_share
      end,
      'Auto-created from group applicant intake',
      auth.uid(),
      auth.uid()
    from public.savings_loan_group_members gm
    where gm.group_id = v_group_id
      and gm.member_id = v_member_id
      and gm.is_active = true;
  end loop;

  insert into public.savings_loan_application_declarations (
    tenant_id,
    unit_id,
    application_id,
    input_mode,
    verification_status,
    applicant_full_name,
    applicant_phone,
    applicant_address,
    declaration_text,
    declaration_accepted,
    declaration_accepted_at,
    assisted_by,
    assisted_reason,
    assisted_statement_text,
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    v_application_id,
    p_input_mode,
    'pending_verification',
    p_group_name,
    null,
    p_group_address,
    p_declaration_text,
    coalesce(p_declaration_accepted, false),
    v_declaration_accepted_at,
    p_assisted_by,
    p_assisted_reason,
    p_assisted_statement_text,
    auth.uid(),
    auth.uid()
  );

  application_id := v_application_id;
  group_id := v_group_id;
  application_no := upper(trim(p_application_no));
  group_members_count := v_member_count;
  input_mode := p_input_mode;
  verification_status := 'pending_verification';
  intake_audit_status := 'PASS';

  return next;
end;
$function$;

create or replace function public.verify_savings_loan_application(
  p_application_id uuid,
  p_notes text default null
)
returns table (
  application_id uuid,
  previous_status public.savings_loan_application_status,
  new_status public.savings_loan_application_status,
  previous_verification_status public.savings_loan_application_verification_status,
  new_verification_status public.savings_loan_application_verification_status,
  audit_timeline_id uuid,
  message text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_audit_id uuid;
begin
  select *
  into v_context
  from public.get_user_login_context(auth.uid())
  limit 1;

  perform public.assert_user_has_permission('savings_loan.application.verify', auth.uid(), v_context.tenant_id, v_context.unit_id
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

  if v_application.status in ('disbursed', 'partial_paid', 'paid_off') then
    raise exception 'Pengajuan yang sudah berjalan tidak dapat diverifikasi ulang.';
  end if;

  if v_application.status = 'rejected' then
    raise exception 'Pengajuan yang sudah ditolak tidak dapat diverifikasi.';
  end if;

  update public.savings_loan_applications
  set
    status = 'approved',
    verification_status = 'verified',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    approved_at = now(),
    approved_by = auth.uid(),
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_application_id;

  update public.savings_loan_application_declarations
  set
    verification_status = 'verified',
    updated_by = auth.uid(),
    updated_at = now()
  where savings_loan_application_declarations.application_id = p_application_id;

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
    'savings_loan_application.verified',
    'savings_loan_applications',
    p_application_id,
    'savings_loan_application',
    p_application_id,
    'Pengajuan pinjaman diverifikasi',
    jsonb_build_object(
      'previous_status', v_application.status,
      'new_status', 'approved',
      'previous_verification_status', v_application.verification_status,
      'new_verification_status', 'verified',
      'notes', p_notes
    )
  )
  returning id into v_audit_id;

  application_id := p_application_id;
  previous_status := v_application.status;
  new_status := 'approved';
  previous_verification_status := v_application.verification_status;
  new_verification_status := 'verified';
  audit_timeline_id := v_audit_id;
  message := 'Pengajuan pinjaman berhasil diverifikasi.';

  return next;
end;
$function$;

create or replace function public.request_correction_savings_loan_application(
  p_application_id uuid,
  p_correction_notes text
)
returns table (
  application_id uuid,
  previous_status public.savings_loan_application_status,
  new_status public.savings_loan_application_status,
  previous_verification_status public.savings_loan_application_verification_status,
  new_verification_status public.savings_loan_application_verification_status,
  audit_timeline_id uuid,
  message text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_audit_id uuid;
begin
  if nullif(trim(coalesce(p_correction_notes, '')), '') is null then
    raise exception 'Catatan perbaikan wajib diisi.';
  end if;

  select *
  into v_context
  from public.get_user_login_context(auth.uid())
  limit 1;

  perform public.assert_user_has_permission('savings_loan.application.request_correction', auth.uid(), v_context.tenant_id, v_context.unit_id
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

  if v_application.status in ('approved', 'disbursed', 'partial_paid', 'paid_off') then
    raise exception 'Pengajuan yang sudah disetujui/berjalan tidak dapat diminta perbaikan.';
  end if;

  if v_application.status = 'rejected' then
    raise exception 'Pengajuan yang sudah ditolak tidak dapat diminta perbaikan.';
  end if;

  update public.savings_loan_applications
  set
    status = 'under_review',
    verification_status = 'needs_correction',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = p_correction_notes,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_application_id;

  update public.savings_loan_application_declarations
  set
    verification_status = 'needs_correction',
    updated_by = auth.uid(),
    updated_at = now()
  where savings_loan_application_declarations.application_id = p_application_id;

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
    'savings_loan_application.needs_correction',
    'savings_loan_applications',
    p_application_id,
    'savings_loan_application',
    p_application_id,
    'Pengajuan pinjaman perlu perbaikan',
    jsonb_build_object(
      'previous_status', v_application.status,
      'new_status', 'under_review',
      'previous_verification_status', v_application.verification_status,
      'new_verification_status', 'needs_correction',
      'correction_notes', p_correction_notes
    )
  )
  returning id into v_audit_id;

  application_id := p_application_id;
  previous_status := v_application.status;
  new_status := 'under_review';
  previous_verification_status := v_application.verification_status;
  new_verification_status := 'needs_correction';
  audit_timeline_id := v_audit_id;
  message := 'Pengajuan pinjaman ditandai perlu perbaikan.';

  return next;
end;
$function$;

create or replace function public.reject_savings_loan_application(
  p_application_id uuid,
  p_rejection_reason text
)
returns table (
  application_id uuid,
  previous_status public.savings_loan_application_status,
  new_status public.savings_loan_application_status,
  previous_verification_status public.savings_loan_application_verification_status,
  new_verification_status public.savings_loan_application_verification_status,
  audit_timeline_id uuid,
  message text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_audit_id uuid;
begin
  if nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  select *
  into v_context
  from public.get_user_login_context(auth.uid())
  limit 1;

  perform public.assert_user_has_permission('savings_loan.application.reject', auth.uid(), v_context.tenant_id, v_context.unit_id
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

  if v_application.status in ('approved', 'disbursed', 'partial_paid', 'paid_off') then
    raise exception 'Pengajuan yang sudah disetujui/berjalan tidak dapat ditolak.';
  end if;

  if v_application.status = 'rejected' then
    raise exception 'Pengajuan sudah berstatus ditolak.';
  end if;

  update public.savings_loan_applications
  set
    status = 'rejected',
    verification_status = 'rejected',
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejected_at = now(),
    rejected_by = auth.uid(),
    rejection_reason = p_rejection_reason,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_application_id;

  update public.savings_loan_application_declarations
  set
    verification_status = 'rejected',
    updated_by = auth.uid(),
    updated_at = now()
  where savings_loan_application_declarations.application_id = p_application_id;

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
    'savings_loan_application.rejected',
    'savings_loan_applications',
    p_application_id,
    'savings_loan_application',
    p_application_id,
    'Pengajuan pinjaman ditolak',
    jsonb_build_object(
      'previous_status', v_application.status,
      'new_status', 'rejected',
      'previous_verification_status', v_application.verification_status,
      'new_verification_status', 'rejected',
      'rejection_reason', p_rejection_reason
    )
  )
  returning id into v_audit_id;

  application_id := p_application_id;
  previous_status := v_application.status;
  new_status := 'rejected';
  previous_verification_status := v_application.verification_status;
  new_verification_status := 'rejected';
  audit_timeline_id := v_audit_id;
  message := 'Pengajuan pinjaman berhasil ditolak.';

  return next;
end;
$function$;

create or replace function public.create_and_post_savings_loan_disbursement(
  p_application_id uuid,
  p_disbursement_no text,
  p_disbursement_date date,
  p_cash_bank_account_id uuid,
  p_notes text default null
)
returns table (
  disbursement_id uuid,
  application_id uuid,
  disbursement_no text,
  principal_amount numeric,
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
  v_cash_bank record;
  v_period_id uuid;
  v_receivable_account_id uuid;
  v_cash_account_id uuid;
  v_journal_id uuid;
  v_cash_tx_id uuid;
  v_disbursement_id uuid;
  v_audit_id uuid;
begin
  select *
  into v_context
  from public.get_user_login_context(auth.uid())
  limit 1;

  perform public.assert_user_has_permission('savings_loan.disbursement.create', auth.uid(), v_context.tenant_id, v_context.unit_id
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

  if v_application.status <> 'approved'
     or v_application.verification_status <> 'verified' then
    raise exception 'Hanya pengajuan approved dan verified yang dapat dicairkan.';
  end if;

  if exists (
    select 1
    from public.savings_loan_disbursements d
    where d.application_id = p_application_id
      and d.status = 'posted'
  ) then
    raise exception 'Pengajuan ini sudah pernah dicairkan.';
  end if;

  select *
  into v_cash_bank
  from public.cash_bank_accounts cba
  where cba.id = p_cash_bank_account_id
    and cba.tenant_id = v_application.tenant_id
    and cba.unit_id = v_application.unit_id
    and cba.is_active = true;

  if v_cash_bank.id is null then
    raise exception 'Akun kas/bank pencairan tidak valid.';
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
    raise exception 'COA kas/bank pencairan belum terhubung.';
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

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_application.tenant_id
    and ap.unit_id = v_application.unit_id
    and p_disbursement_date between ap.period_start and ap.period_end
  limit 1;

  if v_period_id is null then
    raise exception 'Periode akuntansi pencairan tidak ditemukan.';
  end if;

  perform public.assert_period_open(v_period_id);

  perform public.assert_cash_bank_account_sufficient_balance(
    p_cash_bank_account_id,
    v_application.requested_amount
  );

  insert into public.savings_loan_disbursements (
    tenant_id,
    unit_id,
    application_id,
    disbursement_no,
    disbursement_date,
    cash_bank_account_id,
    principal_amount,
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
    p_disbursement_no,
    coalesce(p_disbursement_date, current_date),
    p_cash_bank_account_id,
    v_application.requested_amount,
    p_notes,
    'posted',
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_disbursement_id;

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
    'JP-' || upper(trim(p_disbursement_no)),
    coalesce(p_disbursement_date, current_date),
    'Pencairan pinjaman ' || upper(trim(p_disbursement_no)),
    'savings_loan_disbursement',
    v_disbursement_id,
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
  values
    (
      v_journal_id,
      1,
      v_receivable_account_id,
      v_application.requested_amount,
      0,
      'Piutang pinjaman anggota'
    ),
    (
      v_journal_id,
      2,
      v_cash_account_id,
      0,
      v_application.requested_amount,
      'Kas/bank keluar pencairan pinjaman'
    );

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
    coalesce(p_disbursement_date, current_date),
    'CB-' || upper(trim(p_disbursement_no)),
    'payment',
    v_application.requested_amount,
    'Pencairan pinjaman ' || upper(trim(p_disbursement_no)),
    'savings_loan_disbursement',
    v_disbursement_id,
    v_journal_id,
    'posted',
    auth.uid()
  )
  returning id into v_cash_tx_id;

  update public.savings_loan_disbursements
  set
    journal_entry_id = v_journal_id,
    cash_bank_transaction_id = v_cash_tx_id,
    updated_at = now()
  where id = v_disbursement_id;

  update public.savings_loan_applications
  set
    status = 'disbursed',
    disbursed_at = now(),
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
    'savings_loan_disbursement.posted',
    'savings_loan_disbursements',
    v_disbursement_id,
    'savings_loan_disbursement',
    v_disbursement_id,
    'Pencairan pinjaman diposting',
    jsonb_build_object(
      'application_id', p_application_id,
      'disbursement_no', upper(trim(p_disbursement_no)),
      'principal_amount', v_application.requested_amount,
      'journal_entry_id', v_journal_id,
      'cash_bank_transaction_id', v_cash_tx_id
    )
  )
  returning id into v_audit_id;

  disbursement_id := v_disbursement_id;
  application_id := p_application_id;
  disbursement_no := upper(trim(p_disbursement_no));
  principal_amount := v_application.requested_amount;
  journal_entry_id := v_journal_id;
  cash_bank_transaction_id := v_cash_tx_id;
  audit_timeline_id := v_audit_id;
  audit_result := 'PASS';

  return next;
end;
$function$;

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
  returning id, total_amount
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

create or replace function public.generate_savings_loan_repayment_schedule(
  p_application_id uuid,
  p_product_id uuid,
  p_first_due_date date default null
)
returns table (
  application_id uuid,
  product_id uuid,
  generated_installments integer,
  principal_total numeric,
  service_total numeric,
  admin_total numeric,
  schedule_audit_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_product record;
  v_existing_paid_count integer;
  v_installment_no integer;
  v_first_due_date date;
  v_due_date date;
  v_principal_base numeric;
  v_principal_remainder numeric;
  v_service_total numeric;
  v_service_base numeric;
  v_service_remainder numeric;
  v_admin_amount numeric;
  v_principal_amount numeric;
  v_service_amount numeric;
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
    raise exception 'Jadwal hanya dapat dibuat untuk pengajuan verified.';
  end if;

  if v_application.status not in ('approved', 'disbursed', 'partial_paid', 'paid_off') then
    raise exception 'Status pengajuan belum dapat dibuatkan jadwal angsuran.';
  end if;

  select *
  into v_product
  from public.savings_loan_products p
  where p.id = p_product_id
    and p.tenant_id = v_application.tenant_id
    and p.unit_id = v_application.unit_id
    and p.is_active = true;

  if v_product.id is null then
    raise exception 'Produk pinjaman tidak valid atau tidak aktif.';
  end if;

  if v_application.tenor_months < v_product.min_tenor_months
     or v_application.tenor_months > v_product.max_tenor_months then
    raise exception 'Tenor pengajuan tidak sesuai batas produk pinjaman.';
  end if;

  select count(*)
  into v_existing_paid_count
  from public.savings_loan_repayment_schedules s
  where s.application_id = p_application_id
    and (
      s.repayment_id is not null
      or s.paid_principal_amount > 0
      or s.paid_service_amount > 0
      or s.paid_admin_amount > 0
      or s.paid_penalty_amount > 0
    );

  if v_existing_paid_count > 0 then
    raise exception 'Jadwal yang sudah memiliki pembayaran tidak boleh dibuat ulang.';
  end if;

  delete from public.savings_loan_repayment_schedules
  where savings_loan_repayment_schedules.application_id = p_application_id;

  v_first_due_date := coalesce(
    p_first_due_date,
    (coalesce(v_application.disbursed_at::date, current_date) + interval '1 month')::date
  );

  if v_product.interest_method = 'flat_total'::public.savings_loan_interest_method then
    v_service_total := round(v_application.requested_amount * v_product.service_rate / 100, 2);
  elsif v_product.interest_method = 'flat_monthly'::public.savings_loan_interest_method then
    v_service_total := round(v_application.requested_amount * v_product.service_rate / 100 * v_application.tenor_months, 2);
  else
    v_service_total := 0;
  end if;

  v_principal_base := trunc((v_application.requested_amount / v_application.tenor_months)::numeric, 2);
  v_principal_remainder := v_application.requested_amount - (v_principal_base * v_application.tenor_months);

  v_service_base := trunc((v_service_total / v_application.tenor_months)::numeric, 2);
  v_service_remainder := v_service_total - (v_service_base * v_application.tenor_months);

  for v_installment_no in 1..v_application.tenor_months loop
    v_due_date := (v_first_due_date + ((v_installment_no - 1) || ' month')::interval)::date;

    v_principal_amount := v_principal_base;
    v_service_amount := v_service_base;
    v_admin_amount := 0;

    if v_installment_no = v_application.tenor_months then
      v_principal_amount := v_principal_amount + v_principal_remainder;
      v_service_amount := v_service_amount + v_service_remainder;
    end if;

    if v_installment_no = 1 then
      v_admin_amount := coalesce(v_product.admin_fee_amount, 0);
    end if;

    insert into public.savings_loan_repayment_schedules (
      tenant_id,
      unit_id,
      application_id,
      product_id,
      installment_no,
      due_date,
      principal_amount,
      service_amount,
      admin_amount,
      penalty_amount,
      status,
      created_by
    )
    values (
      v_application.tenant_id,
      v_application.unit_id,
      p_application_id,
      p_product_id,
      v_installment_no,
      v_due_date,
      v_principal_amount,
      v_service_amount,
      v_admin_amount,
      0,
      'scheduled',
      auth.uid()
    );
  end loop;

  return query
  select
    p_application_id,
    p_product_id,
    count(*)::integer,
    coalesce(sum(s.principal_amount), 0),
    coalesce(sum(s.service_amount), 0),
    coalesce(sum(s.admin_amount), 0),
    case
      when count(*) = v_application.tenor_months
       and coalesce(sum(s.principal_amount), 0) = v_application.requested_amount
       and coalesce(sum(s.service_amount), 0) = v_service_total
      then 'PASS'
      else 'CHECK_SCHEDULE'
    end
  from public.savings_loan_repayment_schedules s
  where s.application_id = p_application_id;
end;
$function$;

create or replace function public.sync_savings_loan_repayment_schedule_payments(
  p_application_id uuid
)
returns table (
  application_id uuid,
  total_schedule_amount numeric,
  total_paid_amount numeric,
  paid_installments integer,
  partial_installments integer,
  unpaid_installments integer,
  schedule_sync_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_context record;
  v_application record;
  v_total_paid_principal numeric;
  v_total_paid_service numeric;
  v_total_paid_admin numeric;
  v_total_paid_penalty numeric;
  v_remaining_principal numeric;
  v_remaining_service numeric;
  v_remaining_admin numeric;
  v_remaining_penalty numeric;
  v_schedule record;
  v_pay_principal numeric;
  v_pay_service numeric;
  v_pay_admin numeric;
  v_pay_penalty numeric;
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

  if not exists (
    select 1
    from public.savings_loan_repayment_schedules s
    where s.application_id = p_application_id
  ) then
    raise exception 'Jadwal angsuran belum dibuat.';
  end if;

  select
    coalesce(sum(r.principal_amount), 0),
    coalesce(sum(r.service_amount), 0),
    coalesce(sum(r.admin_amount), 0),
    coalesce(sum(r.penalty_amount), 0)
  into
    v_total_paid_principal,
    v_total_paid_service,
    v_total_paid_admin,
    v_total_paid_penalty
  from public.savings_loan_repayments r
  where r.application_id = p_application_id
    and r.status = 'posted';

  v_remaining_principal := v_total_paid_principal;
  v_remaining_service := v_total_paid_service;
  v_remaining_admin := v_total_paid_admin;
  v_remaining_penalty := v_total_paid_penalty;

  update public.savings_loan_repayment_schedules
  set
    paid_principal_amount = 0,
    paid_service_amount = 0,
    paid_admin_amount = 0,
    paid_penalty_amount = 0,
    repayment_id = null,
    status = 'scheduled',
    updated_at = now()
  where savings_loan_repayment_schedules.application_id = p_application_id;

  for v_schedule in
    select *
    from public.savings_loan_repayment_schedules s
    where s.application_id = p_application_id
    order by s.installment_no
    for update
  loop
    v_pay_principal := least(v_remaining_principal, v_schedule.principal_amount);
    v_remaining_principal := v_remaining_principal - v_pay_principal;

    v_pay_service := least(v_remaining_service, v_schedule.service_amount);
    v_remaining_service := v_remaining_service - v_pay_service;

    v_pay_admin := least(v_remaining_admin, v_schedule.admin_amount);
    v_remaining_admin := v_remaining_admin - v_pay_admin;

    v_pay_penalty := least(v_remaining_penalty, v_schedule.penalty_amount);
    v_remaining_penalty := v_remaining_penalty - v_pay_penalty;

    update public.savings_loan_repayment_schedules
    set
      paid_principal_amount = v_pay_principal,
      paid_service_amount = v_pay_service,
      paid_admin_amount = v_pay_admin,
      paid_penalty_amount = v_pay_penalty,
      status = case
        when
          v_pay_principal >= v_schedule.principal_amount
          and v_pay_service >= v_schedule.service_amount
          and v_pay_admin >= v_schedule.admin_amount
          and v_pay_penalty >= v_schedule.penalty_amount
        then 'paid'::public.savings_loan_schedule_status
        when
          v_pay_principal > 0
          or v_pay_service > 0
          or v_pay_admin > 0
          or v_pay_penalty > 0
        then 'partially_paid'::public.savings_loan_schedule_status
        else 'scheduled'::public.savings_loan_schedule_status
      end,
      updated_at = now()
    where id = v_schedule.id;
  end loop;

  return query
  select
    p_application_id,
    coalesce(sum(s.total_amount), 0),
    coalesce(sum(
      s.paid_principal_amount
      + s.paid_service_amount
      + s.paid_admin_amount
      + s.paid_penalty_amount
    ), 0),
    count(*) filter (where s.status = 'paid')::integer,
    count(*) filter (where s.status = 'partially_paid')::integer,
    count(*) filter (where s.status = 'scheduled')::integer,
    case
      when count(*) filter (where s.status <> 'paid') = 0
      then 'PASS_PAID_OFF_SCHEDULE_SYNC'
      when count(*) filter (where s.status = 'partially_paid') > 0
        or count(*) filter (where s.status = 'paid') > 0
      then 'PASS_PARTIAL_SCHEDULE_SYNC'
      when coalesce(sum(
        s.paid_principal_amount
        + s.paid_service_amount
        + s.paid_admin_amount
        + s.paid_penalty_amount
      ), 0) = 0
      then 'PASS_READY_FOR_PAYMENT'
      else 'CHECK_SCHEDULE_SYNC'
    end
  from public.savings_loan_repayment_schedules s
  where s.application_id = p_application_id;
end;
$function$;

commit;