-- =========================================================
-- Migration 000025: Registration & Assignment Governance Engine
-- ORVIA-BUMDES / ERP BUMDes
--
-- DB-first alignment:
--   Active engine packages:
--     - tenant_registrations
--     - pendamping_registrations
--     - bupati_registrations
--     - pendamping_kecamatan_assignments
--     - submit/approve/reject RPCs
--     - pendamping kecamatan assignment access helper
--
-- Important:
--   Approval functions depend on platform.manage permission
--   and existing base auth/role/tenant/accounting helpers.
-- =========================================================

-- =========================================================
-- Tables
-- =========================================================

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
  requester_phone text,
  requester_email text,
  status public.registration_status not null default 'pending'::public.registration_status,
  submitted_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pendamping_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null,
  full_name text not null,
  email text not null,
  phone text,
  nama_kecamatan text not null,
  instansi text,
  notes text,
  status public.registration_status not null default 'pending'::public.registration_status,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pendamping_registrations_full_name_not_empty check (length(trim(full_name)) > 0),
  constraint pendamping_registrations_email_not_empty check (length(trim(email)) > 0),
  constraint pendamping_registrations_nama_kecamatan_not_empty check (length(trim(nama_kecamatan)) > 0)
);

create table if not exists public.bupati_registrations (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null,
  full_name text not null,
  email text not null,
  phone text,
  jabatan text,
  instansi text,
  wilayah_kabupaten text,
  notes text,
  status public.registration_status not null default 'pending'::public.registration_status,
  rejection_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pendamping_kecamatan_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nama_kecamatan text not null,
  status text not null default 'active'::text,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pendamping_kecamatan_assignments_nama_kecamatan_check check ((nullif(trim(both from nama_kecamatan), ''::text) is not null)),
  constraint pendamping_kecamatan_assignments_status_check check ((status = any (array['active'::text, 'inactive'::text, 'revoked'::text))),
  constraint pendamping_kecamatan_assignments_unique unique (user_id, nama_kecamatan)
);

-- =========================================================
-- Indexes
-- =========================================================

create index if not exists idx_bupati_registrations_email
  on public.bupati_registrations (lower(trim(both from email)));

create index if not exists idx_bupati_registrations_status
  on public.bupati_registrations (status);

create index if not exists idx_bupati_registrations_submitted_by
  on public.bupati_registrations (submitted_by);

create index if not exists idx_pendamping_registrations_kecamatan
  on public.pendamping_registrations (lower(trim(both from nama_kecamatan)));

create index if not exists idx_pendamping_registrations_status
  on public.pendamping_registrations (status);

create index if not exists idx_pendamping_registrations_submitted_by
  on public.pendamping_registrations (submitted_by);

create unique index if not exists uq_pendamping_registrations_pending_email
  on public.pendamping_registrations (lower(trim(both from email)))
  where status = 'pending'::public.registration_status;

-- =========================================================
-- Trigger helper
-- =========================================================

create or replace function public.set_pendamping_registration_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

-- =========================================================
-- Tenant registration RPCs
-- =========================================================

create or replace function public.submit_tenant_registration(
  p_nama_bumdes text,
  p_kode_bumdes text,
  p_nama_desa text,
  p_nama_kecamatan text,
  p_alamat text default null::text,
  p_nomor_whatsapp text default null::text,
  p_email text default null::text,
  p_requester_name text default null::text,
  p_requester_phone text default null::text,
  p_requester_email text default null::text,
  p_submitted_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_registration_id uuid;
  v_clean_kode text;
begin
  if nullif(trim(p_nama_bumdes), '') is null then
    raise exception 'Nama BUMDes wajib diisi';
  end if;

  if nullif(trim(p_kode_bumdes), '') is null then
    raise exception 'Kode BUMDes wajib diisi';
  end if;

  if nullif(trim(p_nama_desa), '') is null then
    raise exception 'Nama desa wajib diisi';
  end if;

  if nullif(trim(p_nama_kecamatan), '') is null then
    raise exception 'Nama kecamatan wajib diisi';
  end if;

  if nullif(trim(coalesce(p_requester_email, '')), '') is null then
    raise exception 'Email pemohon wajib diisi karena akan digunakan untuk login direktur';
  end if;

  if p_submitted_by is null then
    raise exception 'Akun login pemohon belum dibuat. Pendaftaran wajib menyertakan submitted_by.';
  end if;

  v_clean_kode := upper(trim(p_kode_bumdes));

  if exists (
    select 1
    from public.tenants t
    where lower(t.kode_bumdes) = lower(v_clean_kode)
  ) then
    raise exception 'Kode BUMDes sudah terdaftar sebagai tenant';
  end if;

  if exists (
    select 1
    from public.tenant_registrations tr
    where lower(tr.kode_bumdes) = lower(v_clean_kode)
      and tr.status = 'pending'::public.registration_status
  ) then
    raise exception 'Kode BUMDes sudah memiliki pengajuan yang masih pending';
  end if;

  insert into public.tenant_registrations (
    nama_bumdes,
    kode_bumdes,
    nama_desa,
    nama_kecamatan,
    alamat,
    nomor_whatsapp,
    email,
    requester_name,
    requester_phone,
    requester_email,
    status,
    submitted_by
  )
  values (
    trim(p_nama_bumdes),
    v_clean_kode,
    trim(p_nama_desa),
    trim(p_nama_kecamatan),
    nullif(trim(coalesce(p_alamat, '')), ''),
    nullif(trim(coalesce(p_nomor_whatsapp, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_requester_name, '')), ''),
    nullif(trim(coalesce(p_requester_phone, '')), ''),
    nullif(trim(coalesce(p_requester_email, '')), ''),
    'pending'::public.registration_status,
    p_submitted_by
  )
  returning id into v_registration_id;

  perform public.log_audit_event(
    null::uuid,
    null::uuid,
    p_submitted_by,
    null::public.app_role,
    'tenant_registration_submitted'::text,
    'tenant_registrations'::text,
    v_registration_id,
    'public_register_form'::text,
    v_registration_id,
    'Pendaftaran BUMDes dikirim dan menunggu review platform.'::text,
    jsonb_build_object(
      'nama_bumdes', trim(p_nama_bumdes),
      'kode_bumdes', v_clean_kode,
      'nama_desa', trim(p_nama_desa),
      'nama_kecamatan', trim(p_nama_kecamatan),
      'requester_email', nullif(trim(coalesce(p_requester_email, '')), ''),
      'submitted_by', p_submitted_by,
      'status', 'pending'
    )
  );

  return v_registration_id;
end;
$function$;

create or replace function public.approve_tenant_registration(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_registration public.tenant_registrations%rowtype;
  v_tenant_id uuid;
  v_actor_role public.app_role;
  v_finance_result jsonb;
  v_period_id uuid;
  v_period_year integer := extract(year from current_date)::integer;
  v_period_month integer := extract(month from current_date)::integer;
  v_period_start date := date_trunc('month', current_date)::date;
  v_period_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    auth.uid(),
    null,
    null
  );

  select *
  into v_registration
  from public.tenant_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Data registrasi tidak ditemukan';
  end if;

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Registrasi sudah diproses';
  end if;

  if v_registration.submitted_by is null then
    raise exception 'Registrasi lama belum memiliki akun login pemohon. Gunakan backfill direktur atau minta pemohon daftar ulang dengan password.';
  end if;

  if exists (
    select 1
    from public.tenants
    where lower(kode_bumdes) = lower(v_registration.kode_bumdes)
  ) then
    raise exception 'Kode BUMDes sudah terdaftar sebagai tenant';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'super_admin_platform'::public.app_role
  ) then
    raise exception 'User super_admin_platform tidak boleh menjadi direktur BUMDes';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.tenant_id is not null
  ) then
    raise exception 'User pemohon sudah memiliki role pada tenant lain. Gunakan akun/email khusus untuk BUMDes ini.';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by
    case
      when ur.role = 'super_admin_platform' then 1
      else 2
    end
  limit 1;

  insert into public.tenants (
    nama_bumdes,
    kode_bumdes,
    nama_desa,
    nama_kecamatan,
    alamat,
    nomor_whatsapp,
    email,
    status,
    approved_at,
    approved_by
  )
  values (
    v_registration.nama_bumdes,
    v_registration.kode_bumdes,
    v_registration.nama_desa,
    v_registration.nama_kecamatan,
    v_registration.alamat,
    v_registration.nomor_whatsapp,
    v_registration.email,
    'active'::public.tenant_status,
    now(),
    auth.uid()
  )
  returning id into v_tenant_id;

  insert into public.profiles (
    id,
    full_name,
    phone,
    default_tenant_id
  )
  values (
    v_registration.submitted_by,
    coalesce(v_registration.requester_name, v_registration.nama_bumdes),
    v_registration.requester_phone,
    v_tenant_id
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    default_tenant_id = excluded.default_tenant_id,
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    tenant_id,
    unit_id
  )
  select
    v_registration.submitted_by,
    'direktur_bumdes'::public.app_role,
    v_tenant_id,
    null::uuid
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'direktur_bumdes'::public.app_role
      and ur.tenant_id = v_tenant_id
      and ur.unit_id is null
  );

  v_finance_result := public.provision_tenant_core_finance_accounts(
    v_tenant_id,
    auth.uid()
  );

  insert into public.accounting_periods (
    tenant_id,
    unit_id,
    period_year,
    period_month,
    period_start,
    period_end,
    status,
    notes
  )
  values (
    v_tenant_id,
    null,
    v_period_year,
    v_period_month,
    v_period_start,
    v_period_end,
    'open',
    'Periode pusat otomatis dibuat saat approval registrasi BUMDes'
  )
  on conflict on constraint accounting_periods_scope_unique do nothing
  returning id into v_period_id;

  update public.tenant_registrations
  set
    status = 'approved'::public.registration_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_registration_id;

  perform public.log_audit_event(
    v_tenant_id,
    null::uuid,
    auth.uid(),
    v_actor_role,
    'tenant_registration_approved'::text,
    'tenant_registrations'::text,
    p_registration_id,
    'platform_dashboard'::text,
    v_tenant_id,
    'Registrasi BUMDes disetujui, tenant aktif dibuat, direktur ditetapkan, dan pondasi finance pusat diprovision.'::text,
    jsonb_build_object(
      'registration_id', p_registration_id,
      'tenant_id', v_tenant_id,
      'submitted_by', v_registration.submitted_by,
      'nama_bumdes', v_registration.nama_bumdes,
      'kode_bumdes', v_registration.kode_bumdes,
      'director_role', 'direktur_bumdes',
      'finance_result', v_finance_result,
      'period_year', v_period_year,
      'period_month', v_period_month,
      'period_created', v_period_id is not null,
      'status', 'active'
    )
  );

  return v_tenant_id;
