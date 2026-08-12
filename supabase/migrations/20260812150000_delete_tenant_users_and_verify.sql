-- Hapus tenant: ikut menghapus akun operator, dan verifikasi hasilnya.
--
-- Dua masalah yang diperbaiki di sini:
--
-- 1. `delete_tenant_with_audit` melaporkan sukses tanpa pernah memastikan baris
--    tenant benar-benar hilang. Kalau ada trigger BEFORE DELETE, RLS, atau
--    apa pun yang menelan `delete` tanpa error, `row_count` jadi 0 dan fungsi
--    tetap mengembalikan ok. Sekarang seluruh hasil diverifikasi ulang; kalau
--    ada sisa, transaksi dibatalkan dan pemanggil dapat pesan spesifik.
--
-- 2. Purge hanya menyentuh skema `public`. Akun login ada di `auth.users`,
--    jadi operator unit tetap bisa masuk setelah BUMDes-nya dihapus. Sekarang
--    akun operator tenant ikut dihapus (fallback: di-ban + sesi dicabut).
--
-- Operator yang masih punya peran di tenant lain, punya peran platform, atau
-- pelaku penghapusan itu sendiri tidak pernah ikut terhapus.

create or replace function public.tenant_lifecycle_column_exists(
  p_relation text,
  p_column text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from pg_attribute a
    where a.attrelid = to_regclass(p_relation)
      and a.attname = p_column
      and a.attnum > 0
      and not a.attisdropped
  );
$$;

revoke all on function public.tenant_lifecycle_column_exists(text, text) from public;

