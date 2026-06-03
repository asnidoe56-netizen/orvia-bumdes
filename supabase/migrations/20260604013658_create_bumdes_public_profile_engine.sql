-- BUMDes public profile engine
-- Additive-only migration.
-- This migration does not modify accounting, transaction posting, approval, journal, ledger, or reporting engines.

create table if not exists public.tenant_public_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  public_slug text not null,
  is_published boolean not null default false,

  hero_title text null,
  hero_subtitle text null,
  tagline text null,
  logo_url text null,
  hero_image_url text null,

  profile_description text null,
  contact_phone text null,
  contact_email text null,
  contact_address text null,

  about_history text null,
  vision text null,
  mission text null,
  service_goals text null,

  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_public_profiles_tenant_unique unique (tenant_id),
  constraint tenant_public_profiles_slug_unique unique (public_slug),
  constraint tenant_public_profiles_slug_format check (
    public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create table if not exists public.tenant_public_organizational_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  name text not null,
  position text not null,
  role_group text not null default 'pengurus',
  photo_url text null,
  display_order integer not null default 100,
  is_published boolean not null default true,

  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_public_organizational_members_role_group_check check (
    role_group in (
      'penasihat',
      'pelaksana_operasional',
      'pengawas',
      'manager_unit',
      'pengurus',
      'lainnya'
    )
  )
);

create table if not exists public.tenant_public_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,

  public_description text null,
  image_url text null,
  display_order integer not null default 100,
  is_published boolean not null default true,

  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_public_units_unique unique (tenant_id, unit_id)
);

create table if not exists public.tenant_public_ppid (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  officer_name text null,
  officer_position text null,
  service_phone text null,
  service_email text null,
  service_address text null,
  service_hours text null,
  request_procedure text null,
  objection_procedure text null,
  is_published boolean not null default false,

  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_public_ppid_tenant_unique unique (tenant_id)
);

create table if not exists public.tenant_public_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  title text not null,
  description text null,
  document_category text not null default 'lainnya',
  file_url text not null,
  display_order integer not null default 100,
  is_published boolean not null default true,

  created_by uuid null references auth.users(id),
  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_public_documents_category_check check (
    document_category in (
      'profil',
      'regulasi',
      'laporan_umum',
      'kegiatan',
      'ppid',
      'lainnya'
    )
  )
);

create index if not exists idx_tenant_public_profiles_slug
  on public.tenant_public_profiles (public_slug);

create index if not exists idx_tenant_public_profiles_published
  on public.tenant_public_profiles (is_published);

create index if not exists idx_tenant_public_organizational_members_tenant
  on public.tenant_public_organizational_members (tenant_id, is_published, display_order);

create index if not exists idx_tenant_public_units_tenant
  on public.tenant_public_units (tenant_id, is_published, display_order);

create index if not exists idx_tenant_public_ppid_tenant
  on public.tenant_public_ppid (tenant_id, is_published);

create index if not exists idx_tenant_public_documents_tenant
  on public.tenant_public_documents (tenant_id, is_published, display_order);

alter table public.tenant_public_profiles enable row level security;
alter table public.tenant_public_organizational_members enable row level security;
alter table public.tenant_public_units enable row level security;
alter table public.tenant_public_ppid enable row level security;
alter table public.tenant_public_documents enable row level security;

drop policy if exists tenant_public_profiles_manage on public.tenant_public_profiles;
create policy tenant_public_profiles_manage
on public.tenant_public_profiles
for all
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
)
with check (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
);

drop policy if exists tenant_public_organizational_members_manage on public.tenant_public_organizational_members;
create policy tenant_public_organizational_members_manage
on public.tenant_public_organizational_members
for all
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
)
with check (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
);

drop policy if exists tenant_public_units_manage on public.tenant_public_units;
create policy tenant_public_units_manage
on public.tenant_public_units
for all
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
)
with check (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
);

drop policy if exists tenant_public_ppid_manage on public.tenant_public_ppid;
create policy tenant_public_ppid_manage
on public.tenant_public_ppid
for all
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
)
with check (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
);

drop policy if exists tenant_public_documents_manage on public.tenant_public_documents;
create policy tenant_public_documents_manage
on public.tenant_public_documents
for all
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
)
with check (
  public.is_super_admin_platform(auth.uid())
  or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
);

create or replace view public.v_public_bumdes_profiles as
select
  p.tenant_id,
  p.public_slug,
  p.hero_title,
  p.hero_subtitle,
  p.tagline,
  p.logo_url,
  p.hero_image_url,
  p.profile_description,
  p.contact_phone,
  p.contact_email,
  p.contact_address,
  p.about_history,
  p.vision,
  p.mission,
  p.service_goals,
  t.nama_bumdes,
  t.kode_bumdes,
  t.nama_desa,
  t.nama_kecamatan,
  p.updated_at
from public.tenant_public_profiles p
join public.tenants t on t.id = p.tenant_id
where p.is_published = true;

create or replace view public.v_public_bumdes_organizational_members as
select
  m.tenant_id,
  p.public_slug,
  m.id,
  m.name,
  m.position,
  m.role_group,
  m.photo_url,
  m.display_order
from public.tenant_public_organizational_members m
join public.tenant_public_profiles p on p.tenant_id = m.tenant_id
where p.is_published = true
  and m.is_published = true;

create or replace view public.v_public_bumdes_units as
select
  pu.tenant_id,
  p.public_slug,
  bu.id as unit_id,
  bu.kode_unit,
  bu.nama_unit,
  bu.jenis_unit,
  bu.status,
  pu.public_description,
  pu.image_url,
  pu.display_order
from public.tenant_public_units pu
join public.tenant_public_profiles p on p.tenant_id = pu.tenant_id
join public.business_units bu on bu.id = pu.unit_id and bu.tenant_id = pu.tenant_id
where p.is_published = true
  and pu.is_published = true
  and bu.status = 'aktif'::public.unit_status;

create or replace view public.v_public_bumdes_ppid as
select
  pp.tenant_id,
  p.public_slug,
  pp.officer_name,
  pp.officer_position,
  pp.service_phone,
  pp.service_email,
  pp.service_address,
  pp.service_hours,
  pp.request_procedure,
  pp.objection_procedure
from public.tenant_public_ppid pp
join public.tenant_public_profiles p on p.tenant_id = pp.tenant_id
where p.is_published = true
  and pp.is_published = true;

create or replace view public.v_public_bumdes_documents as
select
  d.tenant_id,
  p.public_slug,
  d.id,
  d.title,
  d.description,
  d.document_category,
  d.file_url,
  d.display_order
from public.tenant_public_documents d
join public.tenant_public_profiles p on p.tenant_id = d.tenant_id
where p.is_published = true
  and d.is_published = true;

grant select on public.v_public_bumdes_profiles to anon, authenticated;
grant select on public.v_public_bumdes_organizational_members to anon, authenticated;
grant select on public.v_public_bumdes_units to anon, authenticated;
grant select on public.v_public_bumdes_ppid to anon, authenticated;
grant select on public.v_public_bumdes_documents to anon, authenticated;

grant select, insert, update, delete on public.tenant_public_profiles to authenticated;
grant select, insert, update, delete on public.tenant_public_organizational_members to authenticated;
grant select, insert, update, delete on public.tenant_public_units to authenticated;
grant select, insert, update, delete on public.tenant_public_ppid to authenticated;
grant select, insert, update, delete on public.tenant_public_documents to authenticated;

notify pgrst, 'reload schema';