end;
$function$;

create or replace function public.reject_tenant_registration(
  p_registration_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_registration public.tenant_registrations%rowtype;
  v_actor_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    auth.uid(),
    null,
    null
  );

  if nullif(trim(coalesce(p_rejection_reason, '')), '') is null then
    raise exception 'Alasan penolakan wajib diisi';
  end if;

  select *
  into v_registration
  from public.tenant_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Data registrasi tidak ditemukan';
  end if;

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Registrasi sudah diproses';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by
    case
      when ur.role = 'super_admin_platform' then 1
      else 2
    end
  limit 1;

  update public.tenant_registrations
  set
    status = 'rejected'::public.registration_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    rejection_reason = trim(p_rejection_reason),
    updated_at = now()
  where id = p_registration_id;

  perform public.log_audit_event(
    null::uuid,
    null::uuid,
    auth.uid(),
    v_actor_role,
    'tenant_registration_rejected'::text,
    'tenant_registrations'::text,
    p_registration_id,
    'platform_dashboard'::text,
    p_registration_id,
    'Registrasi BUMDes ditolak oleh platform.'::text,
    jsonb_build_object(
      'registration_id', p_registration_id,
      'nama_bumdes', v_registration.nama_bumdes,
      'kode_bumdes', v_registration.kode_bumdes,
      'rejection_reason', trim(p_rejection_reason),
      'status', 'rejected'
    )
  );

  return p_registration_id;
