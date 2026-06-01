-- ============================================================================
-- 000027_savings_loan_engine.sql
-- ORVIA-BUMDES Commercial Baseline Migration
-- Savings Loan / Simpan Pinjam Engine
--
-- Packaging rule:
-- - Preserve proven existing engine behavior.
-- - Do not simplify applicant-first intake, public submission, verification,
--   disbursement, repayment, schedule, or audit flow.
-- - Tables/functions/views are ordered by dependency audit evidence.
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'savings_loan_member_status') then
    create type public.savings_loan_member_status as enum (
      'active',
      'inactive',
      'suspended',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_group_status') then
    create type public.savings_loan_group_status as enum (
      'active',
      'inactive',
      'suspended',
      'closed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_group_member_role') then
    create type public.savings_loan_group_member_role as enum (
      'leader',
      'secretary',
      'treasurer',
      'member'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_application_method') then
    create type public.savings_loan_application_method as enum (
      'individual',
      'group'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_application_status') then
    create type public.savings_loan_application_status as enum (
      'draft',
      'submitted',
      'under_review',
      'approved',
      'rejected',
      'cancelled',
      'disbursed',
      'partial_paid',
      'paid_off'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_application_input_mode') then
    create type public.savings_loan_application_input_mode as enum (
      'self_service',
      'assisted_by_officer'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_application_verification_status') then
    create type public.savings_loan_application_verification_status as enum (
      'pending_verification',
      'verified',
      'needs_correction',
      'rejected'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_interest_method') then
    create type public.savings_loan_interest_method as enum (
      'flat_total',
      'flat_monthly',
      'manual'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'savings_loan_schedule_status') then
    create type public.savings_loan_schedule_status as enum (
      'scheduled',
      'partially_paid',
      'paid',
      'overdue',
      'cancelled'
    );
  end if;
end
$$;


-- ============================================================================
-- TABLES - MASTER DATA
-- ============================================================================

create table if not exists public.savings_loan_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  member_no text not null,
  full_name text not null,
  identity_number text,
  phone text,
  address text,
  join_date date not null default current_date,
  status public.savings_loan_member_status not null default 'active',
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_members_member_no_unique unique (tenant_id, unit_id, member_no)
);

create table if not exists public.savings_loan_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  group_no text not null,
  group_name text not null,
  leader_member_id uuid not null references public.savings_loan_members(id),
  formation_date date not null default current_date,
  status public.savings_loan_group_status not null default 'active',
  address text,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_groups_group_no_unique unique (tenant_id, unit_id, group_no)
);

create table if not exists public.savings_loan_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  group_id uuid not null references public.savings_loan_groups(id) on delete cascade,
  member_id uuid not null references public.savings_loan_members(id),
  role_in_group public.savings_loan_group_member_role not null default 'member',
  joined_at date not null default current_date,
  left_at date,
  is_active boolean not null default true,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_group_members_unique_active_member unique (group_id, member_id)
);

create table if not exists public.savings_loan_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),
  product_code text not null,
  product_name text not null,
  interest_method public.savings_loan_interest_method not null default 'flat_total',
  service_rate numeric not null default 0,
  admin_fee_amount numeric not null default 0,
  penalty_rate numeric not null default 0,
  min_tenor_months integer not null default 1,
  max_tenor_months integer not null default 12,
  is_active boolean not null default true,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_products_unique_code unique (tenant_id, unit_id, product_code),
  constraint savings_loan_products_service_rate_nonnegative check (service_rate >= 0),
  constraint savings_loan_products_admin_fee_nonnegative check (admin_fee_amount >= 0),
  constraint savings_loan_products_penalty_rate_nonnegative check (penalty_rate >= 0),
  constraint savings_loan_products_tenor_valid check (
    min_tenor_months > 0
    and max_tenor_months >= min_tenor_months
  )
);


-- ============================================================================
-- TABLES - APPLICATION INTAKE
-- ============================================================================

create table if not exists public.savings_loan_public_application_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  public_slug text not null,
  public_token text not null,
  title text not null default 'Form Pengajuan Pinjaman',
  description text,
  is_active boolean not null default true,
  allow_individual boolean not null default true,
  allow_group boolean not null default true,
  require_pdf boolean not null default true,
  max_requested_amount numeric,
  min_tenor_months integer,
  max_tenor_months integer,
  disabled_by uuid,
  disabled_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_public_application_links_slug_unique unique (public_slug),
  constraint savings_loan_public_application_links_token_unique unique (public_token),
  constraint savings_loan_public_application_links_unit_unique unique (tenant_id, unit_id),
  constraint savings_loan_public_application_links_slug_check check (
    public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint savings_loan_public_application_links_token_check check (
    length(public_token) >= 16
  ),
  constraint savings_loan_public_application_links_amount_check check (
    max_requested_amount is null or max_requested_amount > 0
  ),
  constraint savings_loan_public_application_links_tenor_check check (
    (min_tenor_months is null or min_tenor_months > 0)
    and (max_tenor_months is null or max_tenor_months > 0)
    and (
      min_tenor_months is null
      or max_tenor_months is null
      or min_tenor_months <= max_tenor_months
    )
  )
);

create table if not exists public.savings_loan_applications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  application_no text not null,
  application_date date not null default current_date,
  application_method public.savings_loan_application_method not null,
  member_id uuid references public.savings_loan_members(id),
  group_id uuid references public.savings_loan_groups(id),
  requested_amount numeric not null,
  tenor_months integer not null,
  loan_purpose text not null,
  income_source text not null,
  estimated_repayment_capacity numeric not null,
  business_or_job_type text not null,
  notes text,
  supporting_document_url text not null,
  supporting_document_name text not null,
  supporting_document_mime_type text not null,
  status public.savings_loan_application_status not null default 'draft',
  input_mode public.savings_loan_application_input_mode not null default 'assisted_by_officer',
  verification_status public.savings_loan_application_verification_status not null default 'pending_verification',
  applicant_full_name text,
  applicant_identity_number text,
  applicant_phone text,
  applicant_address text,
  applicant_confirmed_at timestamptz,
  applicant_declaration_accepted boolean not null default false,
  assisted_by uuid,
  assisted_reason text,
  assisted_statement_required boolean not null default false,
  assisted_statement_generated_at timestamptz,
  assisted_statement_url text,
  assisted_statement_name text,
  assisted_statement_mime_type text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  approved_at timestamptz,
  approved_by uuid,
  rejected_at timestamptz,
  rejected_by uuid,
  rejection_reason text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  disbursed_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_applications_unique_no unique (tenant_id, unit_id, application_no),
  constraint savings_loan_applications_method_target_check check (
    (
      application_method = 'individual'
      and member_id is not null
      and group_id is null
    )
    or
    (
      application_method = 'group'
      and group_id is not null
    )
  ),
  constraint savings_loan_applications_positive_amount check (requested_amount > 0),
  constraint savings_loan_applications_positive_tenor check (tenor_months > 0),
  constraint savings_loan_applications_positive_capacity check (estimated_repayment_capacity >= 0)
);

create table if not exists public.savings_loan_application_group_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  application_id uuid not null references public.savings_loan_applications(id) on delete cascade,
  group_id uuid not null references public.savings_loan_groups(id) on delete cascade,
  member_id uuid not null references public.savings_loan_members(id),
  role_in_group public.savings_loan_group_member_role not null default 'member',
  requested_amount_share numeric,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_application_group_members_unique unique (application_id, member_id),
  constraint savings_loan_application_group_members_amount_share_positive check (
    requested_amount_share is null or requested_amount_share > 0
  )
);

create table if not exists public.savings_loan_application_declarations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  unit_id uuid not null,
  application_id uuid not null references public.savings_loan_applications(id) on delete cascade,
  input_mode public.savings_loan_application_input_mode not null,
  verification_status public.savings_loan_application_verification_status not null default 'pending_verification',
  applicant_full_name text not null,
  applicant_identity_number text,
  applicant_phone text,
  applicant_address text,
  declaration_text text,
  declaration_accepted boolean not null default false,
  declaration_accepted_at timestamptz,
  assisted_by uuid,
  assisted_reason text,
  assisted_statement_text text,
  assisted_statement_name text,
  assisted_statement_mime_type text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_application_declarations_input_check check (
    (
      input_mode = 'self_service'
      and declaration_accepted = true
      and declaration_accepted_at is not null
    )
    or
    (
      input_mode = 'assisted_by_officer'
      and assisted_by is not null
      and assisted_statement_text is not null
    )
  )
);

create table if not exists public.savings_loan_public_application_submissions (
  id uuid primary key default gen_random_uuid(),
  public_link_id uuid not null references public.savings_loan_public_application_links(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  application_id uuid not null references public.savings_loan_applications(id) on delete cascade,
  application_method public.savings_loan_application_method not null,
  public_slug text not null,
  submitted_user_agent text,
  submitted_referrer text,
  submitted_at timestamptz not null default now(),
  constraint savings_loan_public_submissions_application_unique unique (application_id)
);


-- ============================================================================
-- TABLES - DISBURSEMENT, REPAYMENT, SCHEDULE
-- ============================================================================

create table if not exists public.savings_loan_disbursements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),
  application_id uuid not null references public.savings_loan_applications(id),
  disbursement_no text not null,
  disbursement_date date not null default current_date,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  principal_amount numeric not null,
  notes text,
  status text not null default 'posted',
  journal_entry_id uuid references public.journal_entries(id),
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id),
  posted_at timestamptz,
  posted_by uuid,
  cancelled_at timestamptz,
  cancelled_by uuid,
  cancellation_reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_disbursements_application_unique unique (application_id),
  constraint savings_loan_disbursements_no_unique unique (tenant_id, unit_id, disbursement_no),
  constraint savings_loan_disbursements_amount_positive check (principal_amount > 0),
  constraint savings_loan_disbursements_status_check check (
    status = any (array['draft'::text, 'posted'::text, 'cancelled'::text])
  )
);

