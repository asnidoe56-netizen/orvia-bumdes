create table if not exists public.unit_revenue_receipt_account_rules (
  id uuid primary key default gen_random_uuid(),
  template_code text not null,
  jenis_unit_key text not null,
  revenue_account_code text not null,
  display_order integer not null default 100,
  is_active boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_revenue_receipt_account_rules_unique
    unique (template_code, jenis_unit_key, revenue_account_code)
);

comment on table public.unit_revenue_receipt_account_rules is
  'Aturan akun pendapatan yang boleh dipilih di form Terima Pendapatan berdasarkan template dan jenis unit. Untuk tahap awal, template JASA dibuka ke semua akun pendapatan aktif/postable.';

comment on column public.unit_revenue_receipt_account_rules.template_code is
  'Kode template unit, misalnya JASA.';

comment on column public.unit_revenue_receipt_account_rules.jenis_unit_key is
  'Kata kunci jenis_unit business_units. Contoh: transportasi cocok dengan Jasa transportasi.';

comment on column public.unit_revenue_receipt_account_rules.revenue_account_code is
  'Kode akun chart_of_accounts yang boleh dipakai oleh form Terima Pendapatan.';

insert into public.unit_revenue_receipt_account_rules (
  template_code,
  jenis_unit_key,
  revenue_account_code,
  display_order,
  is_active,
  note
)
values
  (
    'JASA',
    'transportasi',
    '4261',
    10,
    true,
    'Rule cadangan. Untuk tahap awal template JASA tetap dibuka ke semua akun pendapatan aktif/postable.'
  ),
  (
    'JASA',
    'transportasi',
    '4300',
    90,
    true,
    'Rule cadangan. Untuk tahap awal template JASA tetap dibuka ke semua akun pendapatan aktif/postable.'
  )
on conflict (template_code, jenis_unit_key, revenue_account_code)
do update set
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  note = excluded.note,
  updated_at = now();

create or replace function public.get_revenue_receipt_account_options(
  p_tenant_id uuid,
  p_unit_id uuid
)
returns table (
  id uuid,
  kode text,
  nama text
)
language sql
security definer
set search_path = public
as $$
  with unit_context as (
    select
      bu.id as unit_id,
      bu.tenant_id,
      lower(coalesce(bu.jenis_unit, '')) as jenis_unit_normalized,
      coalesce(ut.kode_template, '') as kode_template
    from public.business_units bu
    left join public.unit_templates ut
      on ut.id = bu.template_id
    where bu.tenant_id = p_tenant_id
      and bu.id = p_unit_id
  ),
  matching_rules as (
    select
      r.revenue_account_code,
      min(r.display_order) as display_order
    from unit_context uc
    join public.unit_revenue_receipt_account_rules r
      on r.is_active = true
     and r.template_code = uc.kode_template
     and uc.jenis_unit_normalized like '%' || lower(r.jenis_unit_key) || '%'
    group by r.revenue_account_code
  ),
  has_rules as (
    select exists(select 1 from matching_rules) as value
  )
  select
    coa.id,
    coa.kode,
    coa.nama
  from public.chart_of_accounts coa
  join unit_context uc
    on uc.tenant_id = coa.tenant_id
   and uc.unit_id = coa.unit_id
  left join matching_rules mr
    on mr.revenue_account_code = coa.kode
  cross join has_rules hr
  where coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.tipe = 'pendapatan'::public.coa_tipe
    and coa.account_type = 'PENDAPATAN'::public.account_type
    and coa.normal_balance = 'credit'
    and coa.is_active = true
    and coa.is_postable = true
    and (
      (
        uc.kode_template = 'JASA'
        and (
          (
            coa.kode like '42%'
            and coa.kode <> '4281'
          )
          or coa.kode = '4300'
        )
      )
      or
      (
        uc.kode_template <> 'JASA'
        and hr.value = true
        and mr.revenue_account_code is not null
      )
      or
      (
        uc.kode_template <> 'JASA'
        and hr.value = false
        and coa.kode in ('4310', '4400', '4300')
      )
    )
  order by
    case
      when uc.kode_template = 'JASA' then 100
      when hr.value = true then coalesce(mr.display_order, 9999)
      else 100
    end,
    coa.kode;
$$;

create or replace function public.is_revenue_receipt_account_allowed(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_revenue_account_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.get_revenue_receipt_account_options(p_tenant_id, p_unit_id) allowed
    where allowed.id = p_revenue_account_id
  );
$$;

grant execute on function public.get_revenue_receipt_account_options(uuid, uuid)
  to authenticated;

grant execute on function public.is_revenue_receipt_account_allowed(uuid, uuid, uuid)
  to authenticated;
