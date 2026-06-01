-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000038_audit_helper_compatibility.sql
-- Purpose : Audit helper compatibility for legacy 6-argument calls.
-- Notes   :
-- - Compatibility patch only.
-- - Does not change audit_timeline table structure.
-- - Does not change proven business flow semantics.
-- - Supports older engine calls:
--   log_audit_event(tenant_id, unit_id, event_type, entity_type, entity_id, metadata)
-- ============================================================

begin;

create or replace function public.log_audit_event(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_metadata jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
begin
  v_actor_id := auth.uid();

  if v_actor_id is not null then
    select ur.role
    into v_actor_role
    from public.user_roles ur
    where ur.user_id = v_actor_id
      and (
        ur.unit_id is not distinct from p_unit_id
        or ur.tenant_id is not distinct from p_tenant_id
        or ur.role = 'super_admin_platform'::public.app_role
      )
    order by
      case
        when ur.unit_id is not distinct from p_unit_id then 1
        when ur.tenant_id is not distinct from p_tenant_id then 2
        when ur.role = 'super_admin_platform'::public.app_role then 3
        else 4
      end
    limit 1;
  end if;

  return public.log_audit_event(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := p_event_type,
    p_entity_type := p_entity_type,
    p_entity_id := p_entity_id,
    p_source_type := p_entity_type,
    p_source_id := p_entity_id,
    p_description := p_event_type,
    p_metadata := coalesce(p_metadata, '{}'::jsonb)
  );
end;
$function$;

grant execute on function public.log_audit_event(
  uuid,
  uuid,
  text,
  text,
  uuid,
  jsonb
) to authenticated, service_role;

commit;