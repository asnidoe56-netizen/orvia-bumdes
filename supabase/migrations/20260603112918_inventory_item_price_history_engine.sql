-- Inventory item price history engine
-- Additive migration: does not remove existing inventory, purchase, sales, or movement data.

create table if not exists public.inventory_item_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.business_units(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  price_type text not null default 'retail',
  sales_price numeric(18,2) not null,
  effective_from date not null default current_date,
  effective_until date null,
  reason text null,
  status text not null default 'active',
  is_active boolean not null default true,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_by uuid null references auth.users(id),
  approved_at timestamptz null,
  cancelled_by uuid null references auth.users(id),
  cancelled_at timestamptz null,
  cancellation_reason text null,

  constraint inventory_item_prices_price_type_not_blank
    check (nullif(trim(price_type), '') is not null),

  constraint inventory_item_prices_sales_price_check
    check (sales_price >= 0),

  constraint inventory_item_prices_status_check
    check (status in ('draft', 'active', 'expired', 'cancelled')),

  constraint inventory_item_prices_effective_period_check
    check (effective_until is null or effective_until >= effective_from)
);

create index if not exists inventory_item_prices_scope_idx
  on public.inventory_item_prices (tenant_id, unit_id, item_id);

create index if not exists inventory_item_prices_active_lookup_idx
  on public.inventory_item_prices (tenant_id, unit_id, item_id, price_type, effective_from desc)
  where status = 'active' and is_active = true;

alter table public.inventory_item_prices enable row level security;

drop policy if exists inventory_item_prices_select_scope on public.inventory_item_prices;

create policy inventory_item_prices_select_scope
on public.inventory_item_prices
for select
to authenticated
using (public.rls_can_access_scope(tenant_id, unit_id));

drop trigger if exists trg_inventory_item_prices_set_updated_at on public.inventory_item_prices;

create trigger trg_inventory_item_prices_set_updated_at
before update on public.inventory_item_prices
for each row
execute function public.set_updated_at();

create or replace function public.validate_inventory_item_price_scope()
returns trigger
language plpgsql
security definer
set search_path to 'public'
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
    raise exception 'Item persediaan tidak ditemukan';
  end if;

  if v_item_tenant_id is distinct from new.tenant_id
     or v_item_unit_id is distinct from new.unit_id then
    raise exception 'Scope harga barang tidak sesuai dengan scope item';
  end if;

  new.price_type := lower(trim(new.price_type));

  return new;
end;
$function$;

drop trigger if exists trg_inventory_item_prices_validate_scope on public.inventory_item_prices;

create trigger trg_inventory_item_prices_validate_scope
before insert or update on public.inventory_item_prices
for each row
execute function public.validate_inventory_item_price_scope();

create or replace view public.v_inventory_item_active_prices as
select distinct on (p.tenant_id, p.unit_id, p.item_id, p.price_type)
  p.id,
  p.tenant_id,
  p.unit_id,
  p.item_id,
  i.item_code,
  i.item_name,
  i.unit_of_measure,
  p.price_type,
  p.sales_price,
  p.effective_from,
  p.effective_until,
  p.reason,
  p.status,
  p.is_active,
  p.created_by,
  p.created_at,
  p.updated_at
from public.inventory_item_prices p
join public.inventory_items i on i.id = p.item_id
where p.status = 'active'
  and p.is_active = true
  and p.effective_from <= current_date
  and (p.effective_until is null or p.effective_until >= current_date)
order by
  p.tenant_id,
  p.unit_id,
  p.item_id,
  p.price_type,
  p.effective_from desc,
  p.created_at desc;

grant select on public.v_inventory_item_active_prices to authenticated;

create or replace function public.get_active_item_sales_price(
  p_item_id uuid,
  p_price_type text default 'retail',
  p_sales_date date default current_date
)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_unit_id uuid;
  v_price numeric(18,2);
begin
  select ii.tenant_id, ii.unit_id
  into v_tenant_id, v_unit_id
  from public.inventory_items ii
  where ii.id = p_item_id;

  if v_tenant_id is null then
    raise exception 'Item persediaan tidak ditemukan';
  end if;

  if not public.rls_can_access_scope(v_tenant_id, v_unit_id) then
    raise exception 'User tidak memiliki akses ke item ini';
  end if;

  select p.sales_price
  into v_price
  from public.inventory_item_prices p
  where p.item_id = p_item_id
    and p.price_type = lower(trim(coalesce(p_price_type, 'retail')))
    and p.status = 'active'
    and p.is_active = true
    and p.effective_from <= coalesce(p_sales_date, current_date)
    and (
      p.effective_until is null
      or p.effective_until >= coalesce(p_sales_date, current_date)
    )
  order by p.effective_from desc, p.created_at desc
  limit 1;

  if v_price is not null then
    return v_price;
  end if;

  select coalesce(ii.default_sales_price, 0)
  into v_price
  from public.inventory_items ii
  where ii.id = p_item_id;

  return coalesce(v_price, 0);
end;
$function$;

