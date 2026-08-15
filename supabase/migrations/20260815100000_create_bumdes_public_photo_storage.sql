-- Foto pengurus publik: berkasnya diunggah, bukan ditempel sebagai URL.
--
-- Sebelumnya operator harus mencari sendiri hosting gambar lalu menempel URL-nya.
-- Sekarang foto masuk ke bucket `bumdes-public` dengan jalur
-- `pengurus/<tenant_id>/<berkas>`. Segmen tenant pada jalur itulah kunci
-- isolasinya: satu BUMDes tidak pernah bisa menimpa atau menghapus foto milik
-- BUMDes lain, karena policy di bawah mencocokkan segmen tersebut dengan peran
-- yang benar-benar dimiliki pengguna.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'bumdes-public',
  'bumdes-public',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_manage_bumdes_public_asset(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  segments text[] := storage.foldername(object_name);
  target_tenant uuid;
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin_platform(auth.uid()) then
    return true;
  end if;

  if coalesce(array_length(segments, 1), 0) < 2 or segments[1] <> 'pengurus' then
    return false;
  end if;

  -- Nama objek datang dari klien, jadi segmen tenant belum tentu uuid.
  begin
    target_tenant := segments[2]::uuid;
  exception
    when others then
      return false;
  end;

  return public.has_role('direktur_bumdes'::public.app_role, auth.uid(), target_tenant, null)
    or public.has_role('admin_bumdes'::public.app_role, auth.uid(), target_tenant, null);
end;
$$;

grant execute on function public.can_manage_bumdes_public_asset(text) to authenticated;

-- Halaman publik BUMDes dibaca tanpa login, jadi isi bucket ini memang terbuka.
drop policy if exists bumdes_public_asset_read on storage.objects;
create policy bumdes_public_asset_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'bumdes-public');

drop policy if exists bumdes_public_asset_insert on storage.objects;
create policy bumdes_public_asset_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bumdes-public'
  and public.can_manage_bumdes_public_asset(name)
);

drop policy if exists bumdes_public_asset_update on storage.objects;
create policy bumdes_public_asset_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'bumdes-public'
  and public.can_manage_bumdes_public_asset(name)
)
with check (
  bucket_id = 'bumdes-public'
  and public.can_manage_bumdes_public_asset(name)
);

drop policy if exists bumdes_public_asset_delete on storage.objects;
create policy bumdes_public_asset_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'bumdes-public'
  and public.can_manage_bumdes_public_asset(name)
);
