-- Transaction assistant tenant access governance
-- Additive-only migration.
-- This migration does not mutate accounting, journal, ledger, inventory, cash/bank, or transaction posting data.

do $$
begin
  if to_regclass('public.orvia_ai_tenant_access') is null then
    raise exception 'Table public.orvia_ai_tenant_access does not exist';
  end if;

  if to_regclass('public.tenants') is null then
    raise exception 'Table public.tenants does not exist';
  end if;

  if to_regclass('public.user_roles') is null then
    raise exception 'Table public.user_roles does not exist';
  end if;
end $$;

alter table public.orvia_ai_tenant_access
  add column if not exists transaction_assistant_enabled boolean not null default true,
  add column if not exists transaction_assistant_notes text null,
  add column if not exists transaction_assistant_enabled_by uuid null references auth.users(id),
  add column if not exists transaction_assistant_enabled_at timestamptz null,
  add column if not exists transaction_assistant_disabled_by uuid null references auth.users(id),
  add column if not exists transaction_assistant_disabled_at timestamptz null;

create index if not exists orvia_ai_tenant_access_transaction_assistant_enabled_idx
on public.orvia_ai_tenant_access (transaction_assistant_enabled);

create or replace function public.is_transaction_assistant_enabled_for_tenant(
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

  select coalesce(a.transaction_assistant_enabled, true)
  into v_enabled
  from public.tenants t
  left join public.orvia_ai_tenant_access a on a.tenant_id = t.id
  where t.id = p_tenant_id
    and t.status = 'active'::public.tenant_status;

  return coalesce(v_enabled, false);
end;
$function$;

grant execute on function public.is_transaction_assistant_enabled_for_tenant(uuid) to authenticated;

create or replace function public.set_transaction_assistant_tenant_access(
  p_tenant_id uuid,
  p_is_enabled boolean,
  p_notes text default null
)
returns table (
  tenant_id uuid,
  transaction_assistant_enabled boolean,
  transaction_assistant_notes text,
  transaction_assistant_enabled_at timestamptz,
  transaction_assistant_disabled_at timestamptz,
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
    raise exception 'Hanya Super Admin Platform yang boleh mengatur izin Asisten Catat Transaksi';
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
    transaction_assistant_enabled,
    transaction_assistant_notes,
    transaction_assistant_enabled_by,
    transaction_assistant_enabled_at,
    transaction_assistant_disabled_by,
    transaction_assistant_disabled_at,
    updated_by,
    updated_at
  )
  values (
    p_tenant_id,
    coalesce(p_is_enabled, true),
    nullif(trim(coalesce(p_notes, '')), ''),
    case when coalesce(p_is_enabled, true) then v_actor_id else null end,
    case when coalesce(p_is_enabled, true) then now() else null end,
    case when not coalesce(p_is_enabled, true) then v_actor_id else null end,
    case when not coalesce(p_is_enabled, true) then now() else null end,
    v_actor_id,
    now()
  )
  on conflict (tenant_id)
  do update set
    transaction_assistant_enabled = excluded.transaction_assistant_enabled,
    transaction_assistant_notes = excluded.transaction_assistant_notes,
    transaction_assistant_enabled_by = case
      when excluded.transaction_assistant_enabled then v_actor_id
      else public.orvia_ai_tenant_access.transaction_assistant_enabled_by
    end,
    transaction_assistant_enabled_at = case
      when excluded.transaction_assistant_enabled then now()
      else public.orvia_ai_tenant_access.transaction_assistant_enabled_at
    end,
    transaction_assistant_disabled_by = case
      when not excluded.transaction_assistant_enabled then v_actor_id
      else public.orvia_ai_tenant_access.transaction_assistant_disabled_by
    end,
    transaction_assistant_disabled_at = case
      when not excluded.transaction_assistant_enabled then now()
      else public.orvia_ai_tenant_access.transaction_assistant_disabled_at
    end,
    updated_by = v_actor_id,
    updated_at = now();

  return query
  select
    a.tenant_id,
    a.transaction_assistant_enabled,
    a.transaction_assistant_notes,
    a.transaction_assistant_enabled_at,
    a.transaction_assistant_disabled_at,
    a.updated_at
  from public.orvia_ai_tenant_access a
  where a.tenant_id = p_tenant_id;
end;
$function$;

grant execute on function public.set_transaction_assistant_tenant_access(uuid, boolean, text) to authenticated;

notify pgrst, 'reload schema';