create table if not exists public.savings_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),
  application_id uuid not null references public.savings_loan_applications(id),
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id),
  repayment_no text not null,
  repayment_date date not null default current_date,
  principal_amount numeric not null default 0,
  service_amount numeric not null default 0,
  admin_amount numeric not null default 0,
  penalty_amount numeric not null default 0,
  total_amount numeric generated always as (
    principal_amount + service_amount + admin_amount + penalty_amount
  ) stored,
  notes text,
  status text not null default 'posted',
  journal_entry_id uuid references public.journal_entries(id),
  cash_bank_transaction_id uuid references public.cash_bank_transactions(id),
  posted_at timestamptz,
  posted_by uuid references auth.users(id),
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id),
  cancellation_reason text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_repayments_unique_no unique (tenant_id, unit_id, repayment_no),
  constraint savings_loan_repayments_amounts_non_negative check (
    principal_amount >= 0
    and service_amount >= 0
    and admin_amount >= 0
    and penalty_amount >= 0
  ),
  constraint savings_loan_repayments_principal_or_income_positive check (
    principal_amount > 0
    or service_amount > 0
    or admin_amount > 0
    or penalty_amount > 0
  ),
  constraint savings_loan_repayments_total_positive check (
    principal_amount + service_amount + admin_amount + penalty_amount > 0
  ),
  constraint savings_loan_repayments_status_check check (
    status = any (array['posted'::text, 'cancelled'::text])
  )
);

create table if not exists public.savings_loan_repayment_schedules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id),
  unit_id uuid not null references public.business_units(id),
  application_id uuid not null references public.savings_loan_applications(id),
  product_id uuid not null references public.savings_loan_products(id),
  installment_no integer not null,
  due_date date not null,
  principal_amount numeric not null default 0,
  service_amount numeric not null default 0,
  admin_amount numeric not null default 0,
  penalty_amount numeric not null default 0,
  total_amount numeric generated always as (
    principal_amount + service_amount + admin_amount + penalty_amount
  ) stored,
  paid_principal_amount numeric not null default 0,
  paid_service_amount numeric not null default 0,
  paid_admin_amount numeric not null default 0,
  paid_penalty_amount numeric not null default 0,
  repayment_id uuid references public.savings_loan_repayments(id),
  status public.savings_loan_schedule_status not null default 'scheduled',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint savings_loan_repayment_schedules_unique_installment unique (application_id, installment_no),
  constraint savings_loan_repayment_schedules_installment_positive check (installment_no > 0),
  constraint savings_loan_repayment_schedules_amounts_nonnegative check (
    principal_amount >= 0
    and service_amount >= 0
    and admin_amount >= 0
    and penalty_amount >= 0
    and paid_principal_amount >= 0
    and paid_service_amount >= 0
    and paid_admin_amount >= 0
    and paid_penalty_amount >= 0
  ),
  constraint savings_loan_repayment_schedules_total_positive check (
    principal_amount + service_amount + admin_amount + penalty_amount > 0
  )
);


-- ============================================================================
-- INDEXES
-- ============================================================================

create index if not exists idx_savings_loan_members_tenant_unit
  on public.savings_loan_members (tenant_id, unit_id);

create index if not exists idx_savings_loan_members_status
  on public.savings_loan_members (status);

create index if not exists idx_savings_loan_groups_tenant_unit
  on public.savings_loan_groups (tenant_id, unit_id);

create index if not exists idx_savings_loan_groups_status
  on public.savings_loan_groups (status);

create index if not exists idx_savings_loan_group_members_tenant_unit
  on public.savings_loan_group_members (tenant_id, unit_id);

create index if not exists idx_savings_loan_group_members_group
  on public.savings_loan_group_members (group_id);

create index if not exists idx_savings_loan_group_members_member
  on public.savings_loan_group_members (member_id);

create index if not exists idx_savings_loan_products_tenant_unit
  on public.savings_loan_products (tenant_id, unit_id);

create index if not exists idx_savings_loan_products_active
  on public.savings_loan_products (is_active);

create index if not exists idx_savings_loan_public_application_links_tenant_unit
  on public.savings_loan_public_application_links (tenant_id, unit_id);

create index if not exists idx_savings_loan_public_application_links_active_slug
  on public.savings_loan_public_application_links (public_slug)
  where is_active = true;

create index if not exists idx_savings_loan_applications_tenant_unit
  on public.savings_loan_applications (tenant_id, unit_id);

create index if not exists idx_savings_loan_applications_status
  on public.savings_loan_applications (status);

create index if not exists idx_savings_loan_applications_verification_status
  on public.savings_loan_applications (verification_status);

create index if not exists idx_savings_loan_applications_member
  on public.savings_loan_applications (member_id);

create index if not exists idx_savings_loan_applications_group
  on public.savings_loan_applications (group_id);

create index if not exists idx_savings_loan_application_group_members_application
  on public.savings_loan_application_group_members (application_id);

create index if not exists idx_savings_loan_application_group_members_group
  on public.savings_loan_application_group_members (group_id);

create index if not exists idx_savings_loan_application_group_members_member
  on public.savings_loan_application_group_members (member_id);

create index if not exists idx_savings_loan_application_declarations_application
  on public.savings_loan_application_declarations (application_id);

create index if not exists idx_savings_loan_public_application_submissions_link
  on public.savings_loan_public_application_submissions (public_link_id);

create index if not exists idx_savings_loan_public_application_submissions_application
  on public.savings_loan_public_application_submissions (application_id);

create index if not exists idx_savings_loan_disbursements_tenant_unit
  on public.savings_loan_disbursements (tenant_id, unit_id);

create index if not exists idx_savings_loan_disbursements_application
  on public.savings_loan_disbursements (application_id);

create index if not exists idx_savings_loan_disbursements_journal
  on public.savings_loan_disbursements (journal_entry_id);

create index if not exists idx_savings_loan_disbursements_cash_tx
  on public.savings_loan_disbursements (cash_bank_transaction_id);

create index if not exists idx_savings_loan_repayments_tenant_unit
  on public.savings_loan_repayments (tenant_id, unit_id);

create index if not exists idx_savings_loan_repayments_application
  on public.savings_loan_repayments (application_id);

create index if not exists idx_savings_loan_repayments_journal
  on public.savings_loan_repayments (journal_entry_id);

create index if not exists idx_savings_loan_repayments_cash_tx
  on public.savings_loan_repayments (cash_bank_transaction_id);

create index if not exists idx_savings_loan_repayment_schedules_tenant_unit
  on public.savings_loan_repayment_schedules (tenant_id, unit_id);

create index if not exists idx_savings_loan_repayment_schedules_application
  on public.savings_loan_repayment_schedules (application_id);

create index if not exists idx_savings_loan_repayment_schedules_due_date
  on public.savings_loan_repayment_schedules (due_date);

create index if not exists idx_savings_loan_repayment_schedules_status
  on public.savings_loan_repayment_schedules (status);


-- ============================================================================
-- TRIGGER FUNCTIONS - UPDATED_AT AND SCOPE GUARDS
-- ============================================================================

create or replace function public.set_savings_loan_public_application_links_updated_at()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.assert_savings_loan_member_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_unit record;
begin
  select
    bu.id,
    bu.tenant_id,
    bu.template_id,
    bu.status,
    ut.kode_template
  into v_unit
  from public.business_units bu
  left join public.unit_templates ut
    on ut.id = bu.template_id
  where bu.id = new.unit_id;

  if v_unit.id is null then
    raise exception 'Unit simpan pinjam tidak ditemukan.';
  end if;

  if v_unit.tenant_id <> new.tenant_id then
    raise exception 'Tenant anggota simpan pinjam tidak sesuai dengan unit.';
  end if;

  if v_unit.status <> 'aktif' then
    raise exception 'Unit simpan pinjam belum aktif.';
  end if;

  if coalesce(v_unit.kode_template, '') <> 'SIMPAN_PINJAM' then
    raise exception 'Data anggota hanya boleh dibuat pada unit Simpan Pinjam.';
  end if;

  new.member_no := upper(trim(new.member_no));
  new.full_name := trim(new.full_name);
  new.identity_number := nullif(trim(coalesce(new.identity_number, '')), '');
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.address := nullif(trim(coalesce(new.address, '')), '');
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.assert_savings_loan_group_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_leader record;
begin
  select
    m.id,
    m.tenant_id,
    m.unit_id,
    m.status
  into v_leader
  from public.savings_loan_members m
  where m.id = new.leader_member_id;

  if v_leader.id is null then
    raise exception 'Ketua kelompok tidak ditemukan.';
  end if;

  if v_leader.tenant_id <> new.tenant_id or v_leader.unit_id <> new.unit_id then
    raise exception 'Ketua kelompok harus berada pada tenant/unit yang sama.';
  end if;

  if v_leader.status <> 'active'::public.savings_loan_member_status then
    raise exception 'Ketua kelompok harus berstatus aktif.';
  end if;

  new.group_no := upper(trim(new.group_no));
  new.group_name := trim(new.group_name);
  new.address := nullif(trim(coalesce(new.address, '')), '');
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.assert_savings_loan_group_member_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_group record;
  v_member record;
begin
  select
    g.id,
    g.tenant_id,
    g.unit_id,
    g.status
  into v_group
  from public.savings_loan_groups g
  where g.id = new.group_id;

  if v_group.id is null then
    raise exception 'Kelompok simpan pinjam tidak ditemukan.';
  end if;

  if v_group.tenant_id <> new.tenant_id or v_group.unit_id <> new.unit_id then
    raise exception 'Scope kelompok tidak sesuai dengan tenant/unit relasi anggota.';
  end if;

  if v_group.status <> 'active'::public.savings_loan_group_status then
    raise exception 'Kelompok harus aktif.';
  end if;

  select
    m.id,
    m.tenant_id,
    m.unit_id,
    m.status
  into v_member
  from public.savings_loan_members m
  where m.id = new.member_id;

  if v_member.id is null then
    raise exception 'Anggota simpan pinjam tidak ditemukan.';
  end if;

  if v_member.tenant_id <> new.tenant_id or v_member.unit_id <> new.unit_id then
    raise exception 'Anggota harus berada pada tenant/unit yang sama dengan kelompok.';
  end if;

  if v_member.status <> 'active'::public.savings_loan_member_status then
    raise exception 'Anggota harus berstatus aktif.';
  end if;

  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.assert_savings_loan_application_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_member record;
  v_group record;
