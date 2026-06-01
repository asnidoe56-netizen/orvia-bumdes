-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000005_chart_of_accounts_engine.sql
--
-- Scope:
-- - COA template global
-- - COA template per unit template
-- - Tenant/unit chart of accounts
-- - Accounting rule templates
-- - COA provisioning functions only
-- - Journal correction account option view
--
-- Notes:
-- - Fresh-install baseline.
-- - Does not patch existing production/dev COA history.
-- - Cash-bank/equity/profit-sharing provisioning is deferred.
-- ============================================================

begin;

-- ============================================================
-- 1. COA TEMPLATE GLOBAL
-- ============================================================

create table if not exists public.coa_template_global (
  id uuid primary key default gen_random_uuid(),
  kode text not null unique,
  parent_kode text,
  nama text not null,
  tipe public.coa_tipe not null,
  account_type public.account_type not null,
  normal_balance text not null,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint coa_template_global_normal_balance_check
    check (normal_balance in ('debit', 'credit')),
  constraint coa_template_global_parent_not_self_check
    check (parent_kode is null or parent_kode <> kode)
);

alter table public.coa_template_global
  add column if not exists parent_kode text;

alter table public.coa_template_global
  add column if not exists is_postable boolean not null default true;

alter table public.coa_template_global
  add column if not exists display_order integer not null default 100;

-- ============================================================
-- 2. COA TEMPLATE UNIT
-- ============================================================

create table if not exists public.coa_template_unit (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.unit_templates(id) on delete cascade,
  kode text not null,
  parent_kode text,
  nama text not null,
  tipe public.coa_tipe not null,
  account_type public.account_type not null,
  normal_balance text not null,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  constraint coa_template_unit_normal_balance_check
    check (normal_balance in ('debit', 'credit')),
  constraint coa_template_unit_parent_not_self_check
    check (parent_kode is null or parent_kode <> kode),
  constraint coa_template_unit_unique unique (template_id, kode)
);

alter table public.coa_template_unit
  add column if not exists parent_kode text;

alter table public.coa_template_unit
  add column if not exists is_postable boolean not null default true;

alter table public.coa_template_unit
  add column if not exists display_order integer not null default 100;

create index if not exists coa_template_unit_template_idx
  on public.coa_template_unit(template_id);

create index if not exists coa_template_unit_parent_kode_idx
  on public.coa_template_unit(template_id, parent_kode);

-- ============================================================
-- 3. CHART OF ACCOUNTS
-- ============================================================

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  parent_id uuid references public.chart_of_accounts(id) on delete set null,
  kode text not null,
  nama text not null,
  tipe public.coa_tipe not null,
  account_type public.account_type not null,
  normal_balance text not null,
  is_postable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chart_of_accounts_normal_balance_check
    check (normal_balance in ('debit', 'credit')),
  constraint chart_of_accounts_scope_kode_unique
    unique nulls not distinct (tenant_id, unit_id, kode)
);

create index if not exists chart_of_accounts_tenant_idx
  on public.chart_of_accounts(tenant_id);

create index if not exists chart_of_accounts_unit_idx
  on public.chart_of_accounts(unit_id);

create index if not exists chart_of_accounts_parent_idx
  on public.chart_of_accounts(parent_id);

drop trigger if exists trg_chart_of_accounts_set_updated_at on public.chart_of_accounts;
create trigger trg_chart_of_accounts_set_updated_at
before update on public.chart_of_accounts
for each row
execute function public.set_updated_at();

-- ============================================================
-- 4. ACCOUNTING RULE TEMPLATES
-- ============================================================

create table if not exists public.accounting_rule_templates (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.unit_templates(id) on delete cascade,
  rule_code text not null,
  rule_name text not null,
  cash_account_code text,
  bank_account_code text,
  inventory_account_code text,
  receivable_account_code text,
  payable_account_code text,
  sales_account_code text,
  cogs_account_code text,
  purchase_account_code text,
  expense_account_code text,
  equity_account_code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint accounting_rule_templates_unique
    unique nulls not distinct (template_id, rule_code)
);

create index if not exists accounting_rule_templates_template_idx
  on public.accounting_rule_templates(template_id);

drop trigger if exists trg_accounting_rule_templates_set_updated_at on public.accounting_rule_templates;
create trigger trg_accounting_rule_templates_set_updated_at
before update on public.accounting_rule_templates
for each row
execute function public.set_updated_at();

-- ============================================================
-- 5. SEED COA TEMPLATE GLOBAL
-- ============================================================

