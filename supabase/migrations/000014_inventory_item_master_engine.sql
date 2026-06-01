-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000012_inventory_item_master_engine.sql
--
-- Scope:
-- - Inventory item master
-- - Inventory movement ledger
-- - Stock helper functions
-- - Unit cost helper function
-- - Movement scope validation
-- - Negative stock protection
--
-- Deferred:
-- - Inventory adjustment governance workflow
-- - Inventory adjustment approval/posting functions
-- - Purchase/sales invoice posting engine
-- ============================================================

begin;

-- ============================================================
-- 1. INVENTORY ITEM MASTER
-- ============================================================

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  item_code text not null,
  item_name text not null,
  description text,
  unit_of_measure text not null default 'pcs',
  item_type text not null default 'stock',
  cost_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  inventory_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  sales_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  cogs_account_id uuid references public.chart_of_accounts(id) on delete restrict,
  minimum_stock numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint inventory_items_code_not_blank
    check (btrim(item_code) <> ''),

  constraint inventory_items_name_not_blank
    check (btrim(item_name) <> ''),

  constraint inventory_items_uom_not_blank
    check (btrim(unit_of_measure) <> ''),

  constraint inventory_items_item_type_check
    check (item_type in ('stock', 'service', 'non_stock')),

  constraint inventory_items_minimum_stock_check
    check (minimum_stock >= 0),

  constraint inventory_items_scope_code_unique
    unique (tenant_id, unit_id, item_code)
);

create index if not exists inventory_items_tenant_idx
  on public.inventory_items(tenant_id);

create index if not exists inventory_items_unit_idx
  on public.inventory_items(unit_id);

-- ============================================================
-- 2. INVENTORY MOVEMENT LEDGER
-- ============================================================

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  movement_date date not null default current_date,
  movement_type text not null,
  source_type text,
  source_id uuid,
  quantity_in numeric(18,2) not null default 0,
  quantity_out numeric(18,2) not null default 0,
  unit_cost numeric(18,2) not null default 0,
  total_cost numeric(18,2) not null default 0,
  description text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint inventory_movements_movement_type_check
    check (
      movement_type in (
        'purchase_receipt',
        'sales_delivery',
        'adjustment_in',
        'adjustment_out',
        'transfer_in',
        'transfer_out',
        'opening_balance'
      )
    ),

  constraint inventory_movements_quantity_check
    check (
      quantity_in >= 0
      and quantity_out >= 0
      and not (quantity_in > 0 and quantity_out > 0)
      and (quantity_in > 0 or quantity_out > 0)
    ),

  constraint inventory_movements_unit_cost_check
    check (unit_cost >= 0),

  constraint inventory_movements_total_cost_check
    check (total_cost >= 0)
);

create index if not exists inventory_movements_tenant_idx
  on public.inventory_movements(tenant_id);

create index if not exists inventory_movements_unit_idx
  on public.inventory_movements(unit_id);

create index if not exists inventory_movements_item_idx
  on public.inventory_movements(item_id);

create index if not exists inventory_movements_source_idx
  on public.inventory_movements(source_type, source_id);

-- ============================================================
-- 3. INVENTORY MOVEMENT SCOPE VALIDATION
-- ============================================================

create or replace function public.validate_inventory_movement_scope()
returns trigger
language plpgsql
as $function$
declare
  v_item_tenant_id uuid;
  v_item_unit_id uuid;
begin
  select ii.tenant_id, ii.unit_id
  into v_item_tenant_id, v_item_unit_id
  from public.inventory_items ii
  where ii.id = new.item_id;

  if v_item_tenant_id is null then
    raise exception 'inventory item not found'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_item_tenant_id or new.unit_id <> v_item_unit_id then
    raise exception 'inventory movement scope does not match item scope'
      using errcode = '23514';
  end if;

  new.total_cost = (new.quantity_in + new.quantity_out) * new.unit_cost;

  return new;
