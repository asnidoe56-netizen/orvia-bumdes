-- User Presence Engine
-- Tracks last activity for authenticated users and exposes platform-level online user monitoring.

create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role null,
  tenant_id uuid null references public.tenants(id) on delete set null,
  unit_id uuid null references public.business_units(id) on delete set null,
  current_path text null,
  page_title text null,
  user_agent text null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_presence_last_seen_at
  on public.user_presence(last_seen_at desc);

create index if not exists idx_user_presence_tenant_id
  on public.user_presence(tenant_id);

create index if not exists idx_user_presence_role
  on public.user_presence(role);

alter table public.user_presence enable row level security;

drop policy if exists "Users can read own presence" on public.user_presence;
create policy "Users can read own presence"
on public.user_presence
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Platform admins can read all presence" on public.user_presence;
create policy "Platform admins can read all presence"
on public.user_presence
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = 'super_admin_platform'::public.app_role
  )
);

create or replace function public.touch_user_presence(
  p_current_path text default null,
  p_page_title text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_role public.app_role;
  v_tenant_id uuid;
  v_unit_id uuid;
begin
  if v_user_id is null then
    return;
  end if;

  select ur.role, ur.tenant_id, ur.unit_id
    into v_role, v_tenant_id, v_unit_id
  from public.user_roles ur
  where ur.user_id = v_user_id
  order by
    case ur.role
      when 'super_admin_platform'::public.app_role then 1
      when 'direktur_bumdes'::public.app_role then 2
      when 'admin_bumdes'::public.app_role then 3
      when 'manager_unit'::public.app_role then 4
      when 'operator_unit'::public.app_role then 5
      when 'viewer_unit'::public.app_role then 6
      when 'pendamping_kecamatan'::public.app_role then 7
      when 'pengawas'::public.app_role then 8
      when 'bupati'::public.app_role then 9
      else 99
    end,
    ur.created_at asc
  limit 1;

  insert into public.user_presence (
    user_id,
    role,
    tenant_id,
    unit_id,
    current_path,
    page_title,
    user_agent,
    first_seen_at,
    last_seen_at,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_role,
    v_tenant_id,
    v_unit_id,
    nullif(left(coalesce(p_current_path, ''), 500), ''),
    nullif(left(coalesce(p_page_title, ''), 200), ''),
    nullif(left(coalesce(p_user_agent, ''), 500), ''),
    now(),
    now(),
    now(),
    now()
  )
  on conflict (user_id)
  do update set
    role = excluded.role,
    tenant_id = excluded.tenant_id,
    unit_id = excluded.unit_id,
    current_path = excluded.current_path,
    page_title = excluded.page_title,
    user_agent = excluded.user_agent,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

revoke all on function public.touch_user_presence(text, text, text) from public;
grant execute on function public.touch_user_presence(text, text, text) to authenticated;

create or replace view public.v_platform_online_users as
select
  up.user_id,
  au.email,
  p.full_name,
  p.phone,
  up.role,
  up.tenant_id,
  t.nama_bumdes,
  t.nama_desa,
  t.nama_kecamatan,
  up.unit_id,
  bu.nama_unit,
  up.current_path,
  up.page_title,
  up.first_seen_at,
  up.last_seen_at,
  extract(epoch from (now() - up.last_seen_at))::integer as seconds_since_seen,
  (up.last_seen_at >= now() - interval '5 minutes') as is_online
from public.user_presence up
left join auth.users au on au.id = up.user_id
left join public.profiles p on p.id = up.user_id
left join public.tenants t on t.id = up.tenant_id
left join public.business_units bu on bu.id = up.unit_id;

create or replace function public.get_platform_online_users(
  p_online_window_minutes integer default 5
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  role public.app_role,
  tenant_id uuid,
  nama_bumdes text,
  nama_desa text,
  nama_kecamatan text,
  unit_id uuid,
  nama_unit text,
  current_path text,
  page_title text,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  seconds_since_seen integer,
  is_online boolean
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_window_minutes integer := greatest(coalesce(p_online_window_minutes, 5), 1);
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_user_id
      and ur.role = 'super_admin_platform'::public.app_role
  ) then
    raise exception 'Only platform admins can view online users.';
  end if;

  return query
  select
    up.user_id,
    au.email::text,
    p.full_name,
    p.phone,
    up.role,
    up.tenant_id,
    t.nama_bumdes,
    t.nama_desa,
    t.nama_kecamatan,
    up.unit_id,
    bu.nama_unit,
    up.current_path,
    up.page_title,
    up.first_seen_at,
    up.last_seen_at,
    extract(epoch from (now() - up.last_seen_at))::integer as seconds_since_seen,
    (up.last_seen_at >= now() - make_interval(mins => v_window_minutes)) as is_online
  from public.user_presence up
  left join auth.users au on au.id = up.user_id
  left join public.profiles p on p.id = up.user_id
  left join public.tenants t on t.id = up.tenant_id
  left join public.business_units bu on bu.id = up.unit_id
  order by
    (up.last_seen_at >= now() - make_interval(mins => v_window_minutes)) desc,
    up.last_seen_at desc;
end;
$$;

revoke all on function public.get_platform_online_users(integer) from public;
grant execute on function public.get_platform_online_users(integer) to authenticated;

revoke all on public.v_platform_online_users from public;
revoke all on public.v_platform_online_users from anon;
revoke all on public.v_platform_online_users from authenticated;
