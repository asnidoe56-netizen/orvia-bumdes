-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000041_superadmin_profile_auto_bootstrap.sql
-- Purpose : Ensure platform super admin always has a public.profiles row.
-- Notes   :
-- - Prevents tenant approval FK failure on tenants.approved_by.
-- - Keeps user_roles as role source of truth.
-- - Safe for fresh install and existing databases.
-- ============================================================

begin;

create or replace function public.ensure_platform_super_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_full_name text;
begin
  if new.role = 'super_admin_platform'::public.app_role then
    select
      nullif(trim(coalesce(
        au.raw_user_meta_data ->> 'full_name',
        au.raw_user_meta_data ->> 'name',
        au.email
      )), '')
    into v_full_name
    from auth.users au
    where au.id = new.user_id;

    insert into public.profiles (
      id,
      full_name,
      phone,
      default_tenant_id
    )
    values (
      new.user_id,
      coalesce(v_full_name, 'Super Admin Platform'),
      null,
      null
    )
    on conflict (id) do update
    set
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      updated_at = now();
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_ensure_platform_super_admin_profile
on public.user_roles;

create trigger trg_ensure_platform_super_admin_profile
after insert or update of user_id, role
on public.user_roles
for each row
execute function public.ensure_platform_super_admin_profile();

insert into public.profiles (
  id,
  full_name,
  phone,
  default_tenant_id
)
select
  ur.user_id,
  coalesce(
    nullif(trim(coalesce(
      au.raw_user_meta_data ->> 'full_name',
      au.raw_user_meta_data ->> 'name',
      au.email
    )), ''),
    'Super Admin Platform'
  ) as full_name,
  null,
  null
from public.user_roles ur
left join auth.users au
  on au.id = ur.user_id
where ur.role = 'super_admin_platform'::public.app_role
on conflict (id) do update
set
  full_name = coalesce(public.profiles.full_name, excluded.full_name),
  updated_at = now();

commit;