-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000042_public_content_rls_permission_helper.sql
-- Purpose : Fix public CMS manage policies blocked by user_roles RLS.
-- Notes   :
-- - Previous CMS policies queried user_roles directly.
-- - user_roles itself has RLS enabled, so nested policy checks may fail.
-- - Use SECURITY DEFINER permission helper as the source of truth.
-- ============================================================

begin;

drop policy if exists "Super admin can manage public content sections"
on public.public_content_sections;

create policy "Super admin can manage public content sections"
on public.public_content_sections
for all
to authenticated
using (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
)
with check (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
);

drop policy if exists "Super admin can manage public content items"
on public.public_content_items;

create policy "Super admin can manage public content items"
on public.public_content_items
for all
to authenticated
using (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
)
with check (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
);

drop policy if exists "Super admin can manage public news posts"
on public.public_news_posts;

create policy "Super admin can manage public news posts"
on public.public_news_posts
for all
to authenticated
using (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
)
with check (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
);

drop policy if exists "Super admin can manage public site settings"
on public.public_site_settings;

create policy "Super admin can manage public site settings"
on public.public_site_settings
for all
to authenticated
using (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
)
with check (
  public.has_permission(
    'platform.manage',
    auth.uid(),
    null::uuid,
    null::uuid
  )
);

commit;