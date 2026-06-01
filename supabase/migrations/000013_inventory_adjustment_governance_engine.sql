-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000013_inventory_adjustment_governance_engine.sql
--
-- Scope:
-- - Inventory adjustment header
-- - Inventory adjustment lines
-- - Request / approve / reject / post inventory adjustment
-- - Posted adjustment mutation guard
-- - Adjustment line scope validation
--
-- Depends on:
-- - 000007 audit timeline engine
-- - 000012 inventory item master engine
--
-- Deferred:
-- - Purchase invoice engine
-- - Sales invoice engine
-- - Financial journal posting for inventory adjustment
-- ============================================================

begin;

-- ============================================================
-- 1. INVENTORY ADJUSTMENT HEADER
-- ============================================================

create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  adjustment_no text not null,
  adjustment_date date not null default current_date,
  reason text,
  status text not null default 'draft',

  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz,

  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,

  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,

  posted_by uuid references auth.users(id) on delete set null,
  posted_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_adjustments_no_not_blank
    check (btrim(adjustment_no) <> ''),

  constraint inventory_adjustments_status_check
    check (
      status in (
        'draft',
        'pending_approval',
        'approved',
        'rejected',
        'posted'
      )
    ),

  constraint inventory_adjustments_scope_no_unique
    unique (tenant_id, unit_id, adjustment_no)
);

create index if not exists inventory_adjustments_tenant_idx
  on public.inventory_adjustments(tenant_id);

create index if not exists inventory_adjustments_unit_idx
  on public.inventory_adjustments(unit_id);

-- ============================================================
-- 2. INVENTORY ADJUSTMENT LINES
-- ============================================================

