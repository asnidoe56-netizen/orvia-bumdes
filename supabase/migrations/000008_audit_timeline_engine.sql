-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000007_audit_timeline_engine.sql
--
-- Scope:
-- - Global audit timeline table
-- - Append-only audit guard
-- - Audit logging helper function
-- - Indexes and grants
--
-- Notes:
-- - Fresh-install baseline.
-- - Module-specific audit views are deferred to their own modules/reporting migrations.
-- - Journal correction audit is deferred to 000024.
-- ============================================================

begin;

-- ============================================================
-- 1. AUDIT TIMELINE TABLE
-- ============================================================

create table if not exists public.audit_timeline (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  source_type text,
  source_id uuid,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_timeline_event_type_not_blank
    check (btrim(event_type) <> ''),
  constraint audit_timeline_entity_type_not_blank
    check (btrim(entity_type) <> ''),
  constraint audit_timeline_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

create index if not exists audit_timeline_tenant_idx
  on public.audit_timeline(tenant_id);

create index if not exists audit_timeline_unit_idx
  on public.audit_timeline(unit_id);

create index if not exists audit_timeline_actor_idx
  on public.audit_timeline(actor_id);

create index if not exists audit_timeline_entity_idx
  on public.audit_timeline(entity_type, entity_id);

create index if not exists audit_timeline_source_idx
  on public.audit_timeline(source_type, source_id);

create index if not exists audit_timeline_created_at_idx
  on public.audit_timeline(created_at desc);

create index if not exists audit_timeline_event_type_idx
  on public.audit_timeline(event_type);

-- ============================================================
-- 2. APPEND-ONLY GUARD
-- ============================================================

create or replace function public.prevent_audit_timeline_mutation()
returns trigger
language plpgsql
as $function$
begin
  raise exception 'audit timeline is append-only and cannot be updated or deleted'
    using errcode = '42501';
end;
$function$;

drop trigger if exists trg_prevent_audit_timeline_mutation on public.audit_timeline;
create trigger trg_prevent_audit_timeline_mutation
before update or delete on public.audit_timeline
for each row
execute function public.prevent_audit_timeline_mutation();

-- ============================================================
-- 3. GLOBAL AUDIT HELPER
-- ============================================================

create or replace function public.log_audit_event(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_actor_id uuid,
  p_actor_role public.app_role,
  p_event_type text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_source_type text default null,
  p_source_id uuid default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_audit_id uuid;
begin
  if p_event_type is null or btrim(p_event_type) = '' then
    raise exception 'event_type audit wajib diisi';
  end if;

  if p_entity_type is null or btrim(p_entity_type) = '' then
    raise exception 'entity_type audit wajib diisi';
  end if;

  if p_metadata is not null and jsonb_typeof(p_metadata) <> 'object' then
    raise exception 'metadata audit harus berupa json object';
  end if;

  insert into public.audit_timeline (
    tenant_id,
    unit_id,
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    source_type,
    source_id,
    description,
    metadata
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_actor_id,
    p_actor_role,
    p_event_type,
    p_entity_type,
    p_entity_id,
    p_source_type,
    p_source_id,
    p_description,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_audit_id;

  return v_audit_id;
end;
$function$;

-- ============================================================
-- 4. GRANTS
-- ============================================================

grant select, insert on public.audit_timeline
  to authenticated, service_role;

grant execute on function public.log_audit_event(
  uuid,
  uuid,
  uuid,
  public.app_role,
  text,
  text,
  uuid,
  text,
  uuid,
  text,
  jsonb
) to authenticated, service_role;

grant execute on function public.prevent_audit_timeline_mutation()
  to authenticated, service_role;

commit;
