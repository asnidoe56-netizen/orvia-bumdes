-- =========================================================
-- Migration 000043: Unit Templates RLS Policy
-- Purpose:
--   Ensure frontend can read active unit templates on fresh install.
--
-- Evidence:
--   unit_templates was seeded correctly and grants existed, but RLS
--   was enabled with no SELECT policy, causing the Template Unit
--   dropdown to return empty data from Supabase client.
-- =========================================================

grant select on public.unit_templates to anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'unit_templates'
      and policyname = 'unit_templates_select_public'
  ) then
    create policy unit_templates_select_public
    on public.unit_templates
    for select
    to anon, authenticated
    using (is_active = true);
  end if;
end $$;