end;
$function$;

-- =========================================================
-- Pendamping registration RPCs
-- =========================================================

create or replace function public.submit_pendamping_registration(
  p_full_name text,
  p_email text,
  p_phone text,
  p_nama_kecamatan text,
  p_instansi text default null::text,
  p_notes text default null::text,
  p_submitted_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_registration_id uuid;
begin
  if p_submitted_by is null then
    raise exception 'User pendaftar pendamping tidak valid.';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Nama lengkap pendamping wajib diisi.';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'Email pendamping wajib diisi.';
  end if;

  if nullif(trim(p_nama_kecamatan), '') is null then
    raise exception 'Kecamatan tugas pendamping wajib diisi.';
  end if;

  if exists (
    select 1
    from public.pendamping_registrations pr
    where lower(trim(pr.email)) = lower(trim(p_email))
      and pr.status = 'pending'
  ) then
    raise exception 'Pendaftaran pendamping dengan email ini masih menunggu persetujuan.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_submitted_by
      and ur.role = 'pendamping_kecamatan'::public.app_role
  ) then
    raise exception 'User ini sudah memiliki role Pendamping Kecamatan.';
  end if;

  insert into public.pendamping_registrations (
    submitted_by,
    full_name,
    email,
    phone,
    nama_kecamatan,
    instansi,
    notes,
    status
  )
  values (
    p_submitted_by,
    trim(p_full_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    upper(trim(p_nama_kecamatan)),
    nullif(trim(coalesce(p_instansi, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending'
  )
  returning id into v_registration_id;

  return v_registration_id;
end;
$function$;

create or replace function public.approve_pendamping_registration(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_registration public.pendamping_registrations%rowtype;
begin
  if v_actor_id is null then
    raise exception 'User approval tidak valid.';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    v_actor_id,
    null,
    null
  );

  select *
  into v_registration
  from public.pendamping_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Pendaftaran pendamping tidak ditemukan.';
  end if;

  if v_registration.status <> 'pending' then
    raise exception 'Pendaftaran pendamping sudah diproses.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'super_admin_platform'::public.app_role
  ) then
    raise exception 'Akun super admin platform tidak boleh dijadikan Pendamping Kecamatan.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'pendamping_kecamatan'::public.app_role
  ) then
    raise exception 'User ini sudah memiliki role Pendamping Kecamatan.';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    default_tenant_id,
    created_at,
    updated_at
  )
  values (
    v_registration.submitted_by,
    v_registration.full_name,
    v_registration.phone,
    null,
    now(),
    now()
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    tenant_id,
    unit_id,
    created_at
  )
  values (
    v_registration.submitted_by,
    'pendamping_kecamatan'::public.app_role,
    null,
    null,
    now()
  );

  insert into public.pendamping_kecamatan_assignments (
    user_id,
    nama_kecamatan,
    status,
    assigned_by,
    notes,
    assigned_at,
    created_at,
    updated_at
  )
  values (
    v_registration.submitted_by,
    upper(trim(v_registration.nama_kecamatan)),
    'active',
    v_actor_id,
    'Assignment dibuat otomatis dari approval pendaftaran Pendamping Kecamatan.',
    now(),
    now(),
    now()
  );

  update public.pendamping_registrations
  set
    status = 'approved',
    reviewed_by = v_actor_id,
    reviewed_at = now(),
    rejection_reason = null
  where id = p_registration_id;

  return p_registration_id;
end;
$function$;

create or replace function public.reject_pendamping_registration(
  p_registration_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'User rejection tidak valid.';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    v_actor_id,
    null,
    null
  );

  if nullif(trim(p_rejection_reason), '') is null then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  update public.pendamping_registrations
  set
    status = 'rejected',
    reviewed_by = v_actor_id,
    reviewed_at = now(),
    rejection_reason = trim(p_rejection_reason)
  where id = p_registration_id
    and status = 'pending';

  if not found then
    raise exception 'Pendaftaran pendamping tidak ditemukan atau sudah diproses.';
  end if;

  return p_registration_id;
end;
$function$;

-- =========================================================
-- Bupati registration RPCs
-- =========================================================

create or replace function public.submit_bupati_registration(
  p_full_name text,
  p_email text,
  p_phone text,
  p_jabatan text default null::text,
  p_instansi text default null::text,
  p_wilayah_kabupaten text default null::text,
  p_notes text default null::text,
  p_submitted_by uuid default auth.uid()
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_registration_id uuid;
begin
  if p_submitted_by is null then
    raise exception 'User pendaftar Bupati tidak valid.';
  end if;

  if nullif(trim(p_full_name), '') is null then
    raise exception 'Nama lengkap pejabat wajib diisi.';
  end if;

  if nullif(trim(p_email), '') is null then
    raise exception 'Email login Bupati wajib diisi.';
  end if;

  if exists (
    select 1
    from public.bupati_registrations br
    where lower(trim(br.email)) = lower(trim(p_email))
      and br.status = 'pending'::public.registration_status
  ) then
    raise exception 'Pendaftaran Bupati dengan email ini masih menunggu persetujuan.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_submitted_by
      and ur.role = 'bupati'::public.app_role
  ) then
    raise exception 'User ini sudah memiliki role Bupati.';
  end if;

  insert into public.bupati_registrations (
    submitted_by,
    full_name,
    email,
    phone,
    jabatan,
    instansi,
    wilayah_kabupaten,
    notes,
    status
  )
  values (
    p_submitted_by,
    trim(p_full_name),
    lower(trim(p_email)),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_jabatan, '')), ''),
    nullif(trim(coalesce(p_instansi, '')), ''),
    nullif(upper(trim(coalesce(p_wilayah_kabupaten, ''))), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    'pending'::public.registration_status
  )
  returning id into v_registration_id;

  return v_registration_id;
