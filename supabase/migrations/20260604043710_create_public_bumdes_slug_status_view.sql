-- Minimal public status view for BUMDes public profile add-on.
-- This view intentionally exposes only non-sensitive public identity and publish status.
-- It allows /bumdes/[slug] to show an inactive/add-on message instead of 404.

create or replace view public.v_public_bumdes_slug_status as
select
  p.public_slug,
  p.is_published,
  t.nama_bumdes,
  t.kode_bumdes,
  t.nama_desa,
  t.nama_kecamatan
from public.tenant_public_profiles p
join public.tenants t on t.id = p.tenant_id
where t.status = 'active'::public.tenant_status;

grant select on public.v_public_bumdes_slug_status to anon, authenticated;

notify pgrst, 'reload schema';