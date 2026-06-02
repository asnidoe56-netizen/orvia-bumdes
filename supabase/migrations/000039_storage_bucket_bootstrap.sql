-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000039_storage_bucket_bootstrap.sql
-- Purpose : Bootstrap public storage bucket for CMS/public landing assets.
-- Notes   :
-- - Fresh-install compatibility patch.
-- - Creates public-content bucket used by public CMS images/logo.
-- - Adds storage.objects policies for public read and authenticated CMS uploads.
-- ============================================================

begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'public-content',
  'public-content',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif'
  ]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types,
  updated_at = now();

do $do$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_content_public_read'
  ) then
    create policy public_content_public_read
    on storage.objects
    for select
    to public
    using (bucket_id = 'public-content');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_content_authenticated_insert'
  ) then
    create policy public_content_authenticated_insert
    on storage.objects
    for insert
    to authenticated
    with check (bucket_id = 'public-content');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_content_authenticated_update'
  ) then
    create policy public_content_authenticated_update
    on storage.objects
    for update
    to authenticated
    using (bucket_id = 'public-content')
    with check (bucket_id = 'public-content');
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'public_content_authenticated_delete'
  ) then
    create policy public_content_authenticated_delete
    on storage.objects
    for delete
    to authenticated
    using (bucket_id = 'public-content');
  end if;
end;
$do$;

commit;