end;
$function$;

-- ============================================================
-- 4. NEGATIVE STOCK PROTECTION
-- ============================================================

create or replace function public.prevent_negative_inventory_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_current_stock numeric(18,2);
  v_stock_without_current_row numeric(18,2);
  v_new_stock numeric(18,2);
  v_item_code text;
  v_item_name text;
begin
  if new.quantity_in < 0 then
    raise exception 'Quantity masuk tidak boleh negatif';
  end if;

  if new.quantity_out < 0 then
    raise exception 'Quantity keluar tidak boleh negatif';
  end if;

  if new.quantity_in > 0 and new.quantity_out > 0 then
    raise exception 'Satu mutasi persediaan tidak boleh sekaligus masuk dan keluar';
  end if;

  if new.quantity_out <= 0 then
    return new;
  end if;

  select
    ii.item_code,
    ii.item_name
  into
    v_item_code,
    v_item_name
  from public.inventory_items ii
  where ii.id = new.item_id;

  if tg_op = 'UPDATE' then
    select
      coalesce(sum(im.quantity_in - im.quantity_out), 0)
    into v_stock_without_current_row
    from public.inventory_movements im
    where im.item_id = new.item_id
      and im.id <> old.id;
  else
    select
      coalesce(sum(im.quantity_in - im.quantity_out), 0)
    into v_stock_without_current_row
    from public.inventory_movements im
    where im.item_id = new.item_id;
  end if;

  v_current_stock := coalesce(v_stock_without_current_row, 0);
  v_new_stock := v_current_stock + coalesce(new.quantity_in, 0) - coalesce(new.quantity_out, 0);

  if v_new_stock < 0 then
    raise exception 'Stok tidak mencukupi untuk item % - %. Stok tersedia: %, keluar: %, sisa menjadi: %',
      coalesce(v_item_code, new.item_id::text),
      coalesce(v_item_name, '-'),
      v_current_stock,
      new.quantity_out,
      v_new_stock
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

-- ============================================================
-- 5. TRIGGERS
-- ============================================================

drop trigger if exists trg_inventory_items_set_updated_at on public.inventory_items;
create trigger trg_inventory_items_set_updated_at
before update on public.inventory_items
for each row
execute function public.set_updated_at();

drop trigger if exists trg_inventory_movements_validate_scope on public.inventory_movements;
create trigger trg_inventory_movements_validate_scope
before insert or update on public.inventory_movements
for each row
execute function public.validate_inventory_movement_scope();

drop trigger if exists trg_prevent_negative_inventory_stock_insert on public.inventory_movements;
create trigger trg_prevent_negative_inventory_stock_insert
before insert on public.inventory_movements
for each row
execute function public.prevent_negative_inventory_stock();

drop trigger if exists trg_prevent_negative_inventory_stock_update on public.inventory_movements;
create trigger trg_prevent_negative_inventory_stock_update
before update on public.inventory_movements
for each row
execute function public.prevent_negative_inventory_stock();

-- ============================================================
-- 6. STOCK HELPER
-- ============================================================