create or replace function public.create_inventory_item_price(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_item_id uuid,
  p_price_type text default 'retail',
  p_sales_price numeric default 0,
  p_effective_from date default current_date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_price_id uuid;
  v_actor_role public.app_role;
  v_price_type text;
  v_effective_from date;
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

  if not exists (
    select 1
    from public.inventory_items ii
    where ii.id = p_item_id
      and ii.tenant_id = p_tenant_id
      and ii.unit_id = p_unit_id
  ) then
    raise exception 'Item tidak sesuai dengan tenant/unit';
  end if;

  v_price_type := lower(trim(coalesce(p_price_type, 'retail')));
  v_effective_from := coalesce(p_effective_from, current_date);

  if nullif(v_price_type, '') is null then
    raise exception 'Jenis harga wajib diisi';
  end if;

  if coalesce(p_sales_price, 0) < 0 then
    raise exception 'Harga jual tidak boleh negatif';
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

  update public.inventory_item_prices p
  set
    effective_until = v_effective_from - interval '1 day',
    status = case
      when p.effective_from >= v_effective_from then 'cancelled'
      else 'expired'
    end,
    is_active = false,
    cancelled_by = case
      when p.effective_from >= v_effective_from then auth.uid()
      else p.cancelled_by
    end,
    cancelled_at = case
      when p.effective_from >= v_effective_from then now()
      else p.cancelled_at
    end,
    cancellation_reason = case
      when p.effective_from >= v_effective_from then 'Diganti oleh harga baru'
      else p.cancellation_reason
    end
  where p.tenant_id = p_tenant_id
    and p.unit_id = p_unit_id
    and p.item_id = p_item_id
    and p.price_type = v_price_type
    and p.status = 'active'
    and p.is_active = true
    and (
      p.effective_until is null
      or p.effective_until >= v_effective_from
    );

  insert into public.inventory_item_prices (
    tenant_id,
    unit_id,
    item_id,
    price_type,
    sales_price,
    effective_from,
    effective_until,
    reason,
    status,
    is_active,
    created_by,
    approved_by,
    approved_at
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_item_id,
    v_price_type,
    coalesce(p_sales_price, 0),
    v_effective_from,
    null,
    nullif(trim(coalesce(p_reason, '')), ''),
    'active',
    true,
    auth.uid(),
    auth.uid(),
    now()
  )
  returning id into v_price_id;

  update public.inventory_items
  set default_sales_price = coalesce(p_sales_price, 0)
  where id = p_item_id
    and tenant_id = p_tenant_id
    and unit_id = p_unit_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'inventory_item_price_changed'::text,
    'inventory_item_prices'::text,
    v_price_id,
    'unit_dashboard'::text,
    v_price_id,
    'Harga jual barang diperbarui.'::text,
    jsonb_build_object(
      'item_id', p_item_id,
      'price_id', v_price_id,
      'price_type', v_price_type,
      'sales_price', coalesce(p_sales_price, 0),
      'effective_from', v_effective_from,
      'reason', nullif(trim(coalesce(p_reason, '')), '')
    )
  );

  return v_price_id;
end;
$function$;

create or replace view public.v_inventory_item_stock_summary as
with movement_summary as (
  select
    item_id,
    sum(quantity_in) as total_quantity_in,
    sum(quantity_out) as total_quantity_out,
    sum(quantity_in - quantity_out) as current_stock,
    sum(total_cost) filter (where quantity_in > 0) as total_in_cost,
    sum(quantity_in) filter (where quantity_in > 0) as total_in_qty
  from public.inventory_movements
  group by item_id
),
last_purchase as (
  select distinct on (pil.item_id)
    pil.item_id,
    pil.unit_cost as last_purchase_price
  from public.purchase_invoice_lines pil
  join public.purchase_invoices pi on pi.id = pil.purchase_invoice_id
  order by pil.item_id, pi.invoice_date desc, pil.created_at desc
),
active_retail_price as (
  select item_id, sales_price
  from public.v_inventory_item_active_prices
  where price_type = 'retail'
)
select
  i.id,
  i.tenant_id,
  i.unit_id,
  i.item_code,
  i.item_name,
  i.description,
  i.unit_of_measure,
  i.item_type,
  i.minimum_stock,
  coalesce(arp.sales_price, i.default_sales_price, 0::numeric(18,2))::numeric(18,2) as default_sales_price,
  i.is_active,
  coalesce(ms.total_quantity_in, 0) as total_quantity_in,
  coalesce(ms.total_quantity_out, 0) as total_quantity_out,
  coalesce(ms.current_stock, 0) as current_stock,
  coalesce(lp.last_purchase_price, 0) as last_purchase_price,
  case
    when coalesce(ms.total_in_qty, 0) = 0 then 0
    else round(coalesce(ms.total_in_cost, 0) / nullif(ms.total_in_qty, 0), 2)
  end as average_unit_cost,
  case
    when i.item_type <> 'stock' then 0
    when coalesce(ms.total_in_qty, 0) = 0 then 0
    else round(coalesce(ms.current_stock, 0) * (coalesce(ms.total_in_cost, 0) / nullif(ms.total_in_qty, 0)), 2)
  end as inventory_value,
  case
    when i.item_type <> 'stock' then 'not_tracked'
    when coalesce(ms.current_stock, 0) <= 0 then 'empty'
    when i.minimum_stock > 0 and coalesce(ms.current_stock, 0) <= i.minimum_stock then 'low'
    else 'safe'
  end as stock_status,
  i.created_at,
  i.updated_at,
  coalesce(arp.sales_price, i.default_sales_price, 0::numeric(18,2))::numeric(18,2) as active_sales_price
from public.inventory_items i
left join movement_summary ms on ms.item_id = i.id
left join last_purchase lp on lp.item_id = i.id
left join active_retail_price arp on arp.item_id = i.id;

grant select on public.v_inventory_item_stock_summary to authenticated;

notify pgrst, 'reload schema';
