-- Repair tenant delete engine.
--
-- Masalah pada versi 20260619103000:
-- 1. Penghapusan hanya menyapu tabel yang punya kolom `tenant_id`. Tabel anak
--    tanpa `tenant_id` (mis. *_lines) hanya di-backup tapi tidak pernah dihapus,
--    sehingga `delete` pada tabel induk selalu kena foreign key violation dan
--    loop berhenti dengan "Hapus tenant tertahan oleh relasi data".
-- 2. Loop retry 30x mengeksekusi ratusan `delete` + `count(*)` per percobaan.
--    Pada role `authenticated` (statement_timeout kecil) ini gampang timeout,
--    sehingga tombol hapus terlihat tidak melakukan apa pun.
-- 3. Blok `exception ... raise` membuat status batch 'failed' ikut ter-rollback,
--    jadi kegagalan tidak pernah tercatat dan pemanggil tidak dapat pesan jelas.
--
-- Versi ini menelusuri graf foreign key dari `pg_constraint`, sehingga urutan
-- hapus benar tanpa retry, tanpa daftar tabel hardcoded, dan setiap baris tetap
-- di-backup lebih dulu ke `tenant_lifecycle_backup_rows`.

create or replace function public.tenant_purge_related_rows(
  p_batch_id uuid,
  p_tenant_id uuid,
  p_schema text,
  p_table text,
  p_where text,
  p_depth integer default 0
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c_max_depth constant integer := 15;

  -- Tabel arsip lifecycle tidak boleh ikut terhapus. Di sinilah bukti audit
  -- penghapusan tenant disimpan.
  c_protected constant text[] := array[
    'public.tenant_lifecycle_batches',
    'public.tenant_lifecycle_backup_rows',
    'public.erp_tenant_reset_batches',
    'public.erp_tenant_reset_backup_rows',
    'public.erp_audit_copy_rows'
  ];

  -- Relasi "lunak": referensi kenyamanan, bukan kepemilikan data. Cukup
  -- dikosongkan, jangan sampai barisnya ikut dihapus.
  c_soft_refs constant text[] := array[
    'public.profiles.default_tenant_id',
    'public.user_presence.tenant_id',
    'public.user_presence.unit_id'
  ];

  v_ident text := format('%I.%I', p_schema, p_table);
  v_key text := p_schema || '.' || p_table;
  v_fk record;
  v_child_ident text;
  v_child_key text;
  v_child_where text;
  v_child_scoped_where text;
  v_child_has_tenant boolean;
  v_deleted integer := 0;
begin
  if p_batch_id is null or p_schema is null or p_table is null or coalesce(trim(p_where), '') = '' then
    raise exception 'Parameter purge tenant tidak lengkap.';
  end if;

  if v_key = any (c_protected) then
    raise exception 'Tabel arsip % tidak boleh ikut dihapus saat menghapus tenant.', v_key;
  end if;

  if p_depth > c_max_depth then
    raise exception 'Rantai relasi data terlalu dalam pada tabel %. Hapus tenant dihentikan demi keamanan.', v_key;
  end if;

  -- Selesaikan seluruh tabel anak lebih dulu, baru baris tabel ini dihapus.
  for v_fk in
    select
      con.conname as constraint_name,
      child_ns.nspname as child_schema,
      child.relname as child_table,
      con.confdeltype as delete_action,
      (con.conrelid = con.confrelid) as is_self_reference,
      child_cols.cols_csv as child_cols,
      child_cols.null_set as child_null_set,
      child_cols.default_set as child_default_set,
      child_cols.all_nullable as child_cols_nullable,
      child_cols.first_col as child_first_col,
      parent_cols.cols_csv as parent_cols
    from pg_constraint con
    join pg_class child on child.oid = con.conrelid
    join pg_namespace child_ns on child_ns.oid = child.relnamespace
    cross join lateral (
      select
        string_agg(quote_ident(a.attname), ', ' order by k.ord) as cols_csv,
        string_agg(quote_ident(a.attname) || ' = null', ', ' order by k.ord) as null_set,
        string_agg(quote_ident(a.attname) || ' = default', ', ' order by k.ord) as default_set,
        bool_and(not a.attnotnull) as all_nullable,
        min(a.attname) filter (where k.ord = 1) as first_col
      from unnest(con.conkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.attnum
    ) as child_cols
    cross join lateral (
      select string_agg(quote_ident(a.attname), ', ' order by k.ord) as cols_csv
      from unnest(con.confkey) with ordinality as k(attnum, ord)
      join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.attnum
    ) as parent_cols
    where con.contype = 'f'
      and con.confrelid = v_ident::regclass
      and con.conparentid = 0
      and child.relkind in ('r', 'p')
      and not child.relispartition
    order by child_ns.nspname, child.relname, con.conname
  loop
    v_child_ident := format('%I.%I', v_fk.child_schema, v_fk.child_table);
    v_child_key := v_fk.child_schema || '.' || v_fk.child_table;

    v_child_where := format(
      '(%s) in (select %s from %s where %s)',
      v_fk.child_cols,
      v_fk.parent_cols,
      v_ident,
      p_where
    );

    if v_child_key = any (c_protected) then
      -- Arsip lifecycle: putuskan referensinya, jangan dihapus.
      if v_fk.child_cols_nullable then
        execute format('update %s set %s where %s', v_child_ident, v_fk.child_null_set, v_child_where);
      else
        raise exception 'Relasi % dari tabel arsip % memblokir hapus tenant.', v_fk.constraint_name, v_child_key;
      end if;

    elsif v_fk.child_cols_nullable
      and (
        v_fk.delete_action = 'n'
        or v_fk.is_self_reference
        or (v_child_key || '.' || coalesce(v_fk.child_first_col, '')) = any (c_soft_refs)
      )
    then
      -- SET NULL, referensi lunak, dan hierarki self-reference cukup dikosongkan.
      execute format('update %s set %s where %s', v_child_ident, v_fk.child_null_set, v_child_where);

    elsif v_fk.delete_action = 'd' then
      execute format('update %s set %s where %s', v_child_ident, v_fk.child_default_set, v_child_where);

    else
      -- Kepemilikan data sesungguhnya: backup lalu hapus barisnya secara rekursif.
      v_child_scoped_where := v_child_where;

      select exists (
        select 1
        from pg_attribute a
        where a.attrelid = v_child_ident::regclass
          and a.attname = 'tenant_id'
          and a.attnum > 0
          and not a.attisdropped
      ) into v_child_has_tenant;

      if v_child_has_tenant and p_tenant_id is not null then
        -- Pagar keamanan multi-tenant: jangan pernah menghapus baris milik
        -- tenant lain. Kalau ada, biarkan gagal dengan pesan jelas.
        v_child_scoped_where := v_child_scoped_where || format(
          ' and (tenant_id is null or tenant_id = %L::uuid)',
          p_tenant_id
        );
      end if;

      perform public.tenant_purge_related_rows(
        p_batch_id,
        p_tenant_id,
        v_fk.child_schema,
        v_fk.child_table,
        v_child_scoped_where,
        p_depth + 1
      );
    end if;
  end loop;

  perform public.backup_tenant_lifecycle_table_rows(
    p_batch_id,
    p_tenant_id,
    p_schema,
    p_table,
    p_where
  );

  begin
    execute format('delete from %s where %s', v_ident, p_where);
    get diagnostics v_deleted = row_count;
  exception
    when foreign_key_violation then
      raise exception 'Baris pada % masih dirujuk tabel lain sehingga tenant tidak bisa dihapus. Detail: %', v_key, sqlerrm;
  end;

  if v_deleted > 0 then
    update public.tenant_lifecycle_batches
    set affected_counts = affected_counts || jsonb_build_object(
      v_key,
      coalesce((affected_counts ->> v_key)::integer, 0) + v_deleted
    )
    where id = p_batch_id;
  end if;

  return v_deleted;
end;
$$;

-- Fungsi ini menerima potongan SQL dinamis, jadi hanya boleh dipanggil dari
-- dalam delete_tenant_with_audit (SECURITY DEFINER, owner yang sama).
revoke all on function public.tenant_purge_related_rows(uuid, uuid, text, text, text, integer)
  from public;

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
        'delete_mode', 'fk_graph_delete_with_audit_backup'
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
    'affected_counts', coalesce(v_counts, '{}'::jsonb)
  );
end;
$$;

grant execute on function public.delete_tenant_with_audit(uuid, text, text)
  to authenticated;