begin
  if new.application_method = 'individual'::public.savings_loan_application_method then
    select
      m.id,
      m.tenant_id,
      m.unit_id,
      m.status
    into v_member
    from public.savings_loan_members m
    where m.id = new.member_id;

    if v_member.id is null then
      raise exception 'Anggota pengajuan individual tidak ditemukan.';
    end if;

    if v_member.tenant_id <> new.tenant_id or v_member.unit_id <> new.unit_id then
      raise exception 'Anggota pengajuan tidak sesuai tenant/unit.';
    end if;

    if v_member.status <> 'active'::public.savings_loan_member_status then
      raise exception 'Anggota pengajuan harus aktif.';
    end if;
  end if;

  if new.application_method = 'group'::public.savings_loan_application_method then
    select
      g.id,
      g.tenant_id,
      g.unit_id,
      g.status
    into v_group
    from public.savings_loan_groups g
    where g.id = new.group_id;

    if v_group.id is null then
      raise exception 'Kelompok pengajuan tidak ditemukan.';
    end if;

    if v_group.tenant_id <> new.tenant_id or v_group.unit_id <> new.unit_id then
      raise exception 'Kelompok pengajuan tidak sesuai tenant/unit.';
    end if;

    if v_group.status <> 'active'::public.savings_loan_group_status then
      raise exception 'Kelompok pengajuan harus aktif.';
    end if;
  end if;

  if nullif(trim(coalesce(new.supporting_document_url, '')), '') is null
     or nullif(trim(coalesce(new.supporting_document_name, '')), '') is null
     or lower(trim(coalesce(new.supporting_document_mime_type, ''))) <> 'application/pdf'
     or lower(trim(coalesce(new.supporting_document_name, ''))) not like '%.pdf' then
    raise exception 'Dokumen pendukung wajib berupa PDF.';
  end if;

  new.application_no := upper(trim(new.application_no));
  new.loan_purpose := trim(new.loan_purpose);
  new.income_source := trim(new.income_source);
  new.business_or_job_type := trim(new.business_or_job_type);
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();

  return new;
end;
$function$;

create or replace function public.assert_savings_loan_application_group_member_scope()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_application record;
  v_member_relation record;
begin
  select
    a.id,
    a.tenant_id,
    a.unit_id,
    a.group_id,
    a.application_method
  into v_application
  from public.savings_loan_applications a
  where a.id = new.application_id;

  if v_application.id is null then
    raise exception 'Pengajuan pinjaman tidak ditemukan.';
  end if;

  if v_application.application_method <> 'group'::public.savings_loan_application_method then
    raise exception 'Detail anggota hanya boleh untuk pengajuan kelompok.';
  end if;

  if v_application.tenant_id <> new.tenant_id or v_application.unit_id <> new.unit_id then
    raise exception 'Detail anggota pengajuan tidak sesuai tenant/unit.';
  end if;

  if v_application.group_id <> new.group_id then
    raise exception 'Kelompok detail anggota tidak sesuai dengan kelompok pengajuan.';
  end if;

  select
    gm.id,
    gm.role_in_group
  into v_member_relation
  from public.savings_loan_group_members gm
  where gm.group_id = new.group_id
    and gm.member_id = new.member_id
    and gm.is_active = true;

  if v_member_relation.id is null then
    raise exception 'Anggota tidak terdaftar aktif pada kelompok pengajuan.';
  end if;

  new.role_in_group := v_member_relation.role_in_group;
  new.notes := nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at := now();

  return new;
end;
$function$;


create or replace function public.prevent_posted_savings_loan_disbursement_mutation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Pencairan pinjaman posted tidak boleh dihapus.';
    end if;

    return old;
  end if;

  if old.status = 'posted' then
    if new.tenant_id is distinct from old.tenant_id
       or new.unit_id is distinct from old.unit_id
       or new.application_id is distinct from old.application_id
       or new.disbursement_no is distinct from old.disbursement_no
       or new.disbursement_date is distinct from old.disbursement_date
       or new.cash_bank_account_id is distinct from old.cash_bank_account_id
       or new.principal_amount is distinct from old.principal_amount
       or new.status is distinct from old.status
       or new.posted_at is distinct from old.posted_at
       or new.posted_by is distinct from old.posted_by
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Pencairan pinjaman posted tidak boleh diubah.';
    end if;

    if old.journal_entry_id is not null
       and new.journal_entry_id is distinct from old.journal_entry_id then
      raise exception 'Journal pencairan posted tidak boleh diubah.';
    end if;

    if old.cash_bank_transaction_id is not null
       and new.cash_bank_transaction_id is distinct from old.cash_bank_transaction_id then
      raise exception 'Transaksi kas/bank pencairan posted tidak boleh diubah.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

create or replace function public.prevent_posted_savings_loan_repayment_mutation()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'Angsuran pinjaman posted tidak boleh dihapus.';
    end if;

    return old;
  end if;

  if old.status = 'posted' then
    if new.tenant_id is distinct from old.tenant_id
       or new.unit_id is distinct from old.unit_id
       or new.application_id is distinct from old.application_id
       or new.cash_bank_account_id is distinct from old.cash_bank_account_id
       or new.repayment_no is distinct from old.repayment_no
       or new.repayment_date is distinct from old.repayment_date
       or new.principal_amount is distinct from old.principal_amount
       or new.service_amount is distinct from old.service_amount
       or new.admin_amount is distinct from old.admin_amount
       or new.penalty_amount is distinct from old.penalty_amount
       or new.status is distinct from old.status
       or new.journal_entry_id is distinct from old.journal_entry_id
       or new.cash_bank_transaction_id is distinct from old.cash_bank_transaction_id
       or new.posted_at is distinct from old.posted_at
       or new.posted_by is distinct from old.posted_by
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Angsuran pinjaman posted tidak boleh diubah.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;


-- ============================================================================
-- TRIGGERS
-- ============================================================================

drop trigger if exists trg_assert_savings_loan_member_scope
  on public.savings_loan_members;

create trigger trg_assert_savings_loan_member_scope
before insert or update on public.savings_loan_members
for each row
execute function public.assert_savings_loan_member_scope();

drop trigger if exists trg_assert_savings_loan_group_scope
  on public.savings_loan_groups;

create trigger trg_assert_savings_loan_group_scope
before insert or update on public.savings_loan_groups
for each row
execute function public.assert_savings_loan_group_scope();

drop trigger if exists trg_assert_savings_loan_group_member_scope
  on public.savings_loan_group_members;

create trigger trg_assert_savings_loan_group_member_scope
before insert or update on public.savings_loan_group_members
for each row
execute function public.assert_savings_loan_group_member_scope();

drop trigger if exists trg_assert_savings_loan_application_scope
  on public.savings_loan_applications;

create trigger trg_assert_savings_loan_application_scope
before insert or update on public.savings_loan_applications
for each row
execute function public.assert_savings_loan_application_scope();

drop trigger if exists trg_assert_savings_loan_application_group_member_scope
  on public.savings_loan_application_group_members;

create trigger trg_assert_savings_loan_application_group_member_scope
before insert or update on public.savings_loan_application_group_members
for each row
execute function public.assert_savings_loan_application_group_member_scope();

drop trigger if exists trg_savings_loan_public_application_links_updated_at
  on public.savings_loan_public_application_links;

create trigger trg_savings_loan_public_application_links_updated_at
before update on public.savings_loan_public_application_links
for each row
execute function public.set_savings_loan_public_application_links_updated_at();

drop trigger if exists trg_prevent_posted_savings_loan_disbursement_mutation
  on public.savings_loan_disbursements;

create trigger trg_prevent_posted_savings_loan_disbursement_mutation
before update or delete on public.savings_loan_disbursements
for each row
execute function public.prevent_posted_savings_loan_disbursement_mutation();

drop trigger if exists trg_prevent_posted_savings_loan_repayment_mutation
  on public.savings_loan_repayments;

create trigger trg_prevent_posted_savings_loan_repayment_mutation
before update or delete on public.savings_loan_repayments
for each row
execute function public.prevent_posted_savings_loan_repayment_mutation();


-- ============================================================================
-- RPC BATCH 1 - MASTER / FRONT OFFICE
-- ============================================================================

create or replace function public.create_savings_loan_member(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_member_no text,
  p_full_name text,
  p_identity_number text default null,
  p_phone text default null,
  p_address text default null,
  p_join_date date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_member_id uuid;
begin
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
    p_member_no,
    p_full_name,
    p_identity_number,
    p_phone,
    p_address,
    coalesce(p_join_date, current_date),
    p_notes,
    auth.uid(),
    auth.uid()
  )
  returning id into v_member_id;

  return v_member_id;
end;
$function$;

