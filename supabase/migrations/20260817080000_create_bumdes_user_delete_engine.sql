-- Hapus pengguna BUMDes dari dashboard Direktur.
--
-- Sebelumnya penghapusan dikerjakan dari aplikasi memakai service-role: seluruh
-- RLS dilewati dan satu-satunya penjaga adalah kode TypeScript. Aturannya
-- dipindah ke sini supaya berlaku untuk semua pemanggil, dan supaya penghapusan
-- baris peran, kredensial akses, dan akun login terjadi dalam satu transaksi --
-- kalau salah satu gagal, tidak ada yang setengah terhapus.
--
-- Yang dihapus adalah satu baris akses (satu peran di satu unit), bukan "satu
-- orang". Satu pengguna bisa memegang peran di beberapa unit atau beberapa
-- tenant, jadi akun loginnya hanya ikut terhapus kalau setelah ini ia tidak
-- memegang peran di mana pun. Aturan yang sama dipakai delete_tenant_with_audit.

create or replace function public.delete_bumdes_tenant_user(
  p_role_id uuid,
  p_confirmation_text text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_confirmation constant text := 'HAPUS';
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_actor_is_director boolean := false;
  v_tenant_id uuid;
  v_target public.user_roles%rowtype;
  v_director_count integer := 0;
  v_remaining_roles integer := 0;
  v_credentials_deleted integer := 0;
  v_auth_mode text := 'kept';
begin
  if v_actor_id is null then
    raise exception 'User belum login.';
  end if;

  if coalesce(upper(trim(p_confirmation_text)), '') <> v_expected_confirmation then
    raise exception 'Ketik % pada kolom konfirmasi untuk melanjutkan.',
      v_expected_confirmation;
  end if;

  -- Peran pemanggil sekaligus menentukan tenant mana yang boleh disentuh.
  -- Tenant tidak pernah diambil dari parameter, supaya pemanggil tidak bisa
  -- menunjuk baris milik BUMDes lain.
  select ur.tenant_id, ur.role
    into v_tenant_id, v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and ur.tenant_id is not null
    and ur.role in (
      'direktur_bumdes'::public.app_role,
      'admin_bumdes'::public.app_role
    )
  order by (ur.role = 'direktur_bumdes'::public.app_role) desc
  limit 1;

  if v_tenant_id is null then
    raise exception 'Aksi ini hanya untuk Direktur atau Admin BUMDes.';
  end if;

  v_actor_is_director := v_actor_role = 'direktur_bumdes'::public.app_role;

  select *
    into v_target
  from public.user_roles ur
  where ur.id = p_role_id
    and ur.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Pengguna tidak ditemukan pada BUMDes ini.';
  end if;

  if v_target.user_id = v_actor_id then
    raise exception 'Anda tidak bisa menghapus akun Anda sendiri.';
  end if;

  if v_target.unit_id is null and not v_actor_is_director then
    raise exception 'Hanya Direktur BUMDes yang boleh menghapus pengguna tingkat BUMDes.';
  end if;

  -- Tenant tanpa direktur tidak bisa dipulihkan sendiri dari dalam aplikasi.
  if v_target.role = 'direktur_bumdes'::public.app_role then
    select count(*)
      into v_director_count
    from public.user_roles ur
    where ur.tenant_id = v_tenant_id
      and ur.role = 'direktur_bumdes'::public.app_role;

    if v_director_count <= 1 then
      raise exception
        'Direktur BUMDes terakhir tidak bisa dihapus. Tambahkan direktur lain lebih dulu.';
    end if;
  end if;

  delete from public.unit_access_credentials uac
  where uac.tenant_id = v_tenant_id
    and uac.user_id = v_target.user_id
    and uac.role = v_target.role
    and uac.unit_id is not distinct from v_target.unit_id;

  get diagnostics v_credentials_deleted = row_count;

  delete from public.user_roles
  where id = v_target.id;

  select count(*)
    into v_remaining_roles
  from public.user_roles ur
  where ur.user_id = v_target.user_id;

  -- Akun login hanya disentuh kalau tidak ada peran tersisa di mana pun.
  if v_remaining_roles = 0 then
    begin
      delete from auth.refresh_tokens
      where user_id = v_target.user_id::text;
    exception when others then
      null;
    end;

    begin
      delete from auth.sessions
      where user_id = v_target.user_id;
    exception when others then
      null;
    end;

    begin
      delete from auth.users
      where id = v_target.user_id;

      v_auth_mode := 'deleted';
    exception when others then
      -- Biasanya tertahan foreign key ke data akuntansi yang memang tidak
      -- boleh ikut hilang.
      v_auth_mode := 'delete_failed';
    end;

    if v_auth_mode = 'delete_failed' then
      begin
        update auth.users
        set banned_until = 'infinity'::timestamptz
        where id = v_target.user_id;

        v_auth_mode := 'banned';
      exception when others then
        v_auth_mode := 'failed';
      end;
    end if;

    if v_auth_mode = 'deleted' then
      begin
        delete from public.profiles
        where id = v_target.user_id;
      exception when others then
        null;
      end;
    end if;
  end if;

  perform public.log_audit_event(
    v_tenant_id,
    v_target.unit_id,
    v_actor_id,
    v_actor_role,
    'bumdes_user_deleted'::text,
    'user_roles'::text,
    v_target.id,
    'bumdes_dashboard_users'::text,
    v_target.user_id,
    'Pengguna BUMDes dihapus oleh Direktur/Admin BUMDes.'::text,
    jsonb_build_object(
      'target_user_id', v_target.user_id,
      'target_role', v_target.role,
      'target_unit_id', v_target.unit_id,
      'credentials_deleted', v_credentials_deleted,
      'remaining_roles', v_remaining_roles,
      'auth_cleanup_mode', v_auth_mode
    )
  );

  return jsonb_build_object(
    'ok', true,
    'auth_cleanup_mode', v_auth_mode,
    'credentials_deleted', v_credentials_deleted,
    'remaining_roles', v_remaining_roles
  );
end;
$$;

revoke all on function public.delete_bumdes_tenant_user(uuid, text) from public;

grant execute on function public.delete_bumdes_tenant_user(uuid, text)
  to authenticated;

notify pgrst, 'reload schema';
