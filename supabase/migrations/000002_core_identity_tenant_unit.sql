-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000002_core_identity_tenant_unit.sql
-- Purpose : Core identity, tenant, unit, registration, and unit template baseline
-- Notes   : Baseline extracted from active development database.
--           Triggers are intentionally deferred until their trigger functions exist.
-- ============================================================

begin;

-- ============================================================
-- UNIT TEMPLATES
-- ============================================================

create table if not exists public.unit_templates (
  id uuid primary key default gen_random_uuid(),
  kode_template text not null,
  nama_template text not null,
  deskripsi text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_templates_kode_template_key unique (kode_template)
);

-- ============================================================
-- TENANTS
-- ============================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  nama_bumdes text not null,
  kode_bumdes text not null,
  nama_desa text not null,
  nama_kecamatan text not null,
  alamat text,
  nomor_whatsapp text,
  email text,
  status public.tenant_status not null default 'pending'::public.tenant_status,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenants_kode_bumdes_key unique (kode_bumdes)
);

-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key,
  full_name text,
  phone text,
  default_tenant_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade,
  constraint profiles_default_tenant_id_fkey
    foreign key (default_tenant_id) references public.tenants(id) on delete set null
);

alter table public.tenants
  drop constraint if exists tenants_approved_by_fkey;

alter table public.tenants
  add constraint tenants_approved_by_fkey
  foreign key (approved_by) references public.profiles(id) on delete set null;

-- ============================================================
-- BUSINESS UNITS
-- ============================================================

create table if not exists public.business_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  template_id uuid,
  kode_unit text not null,
  nama_unit text not null,
  jenis_unit text not null,
  status public.unit_status not null default 'aktif'::public.unit_status,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_units_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint business_units_template_id_fkey
    foreign key (template_id) references public.unit_templates(id) on delete set null,
  constraint business_units_tenant_kode_unique unique (tenant_id, kode_unit)
);

-- ============================================================
-- USER ROLES
-- ============================================================

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role public.app_role not null,
  tenant_id uuid,
  unit_id uuid,
  created_at timestamptz not null default now(),
  constraint user_roles_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint user_roles_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint user_roles_unit_id_fkey
    foreign key (unit_id) references public.business_units(id) on delete cascade,
  constraint user_roles_scope_unique unique nulls not distinct (user_id, role, tenant_id, unit_id)
);

-- ============================================================
-- UNIT ACCESS CREDENTIALS
-- ============================================================

create table if not exists public.unit_access_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_id uuid not null,
  unit_id uuid not null,
  login_code text not null,
  email_virtual text not null,
  role public.app_role not null,
  must_change_password boolean not null default true,
  access_status text not null default 'active'::text,
  generated_by uuid,
  generated_at timestamptz not null default now(),
  last_password_reset_at timestamptz,
  created_at timestamptz not null default now(),
  constraint unit_access_credentials_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint unit_access_credentials_tenant_id_fkey
    foreign key (tenant_id) references public.tenants(id) on delete cascade,
  constraint unit_access_credentials_unit_id_fkey
    foreign key (unit_id) references public.business_units(id) on delete cascade,
  constraint unit_access_credentials_generated_by_fkey
    foreign key (generated_by) references auth.users(id) on delete set null,
  constraint unit_access_credentials_login_code_key unique (login_code),
  constraint unit_access_credentials_email_virtual_key unique (email_virtual),
  constraint unit_access_credentials_unique unique (user_id, tenant_id, unit_id, role),
  constraint unit_access_credentials_role_check
    check (role = any (array[
      'manager_unit'::public.app_role,
      'operator_unit'::public.app_role,
      'viewer_unit'::public.app_role
    ]))
);

-- ============================================================
-- TENANT REGISTRATIONS
-- ============================================================

create table if not exists public.tenant_registrations (
  id uuid primary key default gen_random_uuid(),
  nama_bumdes text not null,
  kode_bumdes text not null,
  nama_desa text not null,
  nama_kecamatan text not null,
  alamat text,
  nomor_whatsapp text,
  email text,
  requester_name text,
  requester_email text,
  requester_phone text,
  status public.registration_status not null default 'pending'::public.registration_status,
  submitted_by uuid,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_registrations_submitted_by_fkey
    foreign key (submitted_by) references auth.users(id) on delete set null,
  constraint tenant_registrations_reviewed_by_fkey
    foreign key (reviewed_by) references auth.users(id) on delete set null
);

-- ============================================================
-- PENDAMPING REGISTRATIONS
-- ============================================================

create table if not exists public.pendamping_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null,
  full_name text not null,
  email text not null,
  phone text,
  instansi text,
  nama_kecamatan text not null,
  status public.registration_status not null default 'pending'::public.registration_status,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pendamping_registrations_full_name_not_empty
    check (length(trim(full_name)) > 0),
  constraint pendamping_registrations_email_not_empty
    check (length(trim(email)) > 0),
  constraint pendamping_registrations_nama_kecamatan_not_empty
    check (length(trim(nama_kecamatan)) > 0)
);

-- ============================================================
-- PENDAMPING KECAMATAN ASSIGNMENTS
-- ============================================================

create table if not exists public.pendamping_kecamatan_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  nama_kecamatan text not null,
  status text not null default 'active'::text,
  assigned_by uuid,
  assigned_at timestamptz not null default now(),
  revoked_by uuid,
  revoked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pendamping_kecamatan_assignments_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  constraint pendamping_kecamatan_assignments_assigned_by_fkey
    foreign key (assigned_by) references auth.users(id) on delete set null,
  constraint pendamping_kecamatan_assignments_revoked_by_fkey
    foreign key (revoked_by) references auth.users(id) on delete set null,
  constraint pendamping_kecamatan_assignments_nama_kecamatan_check
    check (nullif(trim(nama_kecamatan), '') is not null),
  constraint pendamping_kecamatan_assignments_status_check
    check (status = any (array['active'::text, 'inactive'::text, 'revoked'::text])),
  constraint pendamping_kecamatan_assignments_unique unique (user_id, nama_kecamatan)
);

-- ============================================================
-- BUPATI REGISTRATIONS
-- ============================================================

create table if not exists public.bupati_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null,
  full_name text not null,
  email text not null,
  phone text,
  jabatan text,
  instansi text,
  wilayah_kabupaten text,
  status public.registration_status not null default 'pending'::public.registration_status,
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_bupati_registrations_email
  on public.bupati_registrations using btree (lower(trim(email)));

create index if not exists idx_bupati_registrations_status
  on public.bupati_registrations using btree (status);

create index if not exists idx_bupati_registrations_submitted_by
  on public.bupati_registrations using btree (submitted_by);

create index if not exists idx_pendamping_registrations_kecamatan
  on public.pendamping_registrations using btree (lower(trim(nama_kecamatan)));

create index if not exists idx_pendamping_registrations_status
  on public.pendamping_registrations using btree (status);

create index if not exists idx_pendamping_registrations_submitted_by
  on public.pendamping_registrations using btree (submitted_by);

create unique index if not exists uq_pendamping_registrations_pending_email
  on public.pendamping_registrations using btree (lower(trim(email)))
  where status = 'pending'::public.registration_status;

commit;