create or replace function public.update_savings_loan_member(
  p_member_id uuid,
  p_member_no text,
  p_full_name text,
  p_identity_number text default null,
  p_phone text default null,
  p_address text default null,
  p_join_date date default null,
  p_status public.savings_loan_member_status default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_member_id uuid;
begin
  update public.savings_loan_members
  set
    member_no = p_member_no,
    full_name = p_full_name,
    identity_number = p_identity_number,
    phone = p_phone,
    address = p_address,
    join_date = coalesce(p_join_date, join_date),
    status = coalesce(p_status, status),
    notes = p_notes,
    updated_by = auth.uid(),
    updated_at = now()
  where id = p_member_id
  returning id into v_member_id;

  if v_member_id is null then
    raise exception 'Anggota simpan pinjam tidak ditemukan.';
  end if;

  return v_member_id;
end;
$function$;

create or replace function public.create_savings_loan_group(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_group_no text,
  p_group_name text,
  p_leader_member_id uuid,
  p_formation_date date default current_date,
  p_address text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_id uuid;
begin
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
    p_leader_member_id,
    coalesce(p_formation_date, current_date),
    p_address,
    p_notes,
    auth.uid(),
    auth.uid()
  )
  returning id into v_group_id;

  return v_group_id;
end;
$function$;

create or replace function public.add_savings_loan_group_member(
  p_group_id uuid,
  p_member_id uuid,
  p_role_in_group public.savings_loan_group_member_role default 'member',
  p_joined_at date default current_date,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_member_id uuid;
  v_tenant_id uuid;
  v_unit_id uuid;
begin
  select
    g.tenant_id,
    g.unit_id
  into
    v_tenant_id,
    v_unit_id
  from public.savings_loan_groups g
  where g.id = p_group_id;

  if v_tenant_id is null then
    raise exception 'Kelompok simpan pinjam tidak ditemukan.';
  end if;

  insert into public.savings_loan_group_members (
    tenant_id,
    unit_id,
    group_id,
    member_id,
    role_in_group,
    joined_at,
    notes,
    created_by,
    updated_by
  )
  values (
    v_tenant_id,
    v_unit_id,
    p_group_id,
    p_member_id,
    coalesce(p_role_in_group, 'member'),
    coalesce(p_joined_at, current_date),
    p_notes,
    auth.uid(),
    auth.uid()
  )
  returning id into v_group_member_id;

  return v_group_member_id;
end;
$function$;

create or replace function public.create_savings_loan_application(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_application_no text,
  p_application_date date,
  p_application_method public.savings_loan_application_method,
  p_member_id uuid,
  p_group_id uuid,
  p_requested_amount numeric,
  p_tenor_months integer,
  p_loan_purpose text,
  p_income_source text,
  p_estimated_repayment_capacity numeric,
  p_business_or_job_type text,
  p_notes text,
  p_supporting_document_url text,
  p_supporting_document_name text,
  p_supporting_document_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_application_id uuid;
begin
  insert into public.savings_loan_applications (
    tenant_id,
    unit_id,
    application_no,
    application_date,
    application_method,
    member_id,
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
    created_by,
    updated_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_application_no,
    coalesce(p_application_date, current_date),
    p_application_method,
    p_member_id,
    p_group_id,
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
    auth.uid(),
    auth.uid()
  )
  returning id into v_application_id;

  return v_application_id;
end;
$function$;

create or replace function public.add_savings_loan_application_group_member(
  p_application_id uuid,
  p_member_id uuid,
  p_requested_amount_share numeric default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_detail_id uuid;
  v_tenant_id uuid;
  v_unit_id uuid;
  v_group_id uuid;
  v_role_in_group public.savings_loan_group_member_role;
begin
  select
    a.tenant_id,
    a.unit_id,
    a.group_id
  into
    v_tenant_id,
    v_unit_id,
    v_group_id
  from public.savings_loan_applications a
  where a.id = p_application_id;

  if v_tenant_id is null then
    raise exception 'Pengajuan pinjaman tidak ditemukan.';
  end if;

  select
    gm.role_in_group
  into
    v_role_in_group
  from public.savings_loan_group_members gm
  where gm.group_id = v_group_id
    and gm.member_id = p_member_id
    and gm.is_active = true;

  if v_role_in_group is null then
    raise exception 'Anggota tidak terdaftar aktif pada kelompok pengajuan.';
  end if;

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
  values (
    v_tenant_id,
    v_unit_id,
    p_application_id,
    v_group_id,
    p_member_id,
    v_role_in_group,
    p_requested_amount_share,
    p_notes,
    auth.uid(),
    auth.uid()
  )
  returning id into v_detail_id;

  return v_detail_id;
end;
$function$;


-- ============================================================================
-- RPC BATCH 2A - PUBLIC APPLICATION LINK / FORM LOADER
-- ============================================================================

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

  v_public_token := encode(gen_random_bytes(24), 'hex');

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

create or replace function public.get_savings_loan_public_application_form(
  p_public_slug text,
  p_public_token text
)
returns table (
  public_link_id uuid,
  tenant_id uuid,
  unit_id uuid,
  tenant_name text,
  unit_name text,
  title text,
  description text,
  allow_individual boolean,
  allow_group boolean,
  require_pdf boolean,
  max_requested_amount numeric,
  min_tenor_months integer,
  max_tenor_months integer
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    l.id,
    l.tenant_id,
    l.unit_id,
    t.nama_bumdes,
    bu.nama_unit,
    l.title,
    l.description,
    l.allow_individual,
    l.allow_group,
    l.require_pdf,
    l.max_requested_amount,
    l.min_tenor_months,
    l.max_tenor_months
  from public.savings_loan_public_application_links l
  join public.tenants t
    on t.id = l.tenant_id
  join public.business_units bu
    on bu.id = l.unit_id
  where l.public_slug = lower(trim(p_public_slug))
    and l.public_token = p_public_token
    and l.is_active = true
    and t.status = 'active'
    and bu.status = 'aktif';
end;
$function$;


-- ============================================================================
-- RPC BATCH 2B - APPLICANT-FIRST INDIVIDUAL INTAKE
-- ============================================================================

create or replace function public.create_savings_loan_applicant_intake_individual(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_application_no text,
  p_application_date date,
  p_applicant_full_name text,
  p_applicant_identity_number text,
  p_applicant_phone text,
  p_applicant_address text,
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
  p_input_mode public.savings_loan_application_input_mode default 'self_service',
  p_assisted_by uuid default null,
  p_assisted_reason text default null,
  p_assisted_statement_text text default null
)
returns table (
  application_id uuid,
  member_id uuid,
  application_no text,
  input_mode public.savings_loan_application_input_mode,
  verification_status public.savings_loan_application_verification_status,
  intake_audit_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_member_id uuid;
  v_application_id uuid;
  v_member_no text;
  v_declaration_accepted_at timestamptz;
begin
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

  select m.id
  into v_member_id
  from public.savings_loan_members m
  where m.tenant_id = p_tenant_id
    and m.unit_id = p_unit_id
    and (
      (
        nullif(trim(coalesce(p_applicant_identity_number, '')), '') is not null
        and m.identity_number = nullif(trim(coalesce(p_applicant_identity_number, '')), '')
      )
      or
      (
        nullif(trim(coalesce(p_applicant_phone, '')), '') is not null
        and m.phone = nullif(trim(coalesce(p_applicant_phone, '')), '')
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
      p_applicant_full_name,
      p_applicant_identity_number,
      p_applicant_phone,
      p_applicant_address,
      current_date,
      'Auto-created from applicant intake',
      auth.uid(),
      auth.uid()
    )
    returning id into v_member_id;
  else
    update public.savings_loan_members
    set
      full_name = coalesce(nullif(trim(p_applicant_full_name), ''), full_name),
      identity_number = coalesce(nullif(trim(coalesce(p_applicant_identity_number, '')), ''), identity_number),
      phone = coalesce(nullif(trim(coalesce(p_applicant_phone, '')), ''), phone),
      address = coalesce(nullif(trim(coalesce(p_applicant_address, '')), ''), address),
      updated_by = auth.uid(),
      updated_at = now()
    where id = v_member_id;
  end if;

  insert into public.savings_loan_applications (
    tenant_id,
    unit_id,
    application_no,
    application_date,
    application_method,
    member_id,
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
    applicant_identity_number,
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
    'individual',
    v_member_id,
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
    p_applicant_full_name,
    p_applicant_identity_number,
    p_applicant_phone,
    p_applicant_address,
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

  insert into public.savings_loan_application_declarations (
    tenant_id,
    unit_id,
    application_id,
    input_mode,
    verification_status,
    applicant_full_name,
    applicant_identity_number,
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
    p_applicant_full_name,
    p_applicant_identity_number,
    p_applicant_phone,
    p_applicant_address,
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
  member_id := v_member_id;
  application_no := upper(trim(p_application_no));
  input_mode := p_input_mode;
  verification_status := 'pending_verification';
  intake_audit_status := 'PASS';

  return next;
end;
$function$;


-- ============================================================================
-- RPC BATCH 2C - APPLICANT-FIRST GROUP INTAKE
-- ============================================================================

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
    on conflict (group_id, member_id)
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


-- ============================================================================
-- RPC BATCH 2D - PUBLIC SUBMISSION WRAPPER
-- ============================================================================

create or replace function public.submit_public_savings_loan_application(
  p_public_slug text,
  p_public_token text,
  p_application_method public.savings_loan_application_method,
  p_applicant_payload jsonb,
  p_public_user_agent text default null,
  p_public_referrer text default null
)
returns table (
  application_id uuid,
  public_link_id uuid,
  tenant_id uuid,
  unit_id uuid,
  application_no text,
  application_method public.savings_loan_application_method,
  intake_audit_status text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_link record;
  v_application_no text;
  v_result record;
begin
  select
    l.id,
    l.tenant_id,
    l.unit_id,
    l.public_slug,
    l.public_token,
    l.allow_individual,
    l.allow_group,
    l.require_pdf,
    l.max_requested_amount,
    l.min_tenor_months,
    l.max_tenor_months
  into v_link
  from public.savings_loan_public_application_links l
  join public.tenants t
    on t.id = l.tenant_id
  join public.business_units bu
    on bu.id = l.unit_id
  where l.public_slug = lower(trim(p_public_slug))
    and l.public_token = p_public_token
    and l.is_active = true
    and t.status = 'active'
    and bu.status = 'aktif';

  if v_link.id is null then
    raise exception 'Link pengajuan pinjaman publik tidak valid atau tidak aktif.';
  end if;

  if p_application_method = 'individual'::public.savings_loan_application_method
     and coalesce(v_link.allow_individual, false) is not true then
    raise exception 'Pengajuan perorangan tidak diaktifkan untuk link ini.';
  end if;

  if p_application_method = 'group'::public.savings_loan_application_method
     and coalesce(v_link.allow_group, false) is not true then
    raise exception 'Pengajuan kelompok tidak diaktifkan untuk link ini.';
  end if;

  if v_link.require_pdf is true then
    if nullif(trim(coalesce(p_applicant_payload ->> 'supporting_document_url', '')), '') is null
       or nullif(trim(coalesce(p_applicant_payload ->> 'supporting_document_name', '')), '') is null
       or lower(trim(coalesce(p_applicant_payload ->> 'supporting_document_mime_type', ''))) <> 'application/pdf'
       or lower(trim(coalesce(p_applicant_payload ->> 'supporting_document_name', ''))) not like '%.pdf' then
      raise exception 'Dokumen pendukung PDF wajib diunggah.';
    end if;
  end if;

  if v_link.max_requested_amount is not null
     and (p_applicant_payload ->> 'requested_amount')::numeric > v_link.max_requested_amount then
    raise exception 'Nominal pengajuan melebihi batas maksimum link publik.';
  end if;

  if v_link.min_tenor_months is not null
     and (p_applicant_payload ->> 'tenor_months')::integer < v_link.min_tenor_months then
    raise exception 'Tenor pengajuan kurang dari batas minimum link publik.';
  end if;

  if v_link.max_tenor_months is not null
     and (p_applicant_payload ->> 'tenor_months')::integer > v_link.max_tenor_months then
    raise exception 'Tenor pengajuan melebihi batas maksimum link publik.';
  end if;

  if p_application_method = 'individual'::public.savings_loan_application_method then
    v_application_no := 'PUB-IND-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

    select *
    into v_result
    from public.create_savings_loan_applicant_intake_individual(
      v_link.tenant_id,
      v_link.unit_id,
      v_application_no,
      current_date,
      p_applicant_payload ->> 'applicant_full_name',
      p_applicant_payload ->> 'applicant_identity_number',
      p_applicant_payload ->> 'applicant_phone',
      p_applicant_payload ->> 'applicant_address',
      (p_applicant_payload ->> 'requested_amount')::numeric,
      (p_applicant_payload ->> 'tenor_months')::integer,
      p_applicant_payload ->> 'loan_purpose',
      p_applicant_payload ->> 'income_source',
      (p_applicant_payload ->> 'estimated_repayment_capacity')::numeric,
      p_applicant_payload ->> 'business_or_job_type',
      p_applicant_payload ->> 'notes',
      p_applicant_payload ->> 'supporting_document_url',
      p_applicant_payload ->> 'supporting_document_name',
      p_applicant_payload ->> 'supporting_document_mime_type',
      p_applicant_payload ->> 'declaration_text',
      coalesce((p_applicant_payload ->> 'declaration_accepted')::boolean, false),
      'self_service',
      null,
      null,
      null
    );
  else
    v_application_no := 'PUB-GRP-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

    select *
    into v_result
    from public.create_savings_loan_applicant_intake_group(
      v_link.tenant_id,
      v_link.unit_id,
      v_application_no,
      current_date,
      p_applicant_payload ->> 'group_no',
      p_applicant_payload ->> 'group_name',
      p_applicant_payload ->> 'group_address',
      (p_applicant_payload ->> 'requested_amount')::numeric,
      (p_applicant_payload ->> 'tenor_months')::integer,
      p_applicant_payload ->> 'loan_purpose',
      p_applicant_payload ->> 'income_source',
      (p_applicant_payload ->> 'estimated_repayment_capacity')::numeric,
      p_applicant_payload ->> 'business_or_job_type',
      p_applicant_payload ->> 'notes',
      p_applicant_payload ->> 'supporting_document_url',
      p_applicant_payload ->> 'supporting_document_name',
      p_applicant_payload ->> 'supporting_document_mime_type',
      p_applicant_payload ->> 'declaration_text',
      coalesce((p_applicant_payload ->> 'declaration_accepted')::boolean, false),
      coalesce(p_applicant_payload -> 'members', '[]'::jsonb),
      'self_service',
      null,
      null,
      null
    );
  end if;

  insert into public.savings_loan_public_application_submissions (
    public_link_id,
    tenant_id,
    unit_id,
    application_id,
    application_method,
    public_slug,
    submitted_user_agent,
    submitted_referrer
  )
  values (
    v_link.id,
    v_link.tenant_id,
    v_link.unit_id,
    v_result.application_id,
    p_application_method,
    v_link.public_slug,
    p_public_user_agent,
    p_public_referrer
  );

  application_id := v_result.application_id;
  public_link_id := v_link.id;
  tenant_id := v_link.tenant_id;
  unit_id := v_link.unit_id;
  application_no := v_application_no;
  application_method := p_application_method;
  intake_audit_status := 'PASS';

  return next;
end;
$function$;


-- ============================================================================
-- RPC BATCH 3 - APPLICATION VERIFICATION GOVERNANCE
-- ============================================================================

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
  where application_id = p_application_id;

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
  where application_id = p_application_id;

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
  where application_id = p_application_id;

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


-- ============================================================================
-- RPC BATCH 4A - LOAN DISBURSEMENT POSTING
-- ============================================================================

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

  v_cash_account_id := coalesce(v_cash_bank.account_id, v_cash_bank.account_code);

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


-- ============================================================================
-- RPC BATCH 4B - LOAN REPAYMENT POSTING
-- ============================================================================

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

  v_cash_account_id := coalesce(v_cash_bank.account_id, v_cash_bank.account_code);

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


-- ============================================================================
-- RPC BATCH 5A - REPAYMENT SCHEDULE GENERATION
-- ============================================================================

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
  where application_id = p_application_id;

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


-- ============================================================================
-- RPC BATCH 5B - REPAYMENT SCHEDULE PAYMENT SYNC
-- ============================================================================

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
  where application_id = p_application_id;

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


-- ============================================================================
-- VIEWS BATCH 1 - MASTER / FRONT OFFICE
-- ============================================================================

create or replace view public.v_savings_loan_members as
select
  m.id,
  m.tenant_id,
  t.nama_bumdes as tenant_name,
  m.unit_id,
  bu.nama_unit as unit_name,
  m.member_no,
  m.full_name,
  m.identity_number,
  m.phone,
  m.address,
  m.join_date,
  m.status,
  case m.status
    when 'active' then 'Aktif'
    when 'inactive' then 'Tidak Aktif'
    when 'suspended' then 'Ditangguhkan'
    when 'closed' then 'Ditutup'
    else m.status::text
  end as status_label,
  m.notes,
  m.created_by,
  m.updated_by,
  m.created_at,
  m.updated_at
from public.savings_loan_members m
join public.tenants t
  on t.id = m.tenant_id
join public.business_units bu
  on bu.id = m.unit_id;

create or replace view public.v_savings_loan_groups as
select
  g.id,
  g.tenant_id,
  t.nama_bumdes as tenant_name,
  g.unit_id,
  bu.nama_unit as unit_name,
  g.group_no,
  g.group_name,
  g.leader_member_id,
  leader.full_name as leader_name,
  leader.member_no as leader_member_no,
  g.formation_date,
  g.status,
  case g.status
    when 'active' then 'Aktif'
    when 'inactive' then 'Tidak Aktif'
    when 'suspended' then 'Ditangguhkan'
    when 'closed' then 'Ditutup'
    else g.status::text
  end as status_label,
  g.address,
  g.notes,
  count(gm.id) filter (where gm.is_active = true) as active_members_count,
  g.created_by,
  g.updated_by,
  g.created_at,
  g.updated_at
from public.savings_loan_groups g
join public.tenants t
  on t.id = g.tenant_id
join public.business_units bu
  on bu.id = g.unit_id
join public.savings_loan_members leader
  on leader.id = g.leader_member_id
left join public.savings_loan_group_members gm
  on gm.group_id = g.id
group by
  g.id,
  t.nama_bumdes,
  bu.nama_unit,
  leader.full_name,
  leader.member_no;

create or replace view public.v_savings_loan_group_members as
select
  gm.id,
  gm.tenant_id,
  t.nama_bumdes as tenant_name,
  gm.unit_id,
  bu.nama_unit as unit_name,
  gm.group_id,
  g.group_no,
  g.group_name,
  gm.member_id,
  m.member_no,
  m.full_name as member_name,
  m.identity_number,
  m.phone,
  gm.role_in_group,
  case gm.role_in_group
    when 'leader' then 'Ketua'
    when 'secretary' then 'Sekretaris'
    when 'treasurer' then 'Bendahara'
    when 'member' then 'Anggota'
    else gm.role_in_group::text
  end as role_label,
  gm.joined_at,
  gm.left_at,
  gm.is_active,
  case
    when gm.is_active then 'Aktif'
    else 'Tidak Aktif'
  end as membership_status_label,
  gm.notes,
  gm.created_by,
  gm.updated_by,
  gm.created_at,
  gm.updated_at
from public.savings_loan_group_members gm
join public.tenants t
  on t.id = gm.tenant_id
join public.business_units bu
  on bu.id = gm.unit_id
join public.savings_loan_groups g
  on g.id = gm.group_id
join public.savings_loan_members m
  on m.id = gm.member_id;

create or replace view public.v_savings_loan_applications as
select
  a.id,
  a.tenant_id,
  t.nama_bumdes as tenant_name,
  a.unit_id,
  bu.nama_unit as unit_name,
  a.application_no,
  a.application_date,
  a.application_method,
  case a.application_method
    when 'individual' then 'Perorangan'
    when 'group' then 'Kelompok'
    else a.application_method::text
  end as application_method_label,
  a.member_id,
  m.member_no,
  m.full_name as member_name,
  a.group_id,
  g.group_no,
  g.group_name,
  a.requested_amount,
  a.tenor_months,
  a.loan_purpose,
  a.income_source,
  a.estimated_repayment_capacity,
  a.business_or_job_type,
  a.notes,
  a.supporting_document_url,
  a.supporting_document_name,
  a.supporting_document_mime_type,
  a.status,
  case a.status
    when 'draft' then 'Draft'
    when 'submitted' then 'Diajukan'
    when 'under_review' then 'Dalam Review'
    when 'approved' then 'Disetujui'
    when 'rejected' then 'Ditolak'
    when 'cancelled' then 'Dibatalkan'
    when 'disbursed' then 'Sudah Cair'
    when 'partial_paid' then 'Diangsur'
    when 'paid_off' then 'Lunas'
    else a.status::text
  end as status_label,
  a.input_mode,
  case a.input_mode
    when 'self_service' then 'Mandiri'
    when 'assisted_by_officer' then 'Dibantu Petugas'
    else a.input_mode::text
  end as input_mode_label,
  a.verification_status,
  case a.verification_status
    when 'pending_verification' then 'Menunggu Verifikasi'
    when 'verified' then 'Terverifikasi'
    when 'needs_correction' then 'Perlu Perbaikan'
    when 'rejected' then 'Ditolak'
    else a.verification_status::text
  end as verification_status_label,
  a.applicant_full_name,
  a.applicant_identity_number,
  a.applicant_phone,
  a.applicant_address,
  a.applicant_confirmed_at,
  a.applicant_declaration_accepted,
  a.assisted_by,
  a.assisted_reason,
  a.assisted_statement_required,
  a.assisted_statement_generated_at,
  a.assisted_statement_url,
  a.assisted_statement_name,
  a.assisted_statement_mime_type,
  a.submitted_at,
  a.reviewed_at,
  a.reviewed_by,
  reviewer.full_name as reviewed_by_name,
  a.approved_at,
  a.approved_by,
  approver.full_name as approved_by_name,
  a.rejected_at,
  a.rejected_by,
  rejector.full_name as rejected_by_name,
  a.rejection_reason,
  a.cancelled_at,
  a.cancelled_by,
  a.disbursed_at,
  count(agm.id) filter (where a.application_method = 'group') as group_application_members_count,
  coalesce(sum(agm.requested_amount_share), 0) as group_requested_amount_total,
  a.created_by,
  a.updated_by,
  a.created_at,
  a.updated_at
from public.savings_loan_applications a
join public.tenants t
  on t.id = a.tenant_id
join public.business_units bu
  on bu.id = a.unit_id
left join public.savings_loan_members m
  on m.id = a.member_id
left join public.savings_loan_groups g
  on g.id = a.group_id
left join public.savings_loan_application_group_members agm
  on agm.application_id = a.id
left join public.profiles reviewer
  on reviewer.id = a.reviewed_by
left join public.profiles approver
  on approver.id = a.approved_by
left join public.profiles rejector
  on rejector.id = a.rejected_by
group by
  a.id,
  t.nama_bumdes,
  bu.nama_unit,
  m.member_no,
  m.full_name,
  g.group_no,
  g.group_name,
  reviewer.full_name,
  approver.full_name,
  rejector.full_name;

create or replace view public.v_savings_loan_application_group_members as
select
  agm.id,
  agm.tenant_id,
  t.nama_bumdes as tenant_name,
  agm.unit_id,
  bu.nama_unit as unit_name,
  agm.application_id,
  a.application_no,
  agm.group_id,
  g.group_no,
  g.group_name,
  agm.member_id,
  m.member_no,
  m.full_name as member_name,
  m.identity_number,
  m.phone,
  agm.role_in_group,
  case agm.role_in_group
    when 'leader' then 'Ketua'
    when 'secretary' then 'Sekretaris'
    when 'treasurer' then 'Bendahara'
    when 'member' then 'Anggota'
    else agm.role_in_group::text
  end as role_label,
  agm.requested_amount_share,
  agm.notes,
  agm.created_by,
  agm.updated_by,
  agm.created_at,
  agm.updated_at
from public.savings_loan_application_group_members agm
join public.tenants t
  on t.id = agm.tenant_id
join public.business_units bu
  on bu.id = agm.unit_id
join public.savings_loan_applications a
  on a.id = agm.application_id
join public.savings_loan_groups g
  on g.id = agm.group_id
join public.savings_loan_members m
  on m.id = agm.member_id;


-- ============================================================================
-- VIEWS BATCH 2 - APPLICANT INTAKE AND DISBURSEMENT FLOW
-- ============================================================================

create or replace view public.v_savings_loan_applicant_intake_applications as
select
  a.id,
  a.tenant_id,
  t.nama_bumdes as tenant_name,
  a.unit_id,
  bu.nama_unit as unit_name,
  a.application_no,
  a.application_date,
  a.application_method,
  case a.application_method
    when 'individual' then 'Perorangan'
    when 'group' then 'Kelompok'
    else a.application_method::text
  end as application_method_label,
  a.member_id,
  m.member_no,
  m.full_name as member_name,
  a.group_id,
  g.group_no,
  g.group_name,
  a.requested_amount,
  a.tenor_months,
  a.loan_purpose,
  a.income_source,
  a.estimated_repayment_capacity,
  a.business_or_job_type,
  a.notes,
  a.supporting_document_url,
  a.supporting_document_name,
  a.supporting_document_mime_type,
  a.status,
  case a.status
    when 'draft' then 'Draft'
    when 'submitted' then 'Diajukan'
    when 'under_review' then 'Dalam Review'
    when 'approved' then 'Disetujui'
    when 'rejected' then 'Ditolak'
    when 'cancelled' then 'Dibatalkan'
    when 'disbursed' then 'Sudah Cair'
    when 'partial_paid' then 'Diangsur'
    when 'paid_off' then 'Lunas'
    else a.status::text
  end as status_label,
  a.input_mode,
  case a.input_mode
    when 'self_service' then 'Mandiri'
    when 'assisted_by_officer' then 'Dibantu Petugas'
    else a.input_mode::text
  end as input_mode_label,
  a.verification_status,
  case a.verification_status
    when 'pending_verification' then 'Menunggu Verifikasi'
    when 'verified' then 'Terverifikasi'
    when 'needs_correction' then 'Perlu Perbaikan'
    when 'rejected' then 'Ditolak'
    else a.verification_status::text
  end as verification_status_label,
  a.applicant_full_name,
  a.applicant_identity_number,
  a.applicant_phone,
  a.applicant_address,
  d.declaration_text,
  d.declaration_accepted,
  d.declaration_accepted_at,
  d.assisted_by,
  assisted.full_name as assisted_by_name,
  d.assisted_reason,
  d.assisted_statement_text,
  a.reviewed_at,
  a.reviewed_by,
  reviewer.full_name as reviewed_by_name,
  a.approved_at,
  a.approved_by,
  approver.full_name as approved_by_name,
  a.rejected_at,
  a.rejected_by,
  rejector.full_name as rejected_by_name,
  a.rejection_reason,
  count(agm.id) filter (where a.application_method = 'group') as group_members_count,
  coalesce(sum(agm.requested_amount_share), 0) as group_requested_amount_total,
  case
    when a.application_method = 'group'
      and coalesce(sum(agm.requested_amount_share), 0) = a.requested_amount
    then 'PASS'
    when a.application_method = 'individual'
      and a.member_id is not null
    then 'PASS'
    else 'NEEDS_REVIEW'
  end as intake_audit_status,
  case
    when a.status in ('draft', 'submitted', 'under_review')
      and a.verification_status in ('pending_verification', 'needs_correction')
    then true
    else false
  end as can_verify,
  case
    when a.status in ('draft', 'submitted', 'under_review')
      and a.verification_status in ('pending_verification', 'needs_correction')
    then true
    else false
  end as can_request_correction,
  case
    when a.status in ('draft', 'submitted', 'under_review')
      and a.verification_status in ('pending_verification', 'needs_correction')
    then true
    else false
  end as can_reject,
  a.created_by,
  a.updated_by,
  a.created_at,
  a.updated_at
from public.savings_loan_applications a
join public.tenants t
  on t.id = a.tenant_id
join public.business_units bu
  on bu.id = a.unit_id
left join public.savings_loan_members m
  on m.id = a.member_id
left join public.savings_loan_groups g
  on g.id = a.group_id
left join public.savings_loan_application_declarations d
  on d.application_id = a.id
left join public.savings_loan_application_group_members agm
  on agm.application_id = a.id
left join public.profiles assisted
  on assisted.id = d.assisted_by
left join public.profiles reviewer
  on reviewer.id = a.reviewed_by
left join public.profiles approver
  on approver.id = a.approved_by
left join public.profiles rejector
  on rejector.id = a.rejected_by
group by
  a.id,
  t.nama_bumdes,
  bu.nama_unit,
  m.member_no,
  m.full_name,
  g.group_no,
  g.group_name,
  d.id,
  assisted.full_name,
  reviewer.full_name,
  approver.full_name,
  rejector.full_name;

create or replace view public.v_savings_loan_disbursement_flow as
select
  a.id as application_id,
  a.tenant_id,
  t.nama_bumdes as tenant_name,
  a.unit_id,
  bu.nama_unit as unit_name,
  a.application_no,
  a.application_date,
  a.application_method,
  case a.application_method
    when 'individual' then 'Perorangan'
    when 'group' then 'Kelompok'
    else a.application_method::text
  end as application_method_label,
  a.member_id,
  m.member_no,
  m.full_name as member_name,
  a.group_id,
  g.group_no,
  g.group_name,
  a.requested_amount,
  a.tenor_months,
  a.status as application_status,
  a.verification_status,
  case
    when a.status = 'approved'
      and a.verification_status = 'verified'
      and d.id is null
    then true
    else false
  end as can_disburse,
  d.id as disbursement_id,
  d.disbursement_no,
  d.disbursement_date,
  d.cash_bank_account_id,
  cba.account_name as cash_bank_account_name,
  d.principal_amount,
  d.status as disbursement_status,
  d.journal_entry_id,
  je.journal_no as journal_entry_no,
  d.cash_bank_transaction_id,
  cb.transaction_no as cash_bank_transaction_no,
  d.posted_at,
  d.posted_by,
  poster.full_name as posted_by_name,
  coalesce(journal_line_audit.is_balanced, false) as journal_is_balanced,
  coalesce(journal_line_audit.total_debit, 0) as journal_total_debit,
  coalesce(journal_line_audit.total_credit, 0) as journal_total_credit,
  case
    when a.status in ('draft', 'submitted', 'under_review')
      or a.verification_status <> 'verified'
    then 'NOT_READY'
    when a.status = 'approved'
      and a.verification_status = 'verified'
      and d.id is null
    then 'READY_FOR_DISBURSEMENT'
    when d.id is not null
      and d.status = 'posted'
      and d.journal_entry_id is not null
      and d.cash_bank_transaction_id is not null
      and coalesce(journal_line_audit.is_balanced, false)
    then 'PASS'
    else 'CHECK_DISBURSEMENT_FLOW'
  end as disbursement_audit_status,
  d.created_by,
  d.created_at,
  d.updated_at
from public.savings_loan_applications a
join public.tenants t
  on t.id = a.tenant_id
join public.business_units bu
  on bu.id = a.unit_id
left join public.savings_loan_members m
  on m.id = a.member_id
left join public.savings_loan_groups g
  on g.id = a.group_id
left join public.savings_loan_disbursements d
  on d.application_id = a.id
left join public.cash_bank_accounts cba
  on cba.id = d.cash_bank_account_id
left join public.journal_entries je
  on je.id = d.journal_entry_id
left join public.cash_bank_transactions cb
  on cb.id = d.cash_bank_transaction_id
left join public.profiles poster
  on poster.id = d.posted_by
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit,
    coalesce(sum(jl.debit), 0) = coalesce(sum(jl.credit), 0) as is_balanced
  from public.journal_lines jl
  where jl.journal_entry_id = d.journal_entry_id
) journal_line_audit on true;


-- ============================================================================
-- VIEWS BATCH 3 - REPAYMENT AND SCHEDULE FLOW
-- ============================================================================

create or replace view public.v_savings_loan_repayment_flow as
select
  a.id as application_id,
  a.tenant_id,
  t.nama_bumdes as tenant_name,
  a.unit_id,
  bu.nama_unit as unit_name,
  a.application_no,
  a.application_date,
  a.application_method,
  case a.application_method
    when 'individual' then 'Perorangan'
    when 'group' then 'Kelompok'
    else a.application_method::text
  end as application_method_label,
  a.member_id,
  m.member_no,
  m.full_name as member_name,
  a.group_id,
  g.group_no,
  g.group_name,
  a.requested_amount,
  a.tenor_months,
  a.status as application_status,
  a.verification_status,
  d.id as disbursement_id,
  d.disbursement_no,
  d.disbursement_date,
  d.principal_amount as disbursed_principal_amount,
  coalesce(repayment_summary.total_principal_paid, 0) as total_principal_paid,
  coalesce(repayment_summary.total_service_income, 0) as total_service_income,
  coalesce(repayment_summary.total_admin_income, 0) as total_admin_income,
  coalesce(repayment_summary.total_penalty_income, 0) as total_penalty_income,
  coalesce(repayment_summary.total_cash_received, 0) as total_cash_received,
  coalesce(d.principal_amount, 0) - coalesce(repayment_summary.total_principal_paid, 0) as outstanding_principal,
  coalesce(repayment_summary.repayment_count, 0) as repayment_count,
  coalesce(repayment_summary.latest_repayment_date, null) as latest_repayment_date,
  coalesce(repayment_summary.journal_count, 0) as repayment_journal_count,
  coalesce(repayment_summary.cash_bank_transaction_count, 0) as repayment_cash_bank_transaction_count,
  coalesce(audit_summary.audit_timeline_count, 0) as audit_timeline_count,
  case
    when d.id is null then 'NOT_DISBURSED'
    when coalesce(repayment_summary.repayment_count, 0) = 0 then 'READY_FOR_REPAYMENT'
    when coalesce(d.principal_amount, 0) - coalesce(repayment_summary.total_principal_paid, 0) <= 0 then 'PAID_OFF_PASS'
    when coalesce(repayment_summary.total_principal_paid, 0) > 0 then 'PARTIAL_PAID_PASS'
    else 'CHECK_REPAYMENT_FLOW'
  end as repayment_flow_status,
  case
    when d.id is null then 'NO_DISBURSEMENT'
    when coalesce(repayment_summary.repayment_count, 0) = 0 then 'NO_REPAYMENT_YET'
    when coalesce(repayment_summary.repayment_count, 0) = coalesce(repayment_summary.journal_count, 0)
      and coalesce(repayment_summary.repayment_count, 0) = coalesce(repayment_summary.cash_bank_transaction_count, 0)
      and coalesce(repayment_summary.unbalanced_journal_count, 0) = 0
    then 'PASS'
    else 'FAIL'
  end as audit_result
from public.savings_loan_applications a
join public.tenants t
  on t.id = a.tenant_id
join public.business_units bu
  on bu.id = a.unit_id
left join public.savings_loan_members m
  on m.id = a.member_id
left join public.savings_loan_groups g
  on g.id = a.group_id
left join public.savings_loan_disbursements d
  on d.application_id = a.id
  and d.status = 'posted'
left join lateral (
  select
    count(r.id)::integer as repayment_count,
    max(r.repayment_date) as latest_repayment_date,
    coalesce(sum(r.principal_amount), 0) as total_principal_paid,
    coalesce(sum(r.service_amount), 0) as total_service_income,
    coalesce(sum(r.admin_amount), 0) as total_admin_income,
    coalesce(sum(r.penalty_amount), 0) as total_penalty_income,
    coalesce(sum(r.total_amount), 0) as total_cash_received,
    count(r.journal_entry_id)::integer as journal_count,
    count(r.cash_bank_transaction_id)::integer as cash_bank_transaction_count,
    count(*) filter (
      where r.journal_entry_id is not null
        and coalesce(journal_audit.total_debit, 0) <> coalesce(journal_audit.total_credit, 0)
    )::integer as unbalanced_journal_count
  from public.savings_loan_repayments r
  left join lateral (
    select
      coalesce(sum(jl.debit), 0) as total_debit,
      coalesce(sum(jl.credit), 0) as total_credit
    from public.journal_lines jl
    where jl.journal_entry_id = r.journal_entry_id
  ) journal_audit on true
  where r.application_id = a.id
    and r.status = 'posted'
) repayment_summary on true
left join lateral (
  select count(at.id)::integer as audit_timeline_count
  from public.audit_timeline at
  where at.entity_type in ('savings_loan_repayments', 'savings_loan_disbursements')
    and (
      at.metadata ->> 'application_id' = a.id::text
      or at.source_id = d.id
    )
) audit_summary on true;

create or replace view public.v_savings_loan_repayment_schedule_flow as
select
  s.id as schedule_id,
  s.tenant_id,
  t.nama_bumdes as tenant_name,
  s.unit_id,
  bu.nama_unit as unit_name,
  s.application_id,
  a.application_no,
  a.application_date,
  a.application_method,
  case a.application_method
    when 'individual' then 'Perorangan'
    when 'group' then 'Kelompok'
    else a.application_method::text
  end as application_method_label,
  a.member_id,
  m.member_no,
  m.full_name as member_name,
  a.group_id,
  g.group_no,
  g.group_name,
  s.product_id,
  p.product_code,
  p.product_name,
  p.interest_method,
  p.service_rate,
  p.admin_fee_amount,
  p.penalty_rate,
  s.installment_no,
  s.due_date,
  s.principal_amount,
  s.service_amount,
  s.admin_amount,
  s.penalty_amount,
  s.total_amount,
  s.paid_principal_amount,
  s.paid_service_amount,
  s.paid_admin_amount,
  s.paid_penalty_amount,
  (
    s.paid_principal_amount
    + s.paid_service_amount
    + s.paid_admin_amount
    + s.paid_penalty_amount
  ) as paid_total_amount,
  greatest(
    s.total_amount
    - (
      s.paid_principal_amount
      + s.paid_service_amount
      + s.paid_admin_amount
      + s.paid_penalty_amount
    ),
    0
  ) as remaining_total_amount,
  s.repayment_id,
  r.repayment_no,
  r.repayment_date,
  s.status,
  case s.status
    when 'scheduled' then 'Terjadwal'
    when 'partially_paid' then 'Dibayar Sebagian'
    when 'paid' then 'Lunas'
    when 'overdue' then 'Lewat Jatuh Tempo'
    when 'cancelled' then 'Dibatalkan'
    else s.status::text
  end as status_label,
  case
    when s.status = 'paid' then false
    when s.due_date < current_date then true
    else false
  end as is_overdue,
  case
    when s.status = 'paid'
      and s.total_amount = (
        s.paid_principal_amount
        + s.paid_service_amount
        + s.paid_admin_amount
        + s.paid_penalty_amount
      )
    then 'PASS_PAID'
    when s.status = 'partially_paid'
      and (
        s.paid_principal_amount
        + s.paid_service_amount
        + s.paid_admin_amount
        + s.paid_penalty_amount
      ) > 0
      and (
        s.paid_principal_amount
        + s.paid_service_amount
        + s.paid_admin_amount
        + s.paid_penalty_amount
      ) < s.total_amount
    then 'PASS_PARTIAL'
    when s.status = 'scheduled'
      and (
        s.paid_principal_amount
        + s.paid_service_amount
        + s.paid_admin_amount
        + s.paid_penalty_amount
      ) = 0
    then 'PASS_SCHEDULED'
    else 'CHECK_SCHEDULE_ROW'
  end as schedule_row_audit,
  s.notes,
  s.created_by,
  s.created_at,
  s.updated_at
from public.savings_loan_repayment_schedules s
join public.tenants t
  on t.id = s.tenant_id
join public.business_units bu
  on bu.id = s.unit_id
join public.savings_loan_applications a
  on a.id = s.application_id
join public.savings_loan_products p
  on p.id = s.product_id
left join public.savings_loan_members m
  on m.id = a.member_id
left join public.savings_loan_groups g
  on g.id = a.group_id
left join public.savings_loan_repayments r
  on r.id = s.repayment_id;


-- ============================================================================
-- RLS, POLICIES, GRANTS, PERMISSIONS
-- ============================================================================

alter table public.savings_loan_members enable row level security;
alter table public.savings_loan_groups enable row level security;
alter table public.savings_loan_group_members enable row level security;
alter table public.savings_loan_applications enable row level security;
alter table public.savings_loan_application_group_members enable row level security;
alter table public.savings_loan_application_declarations enable row level security;
alter table public.savings_loan_public_application_links enable row level security;
alter table public.savings_loan_public_application_submissions enable row level security;
alter table public.savings_loan_products enable row level security;
alter table public.savings_loan_disbursements enable row level security;
alter table public.savings_loan_repayments enable row level security;
alter table public.savings_loan_repayment_schedules enable row level security;

drop policy if exists savings_loan_products_authenticated_select
  on public.savings_loan_products;

create policy savings_loan_products_authenticated_select
on public.savings_loan_products
for select
to authenticated
using (
  public.has_permission('savings_loan.application.view', auth.uid(), tenant_id, unit_id)
  or public.has_permission('savings_loan.repayment.view', auth.uid(), tenant_id, unit_id)
);

drop policy if exists savings_loan_public_links_authenticated_manage
  on public.savings_loan_public_application_links;

create policy savings_loan_public_links_authenticated_manage
on public.savings_loan_public_application_links
for all
to authenticated
using (
  public.has_permission('savings_loan.application.view', auth.uid(), tenant_id, unit_id)
)
with check (
  public.has_permission('savings_loan.application.verify', auth.uid(), tenant_id, unit_id)
  or public.has_permission('savings_loan.application.view', auth.uid(), tenant_id, unit_id)
);

drop policy if exists savings_loan_public_submissions_authenticated_select
  on public.savings_loan_public_application_submissions;

create policy savings_loan_public_submissions_authenticated_select
on public.savings_loan_public_application_submissions
for select
to authenticated
using (
  public.has_permission('savings_loan.application.view', auth.uid(), tenant_id, unit_id)
);

grant select on public.v_savings_loan_members to authenticated;
grant select on public.v_savings_loan_groups to authenticated;
grant select on public.v_savings_loan_group_members to authenticated;
grant select on public.v_savings_loan_applications to authenticated;
grant select on public.v_savings_loan_application_group_members to authenticated;
grant select on public.v_savings_loan_applicant_intake_applications to authenticated;
grant select on public.v_savings_loan_disbursement_flow to authenticated;
grant select on public.v_savings_loan_repayment_flow to authenticated;
grant select on public.v_savings_loan_repayment_schedule_flow to authenticated;

grant select on public.savings_loan_products to authenticated;
grant select, insert, update, delete on public.savings_loan_public_application_links to authenticated;
grant select on public.savings_loan_public_application_submissions to authenticated;
grant select, insert, update on public.savings_loan_application_declarations to authenticated;
grant select, insert, update on public.savings_loan_disbursements to authenticated;
grant select, insert, update on public.savings_loan_repayments to authenticated;
grant select on public.savings_loan_repayment_schedules to authenticated;

grant execute on function public.create_savings_loan_member(uuid, uuid, text, text, text, text, text, date, text) to authenticated;
grant execute on function public.update_savings_loan_member(uuid, text, text, text, text, text, date, public.savings_loan_member_status, text) to authenticated;
grant execute on function public.create_savings_loan_group(uuid, uuid, text, text, uuid, date, text, text) to authenticated;
grant execute on function public.add_savings_loan_group_member(uuid, uuid, public.savings_loan_group_member_role, date, text) to authenticated;
grant execute on function public.create_savings_loan_application(uuid, uuid, text, date, public.savings_loan_application_method, uuid, uuid, numeric, integer, text, text, numeric, text, text, text, text, text) to authenticated;
grant execute on function public.add_savings_loan_application_group_member(uuid, uuid, numeric, text) to authenticated;

grant execute on function public.activate_savings_loan_public_application_link(uuid, uuid, text, text, text, boolean, boolean, boolean, numeric, integer, integer) to authenticated;
grant execute on function public.get_savings_loan_public_application_form(text, text) to anon, authenticated;
grant execute on function public.submit_public_savings_loan_application(text, text, public.savings_loan_application_method, jsonb, text, text) to anon, authenticated;

grant execute on function public.create_savings_loan_applicant_intake_individual(
  uuid,
  uuid,
  text,
  date,
  text,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  public.savings_loan_application_input_mode,
  uuid,
  text,
  text
) to authenticated;

grant execute on function public.create_savings_loan_applicant_intake_group(
  uuid,
  uuid,
  text,
  date,
  text,
  text,
  text,
  numeric,
  integer,
  text,
  text,
  numeric,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean,
  jsonb,
  public.savings_loan_application_input_mode,
  uuid,
  text,
  text
) to authenticated;

grant execute on function public.verify_savings_loan_application(uuid, text) to authenticated;
grant execute on function public.request_correction_savings_loan_application(uuid, text) to authenticated;
grant execute on function public.reject_savings_loan_application(uuid, text) to authenticated;
grant execute on function public.create_and_post_savings_loan_disbursement(uuid, text, date, uuid, text) to authenticated;
grant execute on function public.create_and_post_savings_loan_repayment(uuid, text, date, uuid, numeric, numeric, numeric, numeric, text) to authenticated;
grant execute on function public.generate_savings_loan_repayment_schedule(uuid, uuid, date) to authenticated;
grant execute on function public.sync_savings_loan_repayment_schedule_payments(uuid) to authenticated;

insert into public.permissions (code, name, module, description)
values
  ('savings_loan.application.view', 'Lihat Pengajuan Simpan Pinjam', 'savings_loan', 'Melihat data anggota, kelompok, dan pengajuan pinjaman.'),
  ('savings_loan.application.verify', 'Verifikasi Pengajuan Simpan Pinjam', 'savings_loan', 'Memverifikasi pengajuan pinjaman.'),
  ('savings_loan.application.request_correction', 'Minta Perbaikan Pengajuan Simpan Pinjam', 'savings_loan', 'Meminta perbaikan pengajuan pinjaman.'),
  ('savings_loan.application.reject', 'Tolak Pengajuan Simpan Pinjam', 'savings_loan', 'Menolak pengajuan pinjaman.'),
  ('savings_loan.disbursement.view', 'Lihat Pencairan Pinjaman', 'savings_loan', 'Melihat alur pencairan pinjaman.'),
  ('savings_loan.disbursement.create', 'Posting Pencairan Pinjaman', 'savings_loan', 'Membuat dan memposting pencairan pinjaman.'),
  ('savings_loan.repayment.view', 'Lihat Angsuran Pinjaman', 'savings_loan', 'Melihat angsuran dan jadwal pinjaman.'),
  ('savings_loan.repayment.create', 'Posting Angsuran Pinjaman', 'savings_loan', 'Membuat jadwal dan memposting angsuran pinjaman.')
on conflict (code)
do update set
  name = excluded.name,
  module = excluded.module,
  description = excluded.description;

insert into public.role_permissions (permission_id, role)
select p.id, x.role::public.app_role
from public.permissions p
join (
  values
    ('savings_loan.application.view', 'super_admin_platform'),
    ('savings_loan.application.view', 'direktur_bumdes'),
    ('savings_loan.application.view', 'admin_bumdes'),
    ('savings_loan.application.view', 'manager_unit'),
    ('savings_loan.application.view', 'operator_unit'),
    ('savings_loan.application.view', 'viewer_unit'),

    ('savings_loan.application.verify', 'manager_unit'),
    ('savings_loan.application.verify', 'operator_unit'),
    ('savings_loan.application.request_correction', 'manager_unit'),
    ('savings_loan.application.request_correction', 'operator_unit'),
    ('savings_loan.application.reject', 'manager_unit'),
    ('savings_loan.application.reject', 'operator_unit'),

    ('savings_loan.disbursement.view', 'super_admin_platform'),
    ('savings_loan.disbursement.view', 'direktur_bumdes'),
    ('savings_loan.disbursement.view', 'admin_bumdes'),
    ('savings_loan.disbursement.view', 'manager_unit'),
    ('savings_loan.disbursement.view', 'operator_unit'),
    ('savings_loan.disbursement.view', 'viewer_unit'),
    ('savings_loan.disbursement.create', 'manager_unit'),
    ('savings_loan.disbursement.create', 'operator_unit'),

    ('savings_loan.repayment.view', 'super_admin_platform'),
    ('savings_loan.repayment.view', 'direktur_bumdes'),
    ('savings_loan.repayment.view', 'admin_bumdes'),
    ('savings_loan.repayment.view', 'manager_unit'),
    ('savings_loan.repayment.view', 'operator_unit'),
    ('savings_loan.repayment.view', 'viewer_unit'),
    ('savings_loan.repayment.create', 'manager_unit'),
    ('savings_loan.repayment.create', 'operator_unit')
) as x(code, role)
  on x.code = p.code
on conflict do nothing;

