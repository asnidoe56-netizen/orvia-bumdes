-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000003_auth_roles_permissions.sql
-- Purpose : Permission tables, role-permission mapping foundation,
--           auth helper functions, permission guards, and login context.
-- Notes   : Baseline extracted from active development database.
-- Depends : 000001_extensions_enums.sql
--           000002_core_identity_tenant_unit.sql
-- ============================================================

begin;

-- ============================================================
-- PERMISSIONS
-- ============================================================

create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  module text not null,
  description text,
  created_at timestamptz not null default now(),
  constraint permissions_code_key unique (code)
);

-- ============================================================
-- ROLE PERMISSIONS
-- ============================================================

create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role public.app_role not null,
  permission_id uuid not null,
  created_at timestamptz not null default now(),
  constraint role_permissions_permission_id_fkey
    foreign key (permission_id) references public.permissions(id) on delete cascade,
  constraint role_permissions_unique unique (role, permission_id)
);

-- ============================================================
-- HELPER: UNIT TENANT RESOLUTION
-- ============================================================

create or replace function public.unit_tenant_id(
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
begin
  select bu.tenant_id
  into v_tenant_id
  from public.business_units bu
  where bu.id = p_unit_id;

  return v_tenant_id;
end;
$function$;

-- ============================================================
-- HELPER: SUPER ADMIN CHECK
-- ============================================================

create or replace function public.is_super_admin_platform(
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = 'super_admin_platform'::public.app_role
  );
end;
$function$;

-- ============================================================
-- HELPER: ROLE CHECK
-- ============================================================

create or replace function public.has_role(
  p_role public.app_role,
  p_user_id uuid default auth.uid(),
  p_tenant_id uuid default null::uuid,
  p_unit_id uuid default null::uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return exists (
    select 1
    from public.user_roles ur
    where ur.user_id = p_user_id
      and ur.role = p_role
      and (p_tenant_id is null or ur.tenant_id = p_tenant_id)
      and (p_unit_id is null or ur.unit_id = p_unit_id)
  );
end;
$function$;

-- ============================================================
-- HELPER: PERMISSION CHECK
-- ============================================================

create or replace function public.has_permission(
  p_permission_code text,
  p_user_id uuid default auth.uid(),
  p_tenant_id uuid default null::uuid,
  p_unit_id uuid default null::uuid
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_unit_tenant_id uuid;
begin
  if p_user_id is null then
    return false;
  end if;

  if public.is_super_admin_platform(p_user_id) then
    return true;
  end if;

  if p_unit_id is not null then
    v_unit_tenant_id := public.unit_tenant_id(p_unit_id);

    if v_unit_tenant_id is null then
      return false;
    end if;

    if p_tenant_id is not null and v_unit_tenant_id is distinct from p_tenant_id then
      return false;
    end if;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp
      on rp.role = ur.role
    join public.permissions p
      on p.id = rp.permission_id
    where ur.user_id = p_user_id
      and p.code = p_permission_code
      and (
        p_tenant_id is null
        or ur.tenant_id = p_tenant_id
        or (
          ur.role = 'pendamping_kecamatan'::public.app_role
          and ur.tenant_id is null
          and ur.unit_id is null
        )
      )
      and (
        p_unit_id is null
        or ur.unit_id = p_unit_id
        or (
          ur.unit_id is null
          and ur.tenant_id = v_unit_tenant_id
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

-- ============================================================
-- HELPER: PERMISSION ASSERTION
-- ============================================================

create or replace function public.assert_user_has_permission(
  p_permission_code text,
  p_user_id uuid default auth.uid(),
  p_tenant_id uuid default null::uuid,
  p_unit_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not public.has_permission(
    p_permission_code,
    p_user_id,
    p_tenant_id,
    p_unit_id
  ) then
    raise exception 'permission denied: %', p_permission_code
      using errcode = '42501';
  end if;
end;
$function$;

-- ============================================================
-- LOGIN CONTEXT
-- ============================================================

create or replace function public.get_user_login_context(
  p_user_id uuid default auth.uid()
)
returns table (
  user_id uuid,
  full_name text,
  default_tenant_id uuid,
  role public.app_role,
  tenant_id uuid,
  unit_id uuid,
  redirect_path text
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  return query
  select
    p.id as user_id,
    p.full_name,
    p.default_tenant_id,
    ur.role,
    ur.tenant_id,
    ur.unit_id,
    case
      when ur.role = 'super_admin_platform'::public.app_role
        then '/platform/dashboard'

      when ur.role = 'bupati'::public.app_role
        then '/bupati/dashboard'

      when ur.role = 'pengawas'::public.app_role
        then '/pengawas/dashboard'

      when ur.role in (
        'direktur_bumdes'::public.app_role,
        'admin_bumdes'::public.app_role
      )
        then '/bumdes/dashboard'

      when ur.role in (
        'manager_unit'::public.app_role,
        'operator_unit'::public.app_role,
        'viewer_unit'::public.app_role
      )
        then '/unit/dashboard'

      when ur.role = 'pendamping_kecamatan'::public.app_role
        then '/pendamping/dashboard'

      else '/login'
    end as redirect_path
  from public.profiles p
  join public.user_roles ur
    on ur.user_id = p.id
  where p.id = p_user_id
  order by
    case ur.role
      when 'super_admin_platform'::public.app_role then 1
      when 'bupati'::public.app_role then 2
      when 'pengawas'::public.app_role then 3
      when 'direktur_bumdes'::public.app_role then 4
      when 'admin_bumdes'::public.app_role then 5
      when 'manager_unit'::public.app_role then 6
      when 'operator_unit'::public.app_role then 7
      when 'viewer_unit'::public.app_role then 8
      when 'pendamping_kecamatan'::public.app_role then 9
      else 99
    end
  limit 1;
end;
$function$;

-- ============================================================
-- GRANTS
-- ============================================================

grant execute on function public.unit_tenant_id(uuid) to authenticated, service_role;
grant execute on function public.is_super_admin_platform(uuid) to authenticated, service_role;
grant execute on function public.has_role(public.app_role, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.has_permission(text, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.assert_user_has_permission(text, uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.get_user_login_context(uuid) to authenticated, service_role;

commit;