create table if not exists public.inventory_adjustment_lines (
  id uuid primary key default gen_random_uuid(),
  adjustment_id uuid not null references public.inventory_adjustments(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  line_no integer not null,
  quantity_before numeric(18,2) not null default 0,
  quantity_adjustment numeric(18,2) not null,
  quantity_after numeric(18,2) not null,
  unit_cost numeric(18,2) not null default 0,
  reason text,
  created_at timestamptz not null default now(),

  constraint inventory_adjustment_lines_line_no_check
    check (line_no > 0),

  constraint inventory_adjustment_lines_unit_cost_check
    check (unit_cost >= 0),

  constraint inventory_adjustment_lines_qty_check
    check (
      quantity_adjustment <> 0
      and quantity_after = (quantity_before + quantity_adjustment)
    ),

  constraint inventory_adjustment_lines_unique
    unique (adjustment_id, line_no)
);

create index if not exists inventory_adjustment_lines_adjustment_idx
  on public.inventory_adjustment_lines(adjustment_id);

create index if not exists inventory_adjustment_lines_item_idx
  on public.inventory_adjustment_lines(item_id);

-- ============================================================
-- 3. ADJUSTMENT LINE SCOPE VALIDATION
-- ============================================================

create or replace function public.validate_inventory_adjustment_line_scope()
returns trigger
language plpgsql
as $function$
declare
  v_adjustment_tenant_id uuid;
  v_adjustment_unit_id uuid;
  v_item_tenant_id uuid;
  v_item_unit_id uuid;
begin
  select ia.tenant_id, ia.unit_id
  into v_adjustment_tenant_id, v_adjustment_unit_id
  from public.inventory_adjustments ia
  where ia.id = new.adjustment_id;

  select ii.tenant_id, ii.unit_id
  into v_item_tenant_id, v_item_unit_id
  from public.inventory_items ii
  where ii.id = new.item_id;

  if v_adjustment_tenant_id <> v_item_tenant_id
    or v_adjustment_unit_id <> v_item_unit_id
  then
    raise exception 'inventory adjustment line scope does not match item scope'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ============================================================
-- 4. POSTED MUTATION GUARD
-- ============================================================

create or replace function public.prevent_posted_inventory_adjustment_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status = 'posted' then
    raise exception 'posted inventory adjustment cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status = 'posted' then
    raise exception 'posted inventory adjustment cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

drop trigger if exists trg_inventory_adjustment_lines_validate_scope
  on public.inventory_adjustment_lines;

create trigger trg_inventory_adjustment_lines_validate_scope
before insert or update on public.inventory_adjustment_lines
for each row
execute function public.validate_inventory_adjustment_line_scope();

drop trigger if exists trg_inventory_adjustments_set_updated_at
  on public.inventory_adjustments;

create trigger trg_inventory_adjustments_set_updated_at
before update on public.inventory_adjustments
for each row
execute function public.set_updated_at();

drop trigger if exists trg_prevent_posted_inventory_adjustment_mutation
  on public.inventory_adjustments;

create trigger trg_prevent_posted_inventory_adjustment_mutation
before delete or update on public.inventory_adjustments
for each row
execute function public.prevent_posted_inventory_adjustment_mutation();

-- ============================================================
-- 6. REQUEST INVENTORY ADJUSTMENT
-- ============================================================

create or replace function public.request_inventory_adjustment(
  p_adjustment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_adjustment public.inventory_adjustments%rowtype;
begin
  select *
  into v_adjustment
  from public.inventory_adjustments
  where id = p_adjustment_id
  for update;

  if v_adjustment.id is null then
    raise exception 'inventory adjustment not found'
      using errcode = '23503';
  end if;

  if v_adjustment.status <> 'draft' then
    raise exception 'only draft adjustment can be requested'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.inventory_adjustment_lines ial
    where ial.adjustment_id = p_adjustment_id
  ) then
    raise exception 'inventory adjustment must have at least one line'
      using errcode = '23514';
  end if;

  update public.inventory_adjustments
  set
    status = 'pending_approval',
    requested_by = auth.uid(),
    requested_at = now()
  where id = p_adjustment_id;

  perform public.log_audit_event(
    v_adjustment.tenant_id,
    v_adjustment.unit_id,
    auth.uid(),
    null,
    'inventory_adjustment_requested',
    'inventory_adjustment',
    p_adjustment_id,
    'inventory_adjustment',
    p_adjustment_id,
    'Inventory adjustment requested',
    '{}'::jsonb
  );

  return p_adjustment_id;
end;
$function$;

-- ============================================================
-- 7. APPROVE INVENTORY ADJUSTMENT
-- ============================================================

create or replace function public.approve_inventory_adjustment(
  p_adjustment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_adjustment public.inventory_adjustments%rowtype;
begin
  select *
  into v_adjustment
  from public.inventory_adjustments
  where id = p_adjustment_id
  for update;

  if v_adjustment.id is null then
    raise exception 'inventory adjustment not found'
      using errcode = '23503';
  end if;

  if v_adjustment.status <> 'pending_approval' then
    raise exception 'only pending adjustment can be approved'
      using errcode = '42501';
  end if;

  update public.inventory_adjustments
  set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now()
  where id = p_adjustment_id;

  perform public.log_audit_event(
    v_adjustment.tenant_id,
    v_adjustment.unit_id,
    auth.uid(),
    null,
    'inventory_adjustment_approved',
    'inventory_adjustment',
    p_adjustment_id,
    'inventory_adjustment',
    p_adjustment_id,
    'Inventory adjustment approved',
    '{}'::jsonb
  );

  return p_adjustment_id;
end;
$function$;

-- ============================================================
-- 8. REJECT INVENTORY ADJUSTMENT
-- ============================================================

create or replace function public.reject_inventory_adjustment(
  p_adjustment_id uuid,
  p_rejection_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_adjustment public.inventory_adjustments%rowtype;
begin
  select *
  into v_adjustment
  from public.inventory_adjustments
  where id = p_adjustment_id
  for update;

  if v_adjustment.id is null then
    raise exception 'inventory adjustment not found'
      using errcode = '23503';
  end if;

  if v_adjustment.status <> 'pending_approval' then
    raise exception 'only pending adjustment can be rejected'
      using errcode = '42501';
  end if;

  update public.inventory_adjustments
  set
    status = 'rejected',
    rejected_by = auth.uid(),
    rejected_at = now(),
    rejection_reason = p_rejection_reason
  where id = p_adjustment_id;

  perform public.log_audit_event(
    v_adjustment.tenant_id,
    v_adjustment.unit_id,
    auth.uid(),
    null,
    'inventory_adjustment_rejected',
    'inventory_adjustment',
    p_adjustment_id,
    'inventory_adjustment',
    p_adjustment_id,
    'Inventory adjustment rejected',
    jsonb_build_object('reason', p_rejection_reason)
  );

  return p_adjustment_id;
end;
$function$;

-- ============================================================
-- 9. POST INVENTORY ADJUSTMENT
-- ============================================================

create or replace function public.post_inventory_adjustment(
  p_adjustment_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_adjustment public.inventory_adjustments%rowtype;
  v_line record;
begin
  select *
  into v_adjustment
  from public.inventory_adjustments
  where id = p_adjustment_id
  for update;

  if v_adjustment.id is null then
    raise exception 'inventory adjustment not found'
      using errcode = '23503';
  end if;

  if v_adjustment.status <> 'approved' then
    raise exception 'only approved adjustment can be posted'
      using errcode = '42501';
  end if;

  for v_line in
    select *
    from public.inventory_adjustment_lines
    where adjustment_id = p_adjustment_id
    order by line_no
  loop
    if exists (
      select 1
      from public.inventory_movements im
      where im.source_type = 'inventory_adjustment_line'
        and im.source_id = v_line.id
    ) then
      raise exception 'inventory adjustment line already posted: %', v_line.id
        using errcode = '23505';
    end if;

    insert into public.inventory_movements (
      tenant_id,
      unit_id,
      item_id,
      movement_date,
      movement_type,
      source_type,
      source_id,
      quantity_in,
      quantity_out,
      unit_cost,
      description,
      created_by
    )
    values (
      v_adjustment.tenant_id,
      v_adjustment.unit_id,
      v_line.item_id,
      v_adjustment.adjustment_date,
      case
        when v_line.quantity_adjustment > 0 then 'adjustment_in'
        else 'adjustment_out'
      end,
      'inventory_adjustment_line',
      v_line.id,
      greatest(v_line.quantity_adjustment, 0),
      abs(least(v_line.quantity_adjustment, 0)),
      v_line.unit_cost,
      coalesce(v_line.reason, v_adjustment.reason),
      auth.uid()
    );
  end loop;

  update public.inventory_adjustments
  set
    status = 'posted',
    posted_by = auth.uid(),
    posted_at = now()
  where id = p_adjustment_id;

  perform public.log_audit_event(
    v_adjustment.tenant_id,
    v_adjustment.unit_id,
    auth.uid(),
    null,
    'inventory_adjustment_posted',
    'inventory_adjustment',
    p_adjustment_id,
    'inventory_adjustment',
    p_adjustment_id,
    'Inventory adjustment posted',
    '{}'::jsonb
  );

  return p_adjustment_id;
end;
$function$;

-- ============================================================
-- 10. GRANTS
-- ============================================================

grant select, insert, update on public.inventory_adjustments
  to authenticated, service_role;

grant select, insert, update on public.inventory_adjustment_lines
  to authenticated, service_role;

grant execute on function public.request_inventory_adjustment(uuid)
  to authenticated, service_role;

grant execute on function public.approve_inventory_adjustment(uuid)
  to authenticated, service_role;

grant execute on function public.reject_inventory_adjustment(uuid, text)
  to authenticated, service_role;

grant execute on function public.post_inventory_adjustment(uuid)
  to authenticated, service_role;

commit;