end;
$function$;

create or replace function public.approve_bupati_registration(p_registration_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_registration public.bupati_registrations%rowtype;
begin
  if v_actor_id is null then
    raise exception 'User approval tidak valid.';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    v_actor_id,
    null,
    null
  );

  select *
  into v_registration
  from public.bupati_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Pendaftaran Bupati tidak ditemukan.';
  end if;

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Pendaftaran Bupati sudah diproses.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'super_admin_platform'::public.app_role
  ) then
    raise exception 'Akun super admin platform tidak boleh dijadikan Bupati.';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'bupati'::public.app_role
  ) then
    raise exception 'User ini sudah memiliki role Bupati.';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone,
    default_tenant_id,
    created_at,
    updated_at
  )
  values (
    v_registration.submitted_by,
    v_registration.full_name,
    v_registration.phone,
    null,
    now(),
    now()
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    tenant_id,
    unit_id,
    created_at
  )
  values (
    v_registration.submitted_by,
    'bupati'::public.app_role,
    null,
    null,
    now()
  );

  update public.bupati_registrations
  set
    status = 'approved'::public.registration_status,
    reviewed_by = v_actor_id,
    reviewed_at = now(),
    rejection_reason = null,
    updated_at = now()
  where id = p_registration_id;

  return p_registration_id;
