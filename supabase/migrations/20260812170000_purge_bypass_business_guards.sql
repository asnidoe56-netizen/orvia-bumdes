-- Hapus tenant: lewati trigger aturan bisnis saat purge.
--
-- Penghapusan tenant 001 gagal dengan pesan:
--   "Detail Belanja Modal yang sudah posted/reversed tidak boleh diubah"
--
-- Itu trigger immutability akuntansi, bukan foreign key. Trigger semacam ini
-- benar dan wajib ada untuk operasi harian, tapi ia tidak membedakan operator
-- yang mengedit transaksi dengan admin platform yang membubarkan BUMDes.
-- Modul lain (jurnal, faktur, tutup buku) hampir pasti punya guard serupa,
-- jadi penanganannya harus generik, bukan per tabel.
--
-- Strategi: coba hapus seperti biasa. Kalau ditolak, matikan trigger buatan
-- pengguna KHUSUS untuk tabel itu, ulangi, lalu nyalakan lagi — semuanya di
-- dalam transaksi yang sama.
--
-- Yang sengaja TIDAK dilonggarkan: trigger foreign key adalah trigger sistem
-- dan tidak ikut dimatikan oleh DISABLE TRIGGER USER. Integritas relasi tetap
-- ditegakkan, urutan hapus tetap harus benar, dan baris tenant lain tetap
-- terlindungi. Setiap tabel yang guard-nya dilewati dicatat di metadata batch.

create or replace function public.tenant_purge_exec(
  p_batch_id uuid,
  p_schema text,
  p_table text,
  p_sql text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ident text := format('%I.%I', p_schema, p_table);
  v_key text := p_schema || '.' || p_table;
  v_rows integer := 0;
  v_guard text;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    return v_rows;
  exception
    when foreign_key_violation then
      raise exception 'Baris pada % masih dirujuk tabel lain sehingga tenant tidak bisa dihapus. Detail: %',
        v_key, sqlerrm;
    when others then
      -- Kemungkinan besar trigger aturan bisnis. Dicoba lagi tanpa trigger.
      v_guard := sqlerrm;
  end;

  -- Jangan menggantung menunggu ACCESS EXCLUSIVE kalau tabelnya sedang dipakai.
  perform set_config('lock_timeout', '5s', true);

  begin
    execute format('alter table %s disable trigger user', v_ident);
    execute p_sql;
    get diagnostics v_rows = row_count;
    execute format('alter table %s enable trigger user', v_ident);
  exception
    when lock_not_available then
      raise exception 'Tabel % sedang dipakai transaksi lain sehingga guard-nya tidak bisa dilewati. Coba lagi saat sistem lengang. Guard: %',
        v_key, v_guard;
    when foreign_key_violation then
      raise exception 'Baris pada % masih dirujuk tabel lain sehingga tenant tidak bisa dihapus. Detail: %',
        v_key, sqlerrm;
    when others then
      raise exception 'Gagal membersihkan %: %. Penolakan pertama: %',
        v_key, sqlerrm, v_guard;
  end;

  -- Jejak audit: guard mana saja yang dilewati saat penghapusan ini.
  update public.tenant_lifecycle_batches
  set metadata = metadata || jsonb_build_object(
        'trigger_bypass',
        coalesce(metadata -> 'trigger_bypass', '[]'::jsonb) || to_jsonb(v_key)
      )
  where id = p_batch_id;

  return v_rows;
end;
$$;

revoke all on function public.tenant_purge_exec(uuid, text, text, text) from public;

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

  c_protected constant text[] := array[
    'public.tenant_lifecycle_batches',
    'public.tenant_lifecycle_backup_rows',
    'public.erp_tenant_reset_batches',
    'public.erp_tenant_reset_backup_rows',
    'public.erp_audit_copy_rows'
  ];

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
        perform public.tenant_purge_exec(
          p_batch_id,
          v_fk.child_schema,
          v_fk.child_table,
          format('update %s set %s where %s', v_child_ident, v_fk.child_null_set, v_child_where)
        );
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
      perform public.tenant_purge_exec(
        p_batch_id,
        v_fk.child_schema,
        v_fk.child_table,
        format('update %s set %s where %s', v_child_ident, v_fk.child_null_set, v_child_where)
      );

    elsif v_fk.delete_action = 'd' then
      perform public.tenant_purge_exec(
        p_batch_id,
        v_fk.child_schema,
        v_fk.child_table,
        format('update %s set %s where %s', v_child_ident, v_fk.child_default_set, v_child_where)
      );

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

  -- Guard aturan bisnis dilewati di sini kalau perlu.
  v_deleted := public.tenant_purge_exec(
    p_batch_id,
    p_schema,
    p_table,
    format('delete from %s where %s', v_ident, p_where)
  );

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

revoke all on function public.tenant_purge_related_rows(uuid, uuid, text, text, text, integer)
  from public;
