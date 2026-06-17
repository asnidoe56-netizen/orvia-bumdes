-- ORVIA AI tenant access governance
-- Additive-only migration.
-- This migration does not mutate accounting, journal, ledger, inventory, cash/bank, or transaction posting data.

do $$
begin
  if to_regclass('public.tenants') is null then
    raise exception 'Table public.tenants does not exist';
  end if;

  if to_regclass('public.user_roles') is null then
    raise exception 'Table public.user_roles does not exist';
  end if;
end $$;

create table if not exists public.orvia_ai_tenant_access (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  is_enabled boolean not null default false,
  notes text null,

  enabled_by uuid null references auth.users(id),
  enabled_at timestamptz null,
  disabled_by uuid null references auth.users(id),
  disabled_at timestamptz null,

  updated_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orvia_ai_tenant_access_tenant_unique unique (tenant_id)
);

create index if not exists orvia_ai_tenant_access_tenant_id_idx
on public.orvia_ai_tenant_access (tenant_id);

create index if not exists orvia_ai_tenant_access_is_enabled_idx
on public.orvia_ai_tenant_access (is_enabled);

alter table public.orvia_ai_tenant_access enable row level security;

grant select, insert, update on table public.orvia_ai_tenant_access to authenticated;

drop policy if exists orvia_ai_tenant_access_select_by_platform on public.orvia_ai_tenant_access;

create policy orvia_ai_tenant_access_select_by_platform
on public.orvia_ai_tenant_access
for select
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
);

drop policy if exists orvia_ai_tenant_access_insert_by_platform on public.orvia_ai_tenant_access;

create policy orvia_ai_tenant_access_insert_by_platform
on public.orvia_ai_tenant_access
for insert
to authenticated
with check (
  public.is_super_admin_platform(auth.uid())
);

drop policy if exists orvia_ai_tenant_access_update_by_platform on public.orvia_ai_tenant_access;

create policy orvia_ai_tenant_access_update_by_platform
on public.orvia_ai_tenant_access
for update
to authenticated
using (
  public.is_super_admin_platform(auth.uid())
)
with check (
  public.is_super_admin_platform(auth.uid())
);

create or replace function public.is_orvia_ai_enabled_for_tenant(
  p_tenant_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_enabled boolean := false;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_tenant_id is null then
    return false;
  end if;

  if not public.is_super_admin_platform(auth.uid())
    and not exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.tenant_id = p_tenant_id
        and ur.role in (
          'direktur_bumdes'::public.app_role,
          'admin_bumdes'::public.app_role,
          'manager_unit'::public.app_role,
          'operator_unit'::public.app_role,
          'viewer_unit'::public.app_role,
          'pengawas'::public.app_role
        )
    )
  then
    return false;
  end if;

  select coalesce(a.is_enabled, false)
  into v_enabled
  from public.tenants t
  left join public.orvia_ai_tenant_access a on a.tenant_id = t.id
  where t.id = p_tenant_id
    and t.status = 'active'::public.tenant_status;

  return coalesce(v_enabled, false);
end;
$function$;

grant execute on function public.is_orvia_ai_enabled_for_tenant(uuid) to authenticated;

create or replace function public.set_orvia_ai_tenant_access(
  p_tenant_id uuid,
  p_is_enabled boolean,
  p_notes text default null
)
returns table (
  tenant_id uuid,
  is_enabled boolean,
  notes text,
  enabled_at timestamptz,
  disabled_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid := auth.uid();
begin
  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if not public.is_super_admin_platform(v_actor_id) then
    raise exception 'Hanya Super Admin Platform yang boleh mengatur izin ORVIA AI';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant tidak valid';
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
  ) then
    raise exception 'Tenant tidak ditemukan';
  end if;

  insert into public.orvia_ai_tenant_access (
    tenant_id,
    is_enabled,
    notes,
    enabled_by,
    enabled_at,
    disabled_by,
    disabled_at,
    updated_by,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_is_enabled, false),
    nullif(trim(coalesce(p_notes, '')), ''),
    case when coalesce(p_is_enabled, false) then v_actor_id else null end,
    case when coalesce(p_is_enabled, false) then now() else null end,
    case when not coalesce(p_is_enabled, false) then v_actor_id else null end,
    case when not coalesce(p_is_enabled, false) then now() else null end,
    v_actor_id,
    now()
  )
  on conflict (tenant_id)
  do update set
    is_enabled = excluded.is_enabled,
    notes = excluded.notes,
    enabled_by = case
      when excluded.is_enabled then v_actor_id
      else public.orvia_ai_tenant_access.enabled_by
    end,
    enabled_at = case
      when excluded.is_enabled then now()
      else public.orvia_ai_tenant_access.enabled_at
    end,
    disabled_by = case
      when not excluded.is_enabled then v_actor_id
      else public.orvia_ai_tenant_access.disabled_by
    end,
    disabled_at = case
      when not excluded.is_enabled then now()
      else public.orvia_ai_tenant_access.disabled_at
    end,
    updated_by = v_actor_id,
    updated_at = now();

  return query
  select
    a.tenant_id,
    a.is_enabled,
    a.notes,
    a.enabled_at,
    a.disabled_at,
    a.updated_at
  from public.orvia_ai_tenant_access a
  where a.tenant_id = p_tenant_id;
end;
$function$;

grant execute on function public.set_orvia_ai_tenant_access(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';