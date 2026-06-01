-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 0000041: Common Trigger Helpers
--
-- Purpose:
--   Fresh-install safety patch for shared trigger helper functions.
--
-- Evidence:
--   Multiple migrations from 000005 onward create updated_at triggers using:
--     execute function public.set_updated_at();
--
--   Static migration audit found the function is referenced before it is packaged.
--   Active DB audit confirmed the current function definition.
--
-- Scope:
--   - Create public.set_updated_at()
--
-- Non-scope:
--   - No table changes
--   - No trigger changes
--   - No RLS/policy changes
--   - No engine behavior changes beyond packaging the existing helper
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

comment on function public.set_updated_at() is
  'Shared updated_at trigger helper. Packaged before migrations that attach updated_at triggers.';
