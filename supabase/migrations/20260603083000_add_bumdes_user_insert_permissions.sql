-- Add BUMDes user creation permissions.
-- This mirrors the validated Supabase fix for "+ Tambah Pengguna" on /bumdes/dashboard/users.
-- Scope:
-- - profiles insert/upsert support
-- - user_roles insert for unit users
-- - unit_access_credentials insert for unit access credentials
-- - authenticated table privileges required before RLS policies can apply

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception 'Table public.profiles does not exist';
  end if;

  if to_regclass('public.user_roles') is null then
    raise exception 'Table public.user_roles does not exist';
  end if;

  if to_regclass('public.unit_access_credentials') is null then
    raise exception 'Table public.unit_access_credentials does not exist';
  end if;

  if to_regclass('public.business_units') is null then
    raise exception 'Table public.business_units does not exist';
  end if;
end $$;

grant select, insert on table public.profiles to authenticated;
grant select, insert on table public.user_roles to authenticated;
grant select, insert on table public.unit_access_credentials to authenticated;
grant select on table public.business_units to authenticated;

drop policy if exists profiles_insert_by_bumdes_tenant_admin on public.profiles;

create policy profiles_insert_by_bumdes_tenant_admin
on public.profiles
for insert
to authenticated
with check (
  default_tenant_id is not null
  and (
    public.is_super_admin_platform(auth.uid())
    or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), default_tenant_id, null)
    or public.has_role('admin_bumdes'::public.app_role, auth.uid(), default_tenant_id, null)
  )
);

drop policy if exists user_roles_insert_unit_user_by_bumdes_tenant_admin on public.user_roles;

create policy user_roles_insert_unit_user_by_bumdes_tenant_admin
on public.user_roles
for insert
to authenticated
with check (
  tenant_id is not null
  and unit_id is not null
  and role in (
    'manager_unit'::public.app_role,
    'operator_unit'::public.app_role,
    'viewer_unit'::public.app_role
  )
  and exists (
    select 1
    from public.business_units bu
    where bu.id = user_roles.unit_id
      and bu.tenant_id = user_roles.tenant_id
  )
  and (
    public.is_super_admin_platform(auth.uid())
    or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
    or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  )
);

drop policy if exists unit_access_credentials_insert_by_bumdes_tenant_admin on public.unit_access_credentials;

create policy unit_access_credentials_insert_by_bumdes_tenant_admin
on public.unit_access_credentials
for insert
to authenticated
with check (
  tenant_id is not null
  and unit_id is not null
  and user_id is not null
  and email_virtual is not null
  and login_code is not null
  and role in (
    'manager_unit'::public.app_role,
    'operator_unit'::public.app_role,
    'viewer_unit'::public.app_role
  )
  and exists (
    select 1
    from public.business_units bu
    where bu.id = unit_access_credentials.unit_id
      and bu.tenant_id = unit_access_credentials.tenant_id
  )
  and (
    public.is_super_admin_platform(auth.uid())
    or public.has_role('direktur_bumdes'::public.app_role, auth.uid(), tenant_id, null)
    or public.has_role('admin_bumdes'::public.app_role, auth.uid(), tenant_id, null)
  )
);
