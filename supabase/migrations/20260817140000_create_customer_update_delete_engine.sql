-- Ubah dan hapus customer unit dari dashboard unit.
--
-- Sebelumnya customer hanya bisa dibuat (create_customer); salah ketik kode atau
-- nama tidak ada jalan perbaikannya dari aplikasi. Aturan ubah/hapus ditaruh di
-- sini, bukan di kode TypeScript, supaya berlaku untuk semua pemanggil dan
-- memakai penjaga yang sama dengan engine penjualan: akses unit, izin
-- 'sales.manage', dan batas tenant.
--
-- Customer yang sudah dipakai transaksi tidak boleh hilang -- laporan penjualan
-- dan piutang ikut kehilangan namanya. Untuk itu penghapusan ditolak dengan
-- pesan yang bisa dibaca, dan jalan keluarnya adalah menonaktifkan customer
-- lewat update_customer (is_active = false): datanya tetap ada di riwayat, tapi
-- tidak lagi bisa dipilih pada transaksi baru.

create or replace function public.update_customer(
  p_customer_id uuid,
  p_customer_code text,
  p_customer_name text,
  p_phone text default null,
  p_email text default null,
  p_address text default null,
  p_is_active boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer public.customers%rowtype;
  v_actor_role public.app_role;
  v_code text;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select *
    into v_customer
  from public.customers c
  where c.id = p_customer_id;

  if not found then
    raise exception 'Customer tidak ditemukan';
  end if;

  -- Customer tingkat BUMDes dipakai bersama oleh semua unit, jadi tidak boleh
  -- diubah dari satu dashboard unit.
  if v_customer.unit_id is null then
    raise exception 'Customer tingkat BUMDes tidak bisa diubah dari dashboard unit';
  end if;

  if not public.can_access_unit(v_customer.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    v_customer.tenant_id,
    v_customer.unit_id
  );

  v_code := upper(nullif(trim(coalesce(p_customer_code, '')), ''));
  v_name := nullif(trim(coalesce(p_customer_name, '')), '');

  if v_code is null then
    raise exception 'Kode customer wajib diisi';
  end if;

  if v_name is null then
    raise exception 'Nama customer wajib diisi';
  end if;

  if exists (
    select 1
    from public.customers c
    where c.tenant_id = v_customer.tenant_id
      and c.unit_id = v_customer.unit_id
      and upper(c.customer_code) = v_code
      and c.id <> v_customer.id
  ) then
    raise exception 'Kode customer % sudah dipakai di unit ini', v_code;
  end if;

  select ur.role
    into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_customer.unit_id
      or ur.tenant_id = v_customer.tenant_id
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

  update public.customers
  set
    customer_code = v_code,
    customer_name = v_name,
    phone = nullif(trim(coalesce(p_phone, '')), ''),
    email = nullif(trim(coalesce(p_email, '')), ''),
    address = nullif(trim(coalesce(p_address, '')), ''),
    is_active = coalesce(p_is_active, true)
  where id = v_customer.id;

  perform public.log_audit_event(
    v_customer.tenant_id,
    v_customer.unit_id,
    auth.uid(),
    v_actor_role,
    'customer_updated'::text,
    'customers'::text,
    v_customer.id,
    'unit_dashboard'::text,
    v_customer.id,
    'Data customer diperbarui.'::text,
    jsonb_build_object(
      'before', jsonb_build_object(
        'customer_code', v_customer.customer_code,
        'customer_name', v_customer.customer_name,
        'phone', v_customer.phone,
        'email', v_customer.email,
        'address', v_customer.address,
        'is_active', v_customer.is_active
      ),
      'after', jsonb_build_object(
        'customer_code', v_code,
        'customer_name', v_name,
        'phone', nullif(trim(coalesce(p_phone, '')), ''),
        'email', nullif(trim(coalesce(p_email, '')), ''),
        'address', nullif(trim(coalesce(p_address, '')), ''),
        'is_active', coalesce(p_is_active, true)
      )
    )
  );

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer.id,
    'customer_code', v_code,
    'is_active', coalesce(p_is_active, true)
  );
end;
$function$;

create or replace function public.delete_customer(
  p_customer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer public.customers%rowtype;
  v_actor_role public.app_role;
  v_invoice_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  select *
    into v_customer
  from public.customers c
  where c.id = p_customer_id;

  if not found then
    raise exception 'Customer tidak ditemukan';
  end if;

  if v_customer.unit_id is null then
    raise exception 'Customer tingkat BUMDes tidak bisa dihapus dari dashboard unit';
  end if;

  if not public.can_access_unit(v_customer.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'sales.manage',
    auth.uid(),
    v_customer.tenant_id,
    v_customer.unit_id
  );

  -- Penjualan yang sudah tercatat tidak boleh kehilangan nama pelanggannya.
  select count(*)
    into v_invoice_count
  from public.sales_invoices si
  where si.customer_id = v_customer.id;

  if v_invoice_count > 0 then
    raise exception
      'Customer % sudah dipakai pada % transaksi penjualan, jadi tidak bisa dihapus. Nonaktifkan customer ini supaya tidak lagi muncul pada transaksi baru.',
      v_customer.customer_code,
      v_invoice_count;
  end if;

  select ur.role
    into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_customer.unit_id
      or ur.tenant_id = v_customer.tenant_id
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

  begin
    delete from public.customers
    where id = v_customer.id;
  exception when foreign_key_violation then
    -- Ada data lain di luar invoice penjualan yang masih menunjuk customer ini
    -- (misalnya saldo piutang awal dari cut-off migrasi).
    raise exception
      'Customer % masih dipakai data transaksi lain, jadi tidak bisa dihapus. Nonaktifkan customer ini supaya tidak lagi muncul pada transaksi baru.',
      v_customer.customer_code;
  end;

  perform public.log_audit_event(
    v_customer.tenant_id,
    v_customer.unit_id,
    auth.uid(),
    v_actor_role,
    'customer_deleted'::text,
    'customers'::text,
    v_customer.id,
    'unit_dashboard'::text,
    v_customer.id,
    'Customer dihapus dari master data unit.'::text,
    jsonb_build_object(
      'customer_code', v_customer.customer_code,
      'customer_name', v_customer.customer_name,
      'phone', v_customer.phone,
      'email', v_customer.email,
      'address', v_customer.address,
      'is_active', v_customer.is_active
    )
  );

  return jsonb_build_object(
    'ok', true,
    'customer_id', v_customer.id,
    'customer_code', v_customer.customer_code
  );
end;
$function$;

revoke all on function public.update_customer(
  uuid, text, text, text, text, text, boolean
) from public;

revoke all on function public.delete_customer(uuid) from public;

grant execute on function public.update_customer(
  uuid, text, text, text, text, text, boolean
) to authenticated;

grant execute on function public.delete_customer(uuid) to authenticated;

notify pgrst, 'reload schema';
