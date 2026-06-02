-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000040_login_context_profile_fallback.sql
-- Purpose : Make login context work even when profile row is not yet created.
-- Notes   :
-- - Fresh-install/login bootstrap compatibility patch.
-- - Keeps redirect semantics unchanged.
-- - Uses user_roles as source of truth, with profiles as optional enrichment.
-- ============================================================

begin;

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
set search_path = public
as $function$
begin
  return query
  select
    ur.user_id as user_id,
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
  from public.user_roles ur
  left join public.profiles p
    on p.id = ur.user_id
  where ur.user_id = p_user_id
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

grant execute on function public.get_user_login_context(uuid)
  to authenticated, service_role;

commit;