create or replace function public.get_inventory_stock(
  p_item_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_stock numeric(18,2);
begin
  select
    coalesce(sum(im.quantity_in - im.quantity_out), 0)
  into v_stock
  from public.inventory_movements im
  where im.item_id = p_item_id;

  return coalesce(v_stock, 0);
end;
$function$;

-- ============================================================
-- 7. UNIT COST HELPER
-- ============================================================

create or replace function public.get_inventory_unit_cost(
  p_item_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_unit_cost numeric(18,2);
begin
  if p_item_id is null then
    raise exception 'Item wajib diisi';
  end if;

  select im.unit_cost
  into v_unit_cost
  from public.inventory_movements im
  where im.item_id = p_item_id
    and im.quantity_in > 0
    and im.unit_cost > 0
  order by
    im.movement_date desc,
    im.created_at desc
  limit 1;

  if v_unit_cost is null or v_unit_cost <= 0 then
    raise exception 'Harga pokok item belum tersedia dari mutasi barang masuk';
  end if;

  return v_unit_cost;
end;
$function$;

-- ============================================================
-- 8. CREATE INVENTORY ITEM RPC
-- ============================================================

create or replace function public.create_inventory_item(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_item_code text,
  p_item_name text,
  p_description text default null,
  p_unit_of_measure text default 'pcs',
  p_item_type text default 'stock',
  p_minimum_stock numeric default 0,
  p_inventory_account_id uuid default null,
  p_sales_account_id uuid default null,
  p_cogs_account_id uuid default null,
  p_cost_account_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_item_id uuid;
  v_actor_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if not public.can_access_unit(p_unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'inventory.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(p_item_code), '') is null then
    raise exception 'Kode item wajib diisi';
  end if;

  if nullif(trim(p_item_name), '') is null then
    raise exception 'Nama item wajib diisi';
  end if;

  if nullif(trim(p_unit_of_measure), '') is null then
    raise exception 'Satuan item wajib diisi';
  end if;

  if p_item_type not in ('stock', 'service', 'non_stock') then
    raise exception 'Tipe item tidak valid. Gunakan stock, service, atau non_stock';
  end if;

  if coalesce(p_minimum_stock, 0) < 0 then
    raise exception 'Minimum stok tidak boleh negatif';
  end if;

  if exists (
    select 1
    from public.inventory_items ii
    where ii.tenant_id = p_tenant_id
      and ii.unit_id = p_unit_id
      and ii.item_code = upper(trim(p_item_code))
  ) then
    raise exception 'Kode item sudah digunakan dalam unit ini';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = p_unit_id
      or ur.tenant_id = p_tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'manager_unit' then 1
      when ur.role = 'operator_unit' then 2
      when ur.role = 'direktur_bumdes' then 3
      when ur.role = 'admin_bumdes' then 4
      when ur.role = 'super_admin_platform' then 5
      else 6
    end
  limit 1;

  insert into public.inventory_items (
    tenant_id,
    unit_id,
    item_code,
    item_name,
    description,
    unit_of_measure,
    item_type,
    cost_account_id,
    inventory_account_id,
    sales_account_id,
    cogs_account_id,
    minimum_stock,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(trim(p_item_code)),
    trim(p_item_name),
    nullif(trim(coalesce(p_description, '')), ''),
    lower(trim(p_unit_of_measure)),
    p_item_type,
    p_cost_account_id,
    p_inventory_account_id,
    p_sales_account_id,
    p_cogs_account_id,
    coalesce(p_minimum_stock, 0),
    true,
    auth.uid()
  )
  returning id into v_item_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'inventory_item_created'::text,
    'inventory_items'::text,
    v_item_id,
    'unit_dashboard'::text,
    v_item_id,
    'Master item persediaan dibuat.'::text,
    jsonb_build_object(
      'item_id', v_item_id,
      'item_code', upper(trim(p_item_code)),
      'item_name', trim(p_item_name),
      'item_type', p_item_type,
      'unit_of_measure', lower(trim(p_unit_of_measure)),
      'minimum_stock', coalesce(p_minimum_stock, 0)
    )
  );

  return v_item_id;
end;
$function$;

-- ============================================================
-- 9. GRANTS
-- ============================================================

grant select, insert, update on public.inventory_items
  to authenticated, service_role;

grant select, insert on public.inventory_movements
  to authenticated, service_role;

grant execute on function public.create_inventory_item(
  uuid, uuid, text, text, text, text, text, numeric, uuid, uuid, uuid, uuid
)
  to authenticated, service_role;

grant execute on function public.get_inventory_stock(uuid)
  to authenticated, service_role;

grant execute on function public.get_inventory_unit_cost(uuid)
  to authenticated, service_role;

commit;
