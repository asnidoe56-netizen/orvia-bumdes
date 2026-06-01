-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000011_supplier_customer_master_engine.sql
--
-- Scope:
-- - Supplier master data
-- - Customer master data
-- - Supplier/customer creation RPCs
--
-- Notes:
-- - Fresh-install baseline.
-- - Supplier and customer are treated as global/base unit master engines.
-- - Current database evidence stores them as unit-scoped records using unit_id.
-- - Counterparty/business partner unification is deferred until explicitly designed.
-- ============================================================

begin;

-- ============================================================
-- 1. SUPPLIER MASTER
-- ============================================================

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  supplier_code text not null,
  supplier_name text not null,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint suppliers_code_not_blank
    check (btrim(supplier_code) <> ''),

  constraint suppliers_name_not_blank
    check (btrim(supplier_name) <> ''),

  constraint suppliers_scope_code_unique
    unique nulls not distinct (tenant_id, unit_id, supplier_code)
);

create index if not exists suppliers_tenant_idx
  on public.suppliers(tenant_id);

create index if not exists suppliers_unit_idx
  on public.suppliers(unit_id);

-- ============================================================
-- 2. CUSTOMER MASTER
-- ============================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  customer_code text not null,
  customer_name text not null,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customers_code_not_blank
    check (btrim(customer_code) <> ''),

  constraint customers_name_not_blank
    check (btrim(customer_name) <> ''),

  constraint customers_scope_code_unique
    unique nulls not distinct (tenant_id, unit_id, customer_code)
);

create index if not exists customers_tenant_idx
  on public.customers(tenant_id);

create index if not exists customers_unit_idx
  on public.customers(unit_id);

-- ============================================================
-- 3. TRIGGERS
-- ============================================================

drop trigger if exists trg_suppliers_set_updated_at on public.suppliers;
create trigger trg_suppliers_set_updated_at
before update on public.suppliers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_customers_set_updated_at on public.customers;
create trigger trg_customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

-- ============================================================
-- 4. CREATE SUPPLIER RPC
-- ============================================================

create or replace function public.create_supplier(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_supplier_code text,
  p_supplier_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_supplier_id uuid;
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
    'purchase.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(p_supplier_code), '') is null then
    raise exception 'Kode supplier wajib diisi';
  end if;

  if nullif(trim(p_supplier_name), '') is null then
    raise exception 'Nama supplier wajib diisi';
  end if;

  if exists (
    select 1
    from public.suppliers s
    where s.tenant_id = p_tenant_id
      and s.unit_id = p_unit_id
      and s.supplier_code = upper(trim(p_supplier_code))
  ) then
    raise exception 'Kode supplier sudah digunakan dalam unit ini';
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

  insert into public.suppliers (
    tenant_id,
    unit_id,
    supplier_code,
    supplier_name,
    phone,
    email,
    address,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(trim(p_supplier_code)),
    trim(p_supplier_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    true,
    auth.uid()
  )
  returning id into v_supplier_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'supplier_created'::text,
    'suppliers'::text,
    v_supplier_id,
    'unit_dashboard'::text,
    v_supplier_id,
    'Master supplier dibuat.'::text,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'supplier_code', upper(trim(p_supplier_code)),
      'supplier_name', trim(p_supplier_name)
    )
  );

  return v_supplier_id;
end;
$function$;

-- ============================================================
-- 5. CREATE CUSTOMER RPC
-- ============================================================

create or replace function public.create_customer(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_customer_code text,
  p_customer_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_customer_id uuid;
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
    'sales.manage',
    auth.uid(),
    p_tenant_id,
    p_unit_id
  );

  if nullif(trim(p_customer_code), '') is null then
    raise exception 'Kode customer wajib diisi';
  end if;

  if nullif(trim(p_customer_name), '') is null then
    raise exception 'Nama customer wajib diisi';
  end if;

  if exists (
    select 1
    from public.customers c
    where c.tenant_id = p_tenant_id
      and c.unit_id = p_unit_id
      and c.customer_code = upper(trim(p_customer_code))
  ) then
    raise exception 'Kode customer sudah digunakan dalam unit ini';
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

  insert into public.customers (
    tenant_id,
    unit_id,
    customer_code,
    customer_name,
    phone,
    email,
    address,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    upper(trim(p_customer_code)),
    trim(p_customer_name),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(trim(coalesce(p_email, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    true,
    auth.uid()
  )
  returning id into v_customer_id;

  perform public.log_audit_event(
    p_tenant_id,
    p_unit_id,
    auth.uid(),
    v_actor_role,
    'customer_created'::text,
    'customers'::text,
    v_customer_id,
    'unit_dashboard'::text,
    v_customer_id,
    'Master customer dibuat.'::text,
    jsonb_build_object(
      'customer_id', v_customer_id,
      'customer_code', upper(trim(p_customer_code)),
      'customer_name', trim(p_customer_name)
    )
  );

  return v_customer_id;
end;
$function$;

-- ============================================================
-- 6. GRANTS
-- ============================================================

grant select, insert, update on public.suppliers
  to authenticated, service_role;

grant select, insert, update on public.customers
  to authenticated, service_role;

grant execute on function public.create_supplier(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

grant execute on function public.create_customer(uuid, uuid, text, text, text, text, text)
  to authenticated, service_role;

commit;