end;
$function$;

create or replace function public.reject_bupati_registration(
  p_registration_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'User rejection tidak valid.';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    v_actor_id,
    null,
    null
  );

  if nullif(trim(p_rejection_reason), '') is null then
    raise exception 'Alasan penolakan wajib diisi.';
  end if;

  update public.bupati_registrations
  set
    status = 'rejected'::public.registration_status,
    reviewed_by = v_actor_id,
    reviewed_at = now(),
    rejection_reason = trim(p_rejection_reason),
    updated_at = now()
  where id = p_registration_id
    and status = 'pending'::public.registration_status;

  if not found then
    raise exception 'Pendaftaran Bupati tidak ditemukan atau sudah diproses.';
  end if;

  return p_registration_id;
end;
$function$;

-- =========================================================
-- Pendamping access helper
-- =========================================================

create or replace function public.can_pendamping_kecamatan_access_tenant(
  p_tenant_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_kecamatan text;
begin
  if p_tenant_id is null or p_user_id is null then
    return false;
  end if;

  select t.nama_kecamatan
  into v_tenant_kecamatan
  from public.tenants t
  where t.id = p_tenant_id
    and t.status = 'active'
  limit 1;

  if v_tenant_kecamatan is null then
    return false;
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'super_admin_platform'
  ) then
    return true;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.pendamping_kecamatan_assignments pka
      on pka.user_id = ur.user_id
    where ur.user_id = p_user_id
      and ur.role = 'pendamping_kecamatan'
      and ur.tenant_id is null
      and ur.unit_id is null
      and pka.status = 'active'
      and lower(trim(pka.nama_kecamatan)) = lower(trim(v_tenant_kecamatan))
  );
end;
$function$;

-- =========================================================
-- Triggers
-- =========================================================

drop trigger if exists trg_tenant_registrations_set_updated_at on public.tenant_registrations;
create trigger trg_tenant_registrations_set_updated_at
before update on public.tenant_registrations
for each row
execute function public.set_updated_at();

drop trigger if exists trg_set_pendamping_registration_updated_at on public.pendamping_registrations;
create trigger trg_set_pendamping_registration_updated_at
before update on public.pendamping_registrations
for each row
execute function public.set_pendamping_registration_updated_at();