with seed(kode, parent_kode, nama, tipe, account_type, normal_balance, is_postable, display_order) as (
  values
    ('1000', null,   'Aset',                                      'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  false, 1000),
    ('1100', '1000', 'Kas dan Setara Kas',                         'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  false, 1100),
    ('1110', '1100', 'Kas',                                        'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1110),
    ('1111', '1100', 'Kas Alokasi Bagi Hasil',                     'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1111),
    ('1120', '1100', 'Bank',                                       'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1120),
    ('1130', '1200', 'Piutang Penjualan Kredit',                   'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1130),
    ('1200', '1000', 'Piutang Usaha',                              'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1200),
    ('1300', '1000', 'Persediaan Barang Dagangan',                 'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1300),
    ('1500', '1000', 'Aset Tetap',                                 'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  false, 1500),
    ('1501', '1500', 'Peralatan dan Mesin',                        'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1501),
    ('1502', '1500', 'Meubelair',                                  'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1502),
    ('1503', '1500', 'Gedung dan Bangunan',                        'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1503),
    ('1504', '1500', 'Konstruksi Dalam Pengerjaan',                'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1504),
    ('1590', '1500', 'Akumulasi Penyusutan Aset Tetap',            'aset'::public.coa_tipe,       'ASET'::public.account_type,       'credit', true,  1590),
    ('1601', '1000', 'Aset Tak Berwujud',                          'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1601),
    ('1602', '1601', 'Software',                                   'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1602),

    ('2000', null,   'Kewajiban',                                  'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', false, 2000),
    ('2100', '2000', 'Utang Usaha',                                'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2100),
    ('2110', '2100', 'Utang Pembelian',                            'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2110),
    ('2120', '2100', 'Utang Belanja Modal',                        'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2120),
    ('2200', '2000', 'Utang Lain-lain',                            'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2200),
    ('2300', '2000', 'Utang Bagi Hasil PADes',                     'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2300),
    ('2310', '2000', 'Utang Dana Sosial',                          'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2310),
    ('2320', '2000', 'Utang Insentif Pengurus',                    'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2320),

    ('3000', null,   'Ekuitas',                                    'ekuitas'::public.coa_tipe,   'EKUITAS'::public.account_type,    'credit', false, 3000),
    ('3100', '3000', 'Modal BUMDes',                               'ekuitas'::public.coa_tipe,   'EKUITAS'::public.account_type,    'credit', true,  3100),
    ('3200', '3000', 'Saldo Laba Ditahan',                         'ekuitas'::public.coa_tipe,   'EKUITAS'::public.account_type,    'credit', true,  3200),
    ('3210', '3200', 'Cadangan Modal',                             'ekuitas'::public.coa_tipe,   'EKUITAS'::public.account_type,    'credit', true,  3210),
    ('3300', '3000', 'Surplus Defisit Tahun Berjalan',             'ekuitas'::public.coa_tipe,   'EKUITAS'::public.account_type,    'credit', true,  3300),

    ('4000', null,   'Pendapatan',                                 'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', false, 4000),
    ('4100', '4000', 'Pendapatan Penjualan Barang Dagangan',        'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', true,  4100),
    ('4200', '4000', 'Pendapatan Jasa',                            'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', true,  4200),
    ('4300', '4000', 'Pendapatan Lain-lain',                       'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', false, 4300),
    ('4310', '4300', 'Pendapatan Lain-lain Lainnya',               'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', true,  4310),
    ('4400', '4000', 'Pendapatan Penjualan Lainnya',               'pendapatan'::public.coa_tipe,'PENDAPATAN'::public.account_type, 'credit', true,  4400),

    ('5000', null,   'Harga Pokok Penjualan',                      'beban'::public.coa_tipe,     'HPP'::public.account_type,        'debit',  false, 5000),
    ('5100', '5000', 'HPP Barang Dagang',                          'beban'::public.coa_tipe,     'HPP'::public.account_type,        'debit',  true,  5100),

    ('6000', null,   'Beban Operasional',                          'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  false, 6000),
    ('6100', '6000', 'Beban Gaji dan Honor',                       'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6100),
    ('6200', '6000', 'Beban Administrasi',                         'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6200),
    ('6300', '6000', 'Beban Transportasi',                         'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6300),
    ('6400', '6000', 'Beban Penyusutan',                           'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6400),
    ('6500', '6000', 'Beban Cadangan Kerugian Pinjaman',           'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6500),
    ('6900', '6000', 'Beban Lain-lain',                            'beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6900)
)
insert into public.coa_template_global (
  kode,
  parent_kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  is_postable,
  is_active,
  display_order
)
select
  kode,
  parent_kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  is_postable,
  true,
  display_order
from seed
on conflict (kode) do update
set
  parent_kode = excluded.parent_kode,
  nama = excluded.nama,
  tipe = excluded.tipe,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_postable = excluded.is_postable,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- ============================================================
-- 6. SEED COA TEMPLATE UNIT
-- ============================================================

insert into public.coa_template_unit (
  template_id,
  kode,
  parent_kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  is_postable,
  is_active,
  display_order
)
select
  ut.id,
  cg.kode,
  cg.parent_kode,
  cg.nama,
  cg.tipe,
  cg.account_type,
  cg.normal_balance,
  cg.is_postable,
  true,
  cg.display_order
from public.unit_templates ut
cross join public.coa_template_global cg
where ut.is_active = true
on conflict (template_id, kode) do update
set
  parent_kode = excluded.parent_kode,
  nama = excluded.nama,
  tipe = excluded.tipe,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_postable = excluded.is_postable,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- Simpan Pinjam specific overrides/additions.
with simpan_pinjam_template as (
  select id
  from public.unit_templates
  where kode_template = 'SIMPAN_PINJAM'
  limit 1
),
seed(kode, parent_kode, nama, tipe, account_type, normal_balance, is_postable, display_order) as (
  values
    ('1210', '1200', 'Piutang Pinjaman Anggota',        'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1210),
    ('1220', '1200', 'Piutang Jasa/Margin Pinjaman',    'aset'::public.coa_tipe,       'ASET'::public.account_type,       'debit',  true,  1220),
    ('1230', '1200', 'Cadangan Kerugian Pinjaman',      'aset'::public.coa_tipe,       'ASET'::public.account_type,       'credit', true,  1230),
    ('2110', '2100', 'Simpanan Anggota',                'kewajiban'::public.coa_tipe, 'KEWAJIBAN'::public.account_type, 'credit', true,  2110),
    ('6500', '6000', 'Beban Cadangan Kerugian Pinjaman','beban'::public.coa_tipe,     'BEBAN'::public.account_type,      'debit',  true,  6500)
)
insert into public.coa_template_unit (
  template_id,
  kode,
  parent_kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  is_postable,
  is_active,
  display_order
)
select
  sp.id,
  seed.kode,
  seed.parent_kode,
  seed.nama,
  seed.tipe,
  seed.account_type,
  seed.normal_balance,
  seed.is_postable,
  true,
  seed.display_order
from simpan_pinjam_template sp
cross join seed
on conflict (template_id, kode) do update
set
  parent_kode = excluded.parent_kode,
  nama = excluded.nama,
  tipe = excluded.tipe,
  account_type = excluded.account_type,
  normal_balance = excluded.normal_balance,
  is_postable = excluded.is_postable,
  is_active = excluded.is_active,
  display_order = excluded.display_order;

-- ============================================================
-- 7. SEED ACCOUNTING RULE TEMPLATES
-- ============================================================

with template_rules as (
  select
    ut.id as template_id,
    ut.kode_template,
    case
      when ut.kode_template = 'JASA' then '4200'
      when ut.kode_template = 'SIMPAN_PINJAM' then '4200'
      else '4100'
    end as sales_account_code
  from public.unit_templates ut
  where ut.is_active = true
)
insert into public.accounting_rule_templates (
  template_id,
  rule_code,
  rule_name,
  cash_account_code,
  bank_account_code,
  inventory_account_code,
  receivable_account_code,
  payable_account_code,
  sales_account_code,
  cogs_account_code,
  purchase_account_code,
  expense_account_code,
  equity_account_code,
  is_active
)
select
  tr.template_id,
  'DEFAULT',
  'Aturan Akuntansi Default',
  '1110',
  '1120',
  '1300',
  case
    when tr.kode_template = 'SIMPAN_PINJAM' then '1210'
    else '1200'
  end,
  case
    when tr.kode_template = 'SIMPAN_PINJAM' then '2110'
    else '2100'
  end,
  tr.sales_account_code,
  '5100',
  '5100',
  '6200',
  '3100',
  true
from template_rules tr
on conflict on constraint accounting_rule_templates_unique do update
set
  rule_name = excluded.rule_name,
  cash_account_code = excluded.cash_account_code,
  bank_account_code = excluded.bank_account_code,
  inventory_account_code = excluded.inventory_account_code,
  receivable_account_code = excluded.receivable_account_code,
  payable_account_code = excluded.payable_account_code,
  sales_account_code = excluded.sales_account_code,
  cogs_account_code = excluded.cogs_account_code,
  purchase_account_code = excluded.purchase_account_code,
  expense_account_code = excluded.expense_account_code,
  equity_account_code = excluded.equity_account_code,
  is_active = excluded.is_active,
  updated_at = now();

-- ============================================================
-- 8. COA PROVISIONING FUNCTIONS
-- ============================================================

create or replace function public.provision_tenant_mandatory_accounting_coa(
  p_tenant_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_created_or_updated_count integer := 0;
  v_row_count integer := 0;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if not exists (
    select 1
    from public.tenants t
    where t.id = p_tenant_id
      and t.status = 'active'
  ) then
    raise exception 'Tenant tidak ditemukan atau tidak aktif';
  end if;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    is_postable,
    is_active
  )
  select
    p_tenant_id,
    null,
    cg.kode,
    cg.nama,
    cg.tipe,
    cg.account_type,
    cg.normal_balance,
    cg.is_postable,
    true
  from public.coa_template_global cg
  where cg.is_active = true
  on conflict on constraint chart_of_accounts_scope_kode_unique do update
  set
    nama = excluded.nama,
    tipe = excluded.tipe,
    account_type = excluded.account_type,
    normal_balance = excluded.normal_balance,
    is_postable = excluded.is_postable,
    is_active = true,
    updated_at = now();

  get diagnostics v_row_count = row_count;
  v_created_or_updated_count := v_created_or_updated_count + v_row_count;

  update public.chart_of_accounts child
  set
    parent_id = parent.id,
    updated_at = now()
  from public.coa_template_global cg
  join public.chart_of_accounts parent
    on parent.tenant_id = p_tenant_id
   and parent.unit_id is null
   and parent.kode = cg.parent_kode
  where child.tenant_id = p_tenant_id
    and child.unit_id is null
    and child.kode = cg.kode
    and cg.parent_kode is not null
    and child.parent_id is distinct from parent.id;

  get diagnostics v_row_count = row_count;
  v_created_or_updated_count := v_created_or_updated_count + v_row_count;

  return v_created_or_updated_count;
end;
$function$;

create or replace function public.provision_unit_mandatory_accounting_coa(
  p_tenant_id uuid,
  p_unit_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_created_or_updated_count integer := 0;
  v_row_count integer := 0;
  v_unit record;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  select
    bu.id,
    bu.tenant_id,
    bu.template_id,
    bu.kode_unit,
    bu.nama_unit,
    bu.status
  into v_unit
  from public.business_units bu
  where bu.id = p_unit_id
    and bu.tenant_id = p_tenant_id
    and bu.status = 'aktif'::public.unit_status;

  if v_unit.id is null then
    raise exception 'Unit tidak ditemukan atau tidak aktif';
  end if;

  if v_unit.template_id is null then
    raise exception 'Unit belum memiliki template_id';
  end if;

  insert into public.chart_of_accounts (
    tenant_id,
    unit_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    is_postable,
    is_active
  )
  select
    p_tenant_id,
    p_unit_id,
    ctu.kode,
    ctu.nama,
    ctu.tipe,
    ctu.account_type,
    ctu.normal_balance,
    ctu.is_postable,
    true
  from public.coa_template_unit ctu
  where ctu.template_id = v_unit.template_id
    and ctu.is_active = true
  on conflict on constraint chart_of_accounts_scope_kode_unique do update
  set
    nama = excluded.nama,
    tipe = excluded.tipe,
    account_type = excluded.account_type,
    normal_balance = excluded.normal_balance,
    is_postable = excluded.is_postable,
    is_active = true,
    updated_at = now();

  get diagnostics v_row_count = row_count;
  v_created_or_updated_count := v_created_or_updated_count + v_row_count;

  update public.chart_of_accounts child
  set
    parent_id = parent.id,
    updated_at = now()
  from public.coa_template_unit ctu
  join public.chart_of_accounts parent
    on parent.tenant_id = p_tenant_id
   and parent.unit_id = p_unit_id
   and parent.kode = ctu.parent_kode
  where child.tenant_id = p_tenant_id
    and child.unit_id = p_unit_id
    and child.kode = ctu.kode
    and ctu.template_id = v_unit.template_id
    and ctu.parent_kode is not null
    and child.parent_id is distinct from parent.id;

  get diagnostics v_row_count = row_count;
  v_created_or_updated_count := v_created_or_updated_count + v_row_count;

  return v_created_or_updated_count;
end;
$function$;

grant execute on function public.provision_tenant_mandatory_accounting_coa(uuid)
  to authenticated, service_role;

grant execute on function public.provision_unit_mandatory_accounting_coa(uuid, uuid)
  to authenticated, service_role;

-- ============================================================
-- 9. ACCOUNT OPTIONS VIEW
-- ============================================================

create or replace view public.v_journal_correction_account_options as
select
  coa.id as account_id,
  coa.tenant_id,
  coa.unit_id,
  coa.kode as account_code,
  coa.nama as account_name,
  coa.tipe as account_tipe,
  coa.account_type,
  coa.normal_balance,
  coa.is_postable,
  coa.is_active
from public.chart_of_accounts coa
where coa.is_active = true
  and coa.is_postable = true
  and not exists (
    select 1
    from public.chart_of_accounts child
    where child.parent_id = coa.id
      and child.is_active = true
  );

grant select on public.v_journal_correction_account_options
  to authenticated, service_role;

commit;
