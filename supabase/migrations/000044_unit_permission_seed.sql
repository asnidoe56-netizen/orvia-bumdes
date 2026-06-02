-- =========================================================
-- Migration 000044: Unit Permission Seed
-- Purpose:
--   Ensure unit management permission contracts exist on fresh install.
--
-- Evidence:
--   Frontend create unit flow called backend permission contract:
--     unit.manage
--   but fresh install database did not contain unit.manage/unit.view
--   in permissions table, causing:
--     permission denied: unit.manage
-- =========================================================

insert into public.permissions (code, name, module, description)
select
  'unit.manage',
  'Kelola Unit Usaha',
  'unit',
  'Mengelola unit usaha BUMDes, termasuk membuat dan memperbarui unit.'
where not exists (
  select 1
  from public.permissions
  where code = 'unit.manage'
);

insert into public.permissions (code, name, module, description)
select
  'unit.view',
  'Lihat Unit Usaha',
  'unit',
  'Melihat daftar dan detail unit usaha BUMDes.'
where not exists (
  select 1
  from public.permissions
  where code = 'unit.view'
);

insert into public.role_permissions (role, permission_id)
select r.role::public.app_role, p.id
from (
  values
    ('super_admin_platform', 'unit.manage'),
    ('direktur_bumdes', 'unit.manage'),
    ('admin_bumdes', 'unit.manage'),

    ('super_admin_platform', 'unit.view'),
    ('direktur_bumdes', 'unit.view'),
    ('admin_bumdes', 'unit.view'),
    ('manager_unit', 'unit.view'),
    ('operator_unit', 'unit.view'),
    ('viewer_unit', 'unit.view')
) as r(role, permission_code)
join public.permissions p
  on p.code = r.permission_code
where not exists (
  select 1
  from public.role_permissions rp
  where rp.role = r.role::public.app_role
    and rp.permission_id = p.id
);