drop trigger if exists trg_pendamping_kecamatan_assignments_set_updated_at on public.pendamping_kecamatan_assignments;
create trigger trg_pendamping_kecamatan_assignments_set_updated_at
before update on public.pendamping_kecamatan_assignments
for each row
execute function public.set_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.tenant_registrations enable row level security;
alter table public.pendamping_registrations enable row level security;
alter table public.bupati_registrations enable row level security;
alter table public.pendamping_kecamatan_assignments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_registrations'
      and policyname = 'tenant_registrations_insert_public'
  ) then
    create policy tenant_registrations_insert_public
    on public.tenant_registrations
    for insert
    to anon, authenticated
    with check (status = 'pending'::public.registration_status);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_registrations'
      and policyname = 'tenant_registrations_select_admin'
  ) then
    create policy tenant_registrations_select_admin
    on public.tenant_registrations
    for select
    to authenticated
    using (
      public.is_super_admin_platform(auth.uid())
      or submitted_by = auth.uid()
    );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tenant_registrations'
      and policyname = 'tenant_registrations_update_admin'
  ) then
    create policy tenant_registrations_update_admin
    on public.tenant_registrations
    for update
    to authenticated
    using (public.is_super_admin_platform(auth.uid()))
    with check (public.is_super_admin_platform(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pendamping_registrations'
      and policyname = 'platform_manage_select_pendamping_registrations'
  ) then
    create policy platform_manage_select_pendamping_registrations
    on public.pendamping_registrations
    for select
    to authenticated
    using (public.has_permission('platform.manage'::text, auth.uid(), null::uuid, null::uuid));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pendamping_registrations'
      and policyname = 'user_select_own_pendamping_registration'
  ) then
    create policy user_select_own_pendamping_registration
    on public.pendamping_registrations
    for select
    to authenticated
    using (submitted_by = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bupati_registrations'
      and policyname = 'platform_manage_select_bupati_registrations'
  ) then
    create policy platform_manage_select_bupati_registrations
    on public.bupati_registrations
    for select
    to authenticated
    using (public.has_permission('platform.manage'::text, auth.uid(), null::uuid, null::uuid));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'bupati_registrations'
      and policyname = 'user_select_own_bupati_registration'
  ) then
    create policy user_select_own_bupati_registration
    on public.bupati_registrations
    for select
    to authenticated
    using (submitted_by = auth.uid());
  end if;
end $$;

-- =========================================================
-- Grants
-- =========================================================

grant select on public.tenant_registrations to authenticated;
grant select on public.pendamping_registrations to authenticated;
grant select, insert, update on public.bupati_registrations to authenticated;
grant select, insert, update on public.pendamping_kecamatan_assignments to authenticated;

grant execute on function public.submit_tenant_registration(text, text, text, text, text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.approve_tenant_registration(uuid) to authenticated;
grant execute on function public.reject_tenant_registration(uuid, text) to authenticated;

grant execute on function public.submit_pendamping_registration(text, text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.approve_pendamping_registration(uuid) to authenticated;
grant execute on function public.reject_pendamping_registration(uuid, text) to authenticated;

grant execute on function public.submit_bupati_registration(text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.approve_bupati_registration(uuid) to authenticated;
grant execute on function public.reject_bupati_registration(uuid, text) to authenticated;

grant execute on function public.can_pendamping_kecamatan_access_tenant(uuid, uuid) to authenticated;

-- =========================================================
-- Comments
-- =========================================================

comment on table public.tenant_registrations is
'Public/platform-governed BUMDes tenant registration queue. Approval creates tenant, director role, finance foundation, and initial accounting period.';

comment on table public.pendamping_registrations is
'Registration queue for Pendamping Kecamatan users. Approval creates role and kecamatan assignment.';

comment on table public.bupati_registrations is
'Registration queue for Bupati/regional executive monitoring users. Approval creates bupati role.';

comment on table public.pendamping_kecamatan_assignments is
'Assignment scope table mapping Pendamping Kecamatan users to kecamatan names for tenant access governance.';

comment on function public.can_pendamping_kecamatan_access_tenant(uuid, uuid) is
'Returns true when a Pendamping Kecamatan can access an active tenant based on kecamatan assignment.';