create or replace function public.delete_tenant_with_audit(
  p_tenant_id uuid,
  p_confirmation_text text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.app_role;
  v_tenant public.tenants%rowtype;
  v_expected_confirmation text;
  v_batch_id uuid;
  v_batch_key text;
  v_table record;
  v_counts jsonb := '{}'::jsonb;
  v_error_message text;
  v_error_state text;
  v_error_detail text;
  v_ok boolean := false;

  v_user_ids uuid[] := '{}'::uuid[];
  v_found_ids uuid[];
  v_delete_user_ids uuid[] := '{}'::uuid[];
  v_deleted_users integer := 0;
  v_auth_mode text := 'none';
  v_auth_error text;
  v_still_active text[];
  v_leftovers text[] := '{}'::text[];
  v_has_rows boolean;
begin
  v_actor_role := public.platform_assert_super_admin();

  if p_tenant_id is null then
    raise exception 'Tenant tidak valid.';
  end if;

  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Alasan hapus tenant wajib diisi.';
  end if;

  select *
    into v_tenant
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found then
    raise exception 'Tenant tidak ditemukan.';
  end if;

  v_expected_confirmation := 'HAPUS-' || upper(coalesce(v_tenant.kode_bumdes, ''));

  if upper(trim(coalesce(p_confirmation_text, ''))) <> v_expected_confirmation then
    raise exception 'Kode konfirmasi tidak sesuai. Ketik: %', v_expected_confirmation;
  end if;

  v_batch_key := 'tenant-delete-' || replace(p_tenant_id::text, '-', '') || '-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

  insert into public.tenant_lifecycle_batches (
    tenant_id,
    action,
    actor_id,
    actor_role,
    reason,
    confirmation_text,
    tenant_snapshot,
    affected_counts,
    status,
    started_at,
    metadata
  )
  values (
    p_tenant_id,
    'delete',
    v_actor_id,
    v_actor_role,
    trim(p_reason),
    upper(trim(p_confirmation_text)),
    to_jsonb(v_tenant),
    '{}'::jsonb,
    'started',
    now(),
    jsonb_build_object(
      'expected_confirmation', v_expected_confirmation,
      'batch_key', v_batch_key
    )
  )
  returning id into v_batch_id;

  -- Baris batch di atas sengaja berada di luar blok bawah. Kalau penghapusan
  -- gagal, subtransaksi blok ini yang di-rollback, sedangkan baris batch tetap
  -- ada untuk ditandai 'failed'.
  begin
    -- ---------------------------------------------------------------------
    -- Kumpulkan akun operator SELAGI datanya masih ada.
    -- ---------------------------------------------------------------------
    if public.tenant_lifecycle_column_exists('public.user_roles', 'tenant_id')
      and public.tenant_lifecycle_column_exists('public.user_roles', 'user_id')
    then
      execute format(
        'select coalesce(array_agg(distinct user_id), ''{}''::uuid[])
           from public.user_roles
          where tenant_id = %L::uuid and user_id is not null',
        p_tenant_id
      ) into v_found_ids;

      v_user_ids := v_user_ids || v_found_ids;
    end if;

    if public.tenant_lifecycle_column_exists('public.profiles', 'tenant_id') then
      execute format(
        'select coalesce(array_agg(distinct id), ''{}''::uuid[])
           from public.profiles
          where tenant_id = %L::uuid',
        p_tenant_id
      ) into v_found_ids;

      v_user_ids := v_user_ids || v_found_ids;
    end if;

    -- Pelaku penghapusan tidak pernah ikut terhapus.
    select coalesce(array_agg(distinct u), '{}'::uuid[])
      into v_user_ids
    from unnest(v_user_ids) as u
    where u is not null
      and (v_actor_id is null or u <> v_actor_id);

    -- ---------------------------------------------------------------------
    -- Hapus seluruh data tenant di skema public.
    -- ---------------------------------------------------------------------

    -- Arsip registrasi tidak selalu punya FK ke tenants, jadi dicocokkan manual.
    perform public.tenant_purge_related_rows(
      v_batch_id,
      p_tenant_id,
      'public',
      'tenant_registrations',
      format(
        'lower(kode_bumdes) = lower(%L) and lower(nama_bumdes) = lower(%L)',
        v_tenant.kode_bumdes,
        v_tenant.nama_bumdes
      ),
      0
    );

    -- Tahap 1: tabel yang memegang tenant_id tanpa foreign key ke tenants
    -- (tidak akan terjangkau lewat graf FK).
    for v_table in
      select ns.nspname as table_schema, cl.relname as table_name
      from pg_class cl
      join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_attribute a
        on a.attrelid = cl.oid
       and a.attname = 'tenant_id'
       and a.attnum > 0
       and not a.attisdropped
      where ns.nspname = 'public'
        and cl.relkind in ('r', 'p')
        and not cl.relispartition
        and (ns.nspname || '.' || cl.relname) <> all (array[
          'public.tenants',
          'public.tenant_lifecycle_batches',
          'public.tenant_lifecycle_backup_rows',
          'public.erp_tenant_reset_batches',
          'public.erp_tenant_reset_backup_rows',
          'public.erp_audit_copy_rows'
        ])
      order by cl.relname
    loop
      perform public.tenant_purge_related_rows(
        v_batch_id,
        p_tenant_id,
        v_table.table_schema,
        v_table.table_name,
        format('tenant_id = %L::uuid', p_tenant_id),
        0
      );
    end loop;

    -- Tahap 2: baris tenant itu sendiri, mengikuti sisa relasi apa pun.
    perform public.tenant_purge_related_rows(
      v_batch_id,
      p_tenant_id,
      'public',
      'tenants',
      format('id = %L::uuid', p_tenant_id),
      0
    );

    -- ---------------------------------------------------------------------
    -- Verifikasi skema public. Sukses harus berarti benar-benar sukses.
    -- ---------------------------------------------------------------------
    if exists (select 1 from public.tenants where id = p_tenant_id) then
      raise exception
        'Baris tenant tidak ikut terhapus meski perintah delete tidak error. Biasanya ada trigger BEFORE DELETE atau RLS yang menelannya. Semua perubahan dibatalkan.';
    end if;

    for v_table in
      select ns.nspname as table_schema, cl.relname as table_name
      from pg_class cl
      join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_attribute a
        on a.attrelid = cl.oid
       and a.attname = 'tenant_id'
       and a.attnum > 0
       and not a.attisdropped
      where ns.nspname = 'public'
        and cl.relkind in ('r', 'p')
        and not cl.relispartition
        and (ns.nspname || '.' || cl.relname) <> all (array[
          'public.tenant_lifecycle_batches',
          'public.tenant_lifecycle_backup_rows',
          'public.erp_tenant_reset_batches',
          'public.erp_tenant_reset_backup_rows',
          'public.erp_audit_copy_rows'
        ])
      order by cl.relname
    loop
      execute format(
        'select exists (select 1 from %I.%I where tenant_id = %L::uuid)',
        v_table.table_schema,
        v_table.table_name,
        p_tenant_id
      ) into v_has_rows;

      if v_has_rows then
        v_leftovers := v_leftovers || (v_table.table_schema || '.' || v_table.table_name);
      end if;
    end loop;

    if array_length(v_leftovers, 1) > 0 then
      raise exception 'Masih ada data tenant tersisa di: %. Semua perubahan dibatalkan.',
        array_to_string(v_leftovers, ', ');
    end if;

    -- ---------------------------------------------------------------------
    -- Akun operator. Hanya yang tidak punya peran tersisa di mana pun.
    -- ---------------------------------------------------------------------
    if array_length(v_user_ids, 1) > 0 then
      if public.tenant_lifecycle_column_exists('public.user_roles', 'user_id') then
        -- user_roles tenant ini sudah terhapus di atas, jadi sisa baris berarti
        -- peran di tenant lain atau peran tingkat platform.
        execute format(
          'select coalesce(array_agg(u), ''{}''::uuid[])
             from unnest(%L::uuid[]) as u
            where not exists (select 1 from public.user_roles ur where ur.user_id = u)',
          v_user_ids
        ) into v_delete_user_ids;
      else
        v_delete_user_ids := v_user_ids;
      end if;
    end if;

    if array_length(v_delete_user_ids, 1) > 0 then
      -- Backup tanpa kolom rahasia. Hash password dan token tidak boleh
      -- ikut mendarat di tabel arsip skema public.
      insert into public.tenant_lifecycle_backup_rows (
        batch_id,
        tenant_id,
        table_schema,
        table_name,
        row_pk,
        payload
      )
      select
        v_batch_id,
        p_tenant_id,
        'auth',
        'users',
        au.id::text,
        to_jsonb(au)
          - 'encrypted_password'
          - 'confirmation_token'
          - 'recovery_token'
          - 'email_change_token_new'
          - 'email_change_token_current'
          - 'phone_change_token'
          - 'reauthentication_token'
      from auth.users au
      where au.id = any (v_delete_user_ids);

      -- Profil bisa saja tidak punya kolom tenant_id, jadi belum tentu ikut
      -- terhapus di tahap 1. Bersihkan di sini supaya auth.users tidak terhalang.
      if to_regclass('public.profiles') is not null then
        perform public.tenant_purge_related_rows(
          v_batch_id,
          p_tenant_id,
          'public',
          'profiles',
          format('id = any (%L::uuid[])', v_delete_user_ids),
          0
        );
      end if;

      begin
        delete from auth.users
        where id = any (v_delete_user_ids);

        get diagnostics v_deleted_users = row_count;
        v_auth_mode := 'deleted';
      exception
        when others then
          v_auth_error := sqlerrm;
          v_auth_mode := 'delete_failed';
      end;

      if v_auth_mode = 'delete_failed' then
        -- Fallback kalau pemilik fungsi tidak punya hak hapus di skema auth:
        -- kunci akunnya dan cabut sesi yang masih berjalan.
        begin
          update auth.users
          set banned_until = 'infinity'::timestamptz
          where id = any (v_delete_user_ids);

          get diagnostics v_deleted_users = row_count;
          v_auth_mode := 'banned';

          begin
            delete from auth.sessions where user_id = any (v_delete_user_ids);
          exception
            when others then
              null;
          end;

          begin
            delete from auth.refresh_tokens
            where user_id in (select u::text from unnest(v_delete_user_ids) as u);
          exception
            when others then
              null;
          end;
        exception
          when others then
            v_auth_mode := 'failed';
            v_auth_error := coalesce(v_auth_error || ' | ', '') || sqlerrm;
        end;
      end if;

      if v_auth_mode = 'failed' then
        raise exception
          'Tenant tidak jadi dihapus: akun operator tidak bisa dinonaktifkan (%). Beri hak akses skema auth ke pemilik fungsi ini, lalu ulangi.',
          coalesce(v_auth_error, 'sebab tidak diketahui');
      end if;

      -- Verifikasi: tidak boleh ada operator yang masih bisa login.
      select coalesce(array_agg(coalesce(au.email, au.id::text)), '{}'::text[])
        into v_still_active
      from auth.users au
      where au.id = any (v_delete_user_ids)
        and (au.banned_until is null or au.banned_until <= now());

      if array_length(v_still_active, 1) > 0 then
        raise exception 'Operator ini masih bisa login setelah tenant dihapus: %. Semua perubahan dibatalkan.',
          array_to_string(v_still_active, ', ');
      end if;
    end if;

    v_ok := true;
  exception
    when others then
      v_ok := false;
      v_error_message := sqlerrm;
      v_error_state := sqlstate;
      get stacked diagnostics v_error_detail = pg_exception_detail;
  end;

  if not v_ok then
    update public.tenant_lifecycle_batches
    set status = 'failed',
        finished_at = now(),
        metadata = metadata || jsonb_build_object(
          'failed_at', now(),
          'error_message', v_error_message,
          'error_state', v_error_state,
          'error_detail', v_error_detail
        )
    where id = v_batch_id;

    return jsonb_build_object(
      'ok', false,
      'action', 'delete',
      'tenant_id', p_tenant_id,
      'batch_id', v_batch_id,
      'error', v_error_message,
      'error_state', v_error_state
    );
  end if;

  select affected_counts
    into v_counts
  from public.tenant_lifecycle_batches
  where id = v_batch_id;

  update public.tenant_lifecycle_batches
  set status = 'completed',
      finished_at = now(),
      metadata = metadata || jsonb_build_object(
        'completed_at', now(),
        'delete_mode', 'fk_graph_delete_with_audit_backup',
        'auth_cleanup_mode', v_auth_mode,
        'auth_users_affected', v_deleted_users,
        'auth_user_ids', to_jsonb(v_delete_user_ids)
      )
  where id = v_batch_id;

  -- Jejak audit permanen. tenant_id sengaja null karena barisnya sudah hilang.
  -- Dibungkus blok sendiri supaya skema audit_timeline yang lebih ketat tidak
  -- membatalkan penghapusan yang sudah sukses.
  begin
    insert into public.audit_timeline (
      tenant_id,
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
      null,
      v_actor_id,
      v_actor_role,
      'tenant_delete',
      'tenants',
      p_tenant_id,
      'tenant_lifecycle_batches',
      v_batch_id,
      'Tenant BUMDes dihapus oleh Admin Platform setelah backup audit dibuat.',
      jsonb_build_object(
        'reason', trim(p_reason),
        'confirmation_text', upper(trim(p_confirmation_text)),
        'tenant_snapshot', to_jsonb(v_tenant),
        'affected_counts', v_counts,
        'auth_cleanup_mode', v_auth_mode,
        'auth_users_affected', v_deleted_users,
        'batch_id', v_batch_id,
        'batch_key', v_batch_key
      )
    );
  exception
    when others then
      null;
  end;

  return jsonb_build_object(
    'ok', true,
    'action', 'delete',
    'tenant_id', p_tenant_id,
    'tenant_name', v_tenant.nama_bumdes,
    'kode_bumdes', v_tenant.kode_bumdes,
    'batch_id', v_batch_id,
    'batch_key', v_batch_key,
    'auth_cleanup_mode', v_auth_mode,
    'auth_users_affected', v_deleted_users,
    'affected_counts', coalesce(v_counts, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.delete_tenant_with_audit(uuid, text, text)
  to authenticated;
