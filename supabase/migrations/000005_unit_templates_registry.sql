-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000004_unit_templates_registry.sql
-- Purpose : Unit template seed, unit transaction feature registry,
--           and available feature view.
-- Notes   : Baseline extracted from active development database.
-- Depends : 000001_extensions_enums.sql
--           000002_core_identity_tenant_unit.sql
--           000003_auth_roles_permissions.sql
-- ============================================================

begin;

-- ============================================================
-- UNIT TRANSACTION FEATURE TEMPLATES
-- ============================================================

create table if not exists public.unit_transaction_feature_templates (
  id uuid primary key default gen_random_uuid(),
  template_id uuid,
  feature_code text not null,
  feature_name text not null,
  feature_description text,
  feature_group text not null default 'global'::text,
  feature_kind text not null default 'transaction'::text,
  route_path text not null,
  icon_name text,
  backing_rpc_name text,
  required_permission_code text,
  is_global boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_transaction_feature_templates_template_id_fkey
    foreign key (template_id) references public.unit_templates(id) on delete cascade,
  constraint unit_transaction_feature_templates_scope_check
    check (
      (is_global = true and template_id is null)
      or
      (is_global = false and template_id is not null)
    )
);

create unique index if not exists ux_unit_transaction_feature_global
  on public.unit_transaction_feature_templates using btree (feature_code)
  where template_id is null and is_global = true;

create unique index if not exists ux_unit_transaction_feature_template
  on public.unit_transaction_feature_templates using btree (template_id, feature_code)
  where template_id is not null and is_global = false;

-- ============================================================
-- SEED: UNIT TEMPLATES
-- ============================================================

insert into public.unit_templates (
  id,
  kode_template,
  nama_template,
  deskripsi,
  is_active
)
values
  (
    '0b9c4b18-8bd0-499e-ab0b-0e5b521f56ad'::uuid,
    'JASA',
    'Unit Jasa',
    'Template unit untuk layanan jasa, sewa, administrasi, dan jasa umum.',
    true
  ),
  (
    'c7b097f0-69f9-4fc5-8814-955d298e5fda'::uuid,
    'PERDAGANGAN',
    'Unit Perdagangan',
    'Template unit untuk toko, warung, minimarket desa, dan perdagangan umum.',
    true
  ),
  (
    '70867a0b-1cc6-416e-889e-452125ed4145'::uuid,
    'PERTANIAN',
    'Unit Pertanian',
    'Template unit untuk usaha pertanian, perkebunan, hasil tani, dan saprodi.',
    true
  ),
  (
    'dc5aab06-ec59-4d50-845a-bacdb6586a0f'::uuid,
    'PETERNAKAN',
    'Unit Peternakan',
    'Template unit untuk usaha ternak, pakan, hasil ternak, dan layanan peternakan.',
    true
  ),
  (
    '6f45bd1e-0fa0-44b0-82c3-1f40db2e6313'::uuid,
    'SIMPAN_PINJAM',
    'Unit Simpan Pinjam',
    'Template unit untuk layanan simpan pinjam atau pembiayaan internal BUMDes.',
    true
  ),
  (
    'eb159e4d-c150-4bcc-95a9-0638ad12b70f'::uuid,
    'WISATA',
    'Unit Wisata',
    'Template unit untuk wisata desa, tiket, wahana, homestay, dan layanan wisata.',
    true
  )
on conflict (kode_template) do update
set
  nama_template = excluded.nama_template,
  deskripsi = excluded.deskripsi,
  is_active = excluded.is_active,
  updated_at = now();

-- ============================================================
-- SEED: UNIT TRANSACTION FEATURE TEMPLATES
-- ============================================================

with feature_seed as (
  select *
  from (
    values
      (
        '688c8390-fafb-4513-9c40-53b49b63a977'::uuid,
        null::text,
        'capital_expenditure',
        'Belanja Modal',
        'Catat pembelian aset operasional seperti peralatan, mesin, meubelair, bangunan, konstruksi, dan software.',
        'global_asset',
        'transaction',
        '/unit/dashboard/catat-transaksi/capital-expenditure',
        'Building2',
        'create_and_post_capital_expenditure',
        'capital_expenditure.create',
        true,
        true,
        20
      ),
      (
        '38a884ac-a431-47a0-b0ba-97fe69e475c6'::uuid,
        null::text,
        'capital_expenditure_debt_payment',
        'Bayar Hutang Belanja Modal',
        'Bayar hutang dari Belanja Modal kredit dan posting otomatis ke kas/bank serta jurnal.',
        'global_asset',
        'transaction',
        '/unit/dashboard/catat-transaksi/capital-debt-payment',
        'BadgeCheck',
        'pay_capital_expenditure_debt',
        'capital_expenditure.pay_debt',
        true,
        true,
        30
      ),
      (
        '9d7a6dfd-557b-42bc-9c26-42358632bf2b'::uuid,
        null::text,
        'customer_master',
        'Customer / Pelanggan',
        'Master data pelanggan, penerima layanan, atau pihak yang berhubungan dengan transaksi pendapatan unit.',
        'global_master_data',
        'master_data',
        '/unit/dashboard/master-data/customers',
        'Users',
        'create_customer',
        'customer.create',
        true,
        true,
        70
      ),
      (
        '53f731bf-9049-4404-b5f4-3f15b9c5cea9'::uuid,
        null::text,
        'fixed_asset_master',
        'Aset Tetap',
        'Engine pengelolaan aset tetap unit, termasuk aset hasil Belanja Modal, daftar aset aktif, nilai perolehan, dan dasar penyusutan.',
        'global_asset_management',
        'asset_engine',
        '/unit/dashboard/aset-tetap',
        'Building2',
        'post_monthly_fixed_asset_depreciation',
        'fixed_asset.view',
        true,
        true,
        80
      ),
      (
        '60f3c8fa-ae76-4b85-8a54-d20432a1107f'::uuid,
        null::text,
        'journal_correction',
        'Koreksi Transaksi',
        'Ajukan koreksi atas transaksi yang sudah diposting melalui alur governance dan persetujuan Pengawas.',
        'global_governance',
        'governance',
        '/unit/dashboard/catat-transaksi/koreksi-transaksi',
        'FilePenLine',
        'create_journal_correction_draft',
        'journal_correction.create',
        true,
        true,
        50
      ),
      (
        '73f81629-ca79-42bc-b75e-c06aad649968'::uuid,
        null::text,
        'operational_expense',
        'Beban Operasional',
        'Catat biaya operasional seperti gaji, listrik, transportasi, administrasi, pemeliharaan, dan beban usaha lainnya.',
        'global_expense',
        'transaction',
        '/unit/dashboard/catat-transaksi/beban-operasional',
        'ReceiptText',
        'create_and_post_operational_expense',
        'operational_expense.create',
        true,
        true,
        40
      ),
      (
        '40a59c8b-e2f2-42c8-8e16-cd5e0ff1771f'::uuid,
        null::text,
        'revenue_receipt',
        'Terima Pendapatan',
        'Catat penerimaan pendapatan unit seperti pendapatan jasa, pendapatan lain-lain, atau penerimaan pendapatan non-penjualan barang.',
        'global_income',
        'transaction',
        '/unit/dashboard/catat-transaksi/revenue-receipt',
        'HandCoins',
        'create_and_post_revenue_receipt',
        'revenue_receipt.create',
        true,
        true,
        10
      ),
      (
        '729869a8-039c-4a4b-a399-8f9249cafae6'::uuid,
        null::text,
        'supplier_master',
        'Supplier / Pemasok',
        'Master data pihak pemasok atau penyedia barang/jasa yang dapat digunakan oleh semua jenis unit, termasuk Belanja Modal.',
        'global_master_data',
        'master_data',
        '/unit/dashboard/master-data/suppliers',
        'Truck',
        'create_supplier',
        'supplier.create',
        true,
        true,
        60
      ),
      (
        'fa970963-eff2-4e5b-96f2-1f0c29130296'::uuid,
        'PERDAGANGAN',
        'purchase_cash',
        'Beli Tunai',
        'Catat pembelian barang dagang secara tunai.',
        'template_purchase',
        'transaction',
        '/unit/dashboard/catat-transaksi/beli-tunai',
        'ShoppingBag',
        'create_and_post_purchase_invoice',
        'purchase_invoice.create',
        false,
        true,
        110
      ),
      (
        '2ffcc369-107e-4d18-9c53-b0eab62efe83'::uuid,
        'PERDAGANGAN',
        'purchase_credit',
        'Beli Kredit',
        'Catat pembelian barang dagang secara kredit.',
        'template_purchase',
        'transaction',
        '/unit/dashboard/catat-transaksi/beli-kredit',
        'ClipboardList',
        'create_and_post_purchase_invoice',
        'purchase_invoice.create',
        false,
        true,
        120
      ),
      (
        '466ff381-f8b7-41bc-90d5-898dc96ba72b'::uuid,
        'PERDAGANGAN',
        'supplier_payment',
        'Bayar Hutang Supplier',
        'Bayar hutang pembelian barang dagang dari transaksi kredit.',
        'template_purchase',
        'transaction',
        '/unit/dashboard/catat-transaksi/supplier-payment',
        'BadgeCheck',
        'pay_supplier_purchase_invoice',
        'purchase_invoice.pay_supplier',
        false,
        true,
        130
      ),
      (
        'd2176cf5-c867-4875-a71b-bfebf185323c'::uuid,
        'PERDAGANGAN',
        'sales_cash',
        'Jual Tunai',
        'Catat penjualan barang dagang secara tunai.',
        'template_sales',
        'transaction',
        '/unit/dashboard/catat-transaksi/jual-tunai',
        'ShoppingCart',
        'create_and_post_sales_invoice',
        'sales_invoice.create',
        false,
        true,
        140
      ),
      (
        '92745948-acaf-43c7-ae14-2ed5342f2e81'::uuid,
        'PERDAGANGAN',
        'sales_credit',
        'Jual Kredit',
        'Catat penjualan barang dagang secara kredit.',
        'template_sales',
        'transaction',
        '/unit/dashboard/catat-transaksi/jual-kredit',
        'Receipt',
        'create_and_post_sales_invoice',
        'sales_invoice.create',
        false,
        true,
        150
      ),
      (
        '0bde8a76-e934-40db-8761-81adb35be839'::uuid,
        'SIMPAN_PINJAM',
        'savings_loan_application',
        'Pengajuan Pinjaman',
        'Kelola pengajuan pinjaman/pembiayaan perorangan atau kelompok.',
        'template_savings_loan',
        'transaction',
        '/unit/dashboard/simpan-pinjam/pengajuan',
        'FileText',
        'create_savings_loan_application',
        'savings_loan.application.view',
        false,
        true,
        210
      ),
      (
        'ee650948-3f32-46dc-af5e-b92059c67d3e'::uuid,
        'SIMPAN_PINJAM',
        'savings_loan_disbursement',
        'Pencairan Dana Pinjaman',
        'Posting pencairan dana pinjaman yang sudah diverifikasi.',
        'template_savings_loan',
        'transaction',
        '/unit/dashboard/simpan-pinjam/pencairan',
        'Send',
        'create_and_post_savings_loan_disbursement',
        'savings_loan.disbursement.create',
        false,
        true,
        220
      ),
      (
        '2ddf4954-d663-49db-b866-dd6d7b4cfc79'::uuid,
        'SIMPAN_PINJAM',
        'savings_loan_repayment',
        'Terima Angsuran Pinjaman',
        'Catat penerimaan angsuran pokok, jasa, administrasi, dan denda pinjaman.',
        'template_savings_loan',
        'transaction',
        '/unit/dashboard/simpan-pinjam/angsuran',
        'HandCoins',
        'create_and_post_savings_loan_repayment',
        'savings_loan.repayment.create',
        false,
        true,
        230
      )
  ) as s(
    id,
    template_code,
    feature_code,
    feature_name,
    feature_description,
    feature_group,
    feature_kind,
    route_path,
    icon_name,
    backing_rpc_name,
    required_permission_code,
    is_global,
    is_active,
    display_order
  )
),

resolved_seed as (
  select
    fs.id,
    ut.id as template_id,
    fs.feature_code,
    fs.feature_name,
    fs.feature_description,
    fs.feature_group,
    fs.feature_kind,
    fs.route_path,
    fs.icon_name,
    fs.backing_rpc_name,
    fs.required_permission_code,
    fs.is_global,
    fs.is_active,
    fs.display_order
  from feature_seed fs
  left join public.unit_templates ut
    on ut.kode_template = fs.template_code
),

updated as (
  update public.unit_transaction_feature_templates target
  set
    feature_name = seed.feature_name,
    feature_description = seed.feature_description,
    feature_group = seed.feature_group,
    feature_kind = seed.feature_kind,
    route_path = seed.route_path,
    icon_name = seed.icon_name,
    backing_rpc_name = seed.backing_rpc_name,
    required_permission_code = seed.required_permission_code,
    is_active = seed.is_active,
    display_order = seed.display_order,
    updated_at = now()
  from resolved_seed seed
  where target.feature_code = seed.feature_code
    and (
      (seed.is_global = true and target.is_global = true and target.template_id is null)
      or
      (seed.is_global = false and target.is_global = false and target.template_id = seed.template_id)
    )
  returning target.id
)

insert into public.unit_transaction_feature_templates (
  id,
  template_id,
  feature_code,
  feature_name,
  feature_description,
  feature_group,
  feature_kind,
  route_path,
  icon_name,
  backing_rpc_name,
  required_permission_code,
  is_global,
  is_active,
  display_order
)
select
  seed.id,
  seed.template_id,
  seed.feature_code,
  seed.feature_name,
  seed.feature_description,
  seed.feature_group,
  seed.feature_kind,
  seed.route_path,
  seed.icon_name,
  seed.backing_rpc_name,
  seed.required_permission_code,
  seed.is_global,
  seed.is_active,
  seed.display_order
from resolved_seed seed
where not exists (
  select 1
  from public.unit_transaction_feature_templates target
  where target.feature_code = seed.feature_code
    and (
      (seed.is_global = true and target.is_global = true and target.template_id is null)
      or
      (seed.is_global = false and target.is_global = false and target.template_id = seed.template_id)
    )
);

-- ============================================================
-- VIEW: AVAILABLE FEATURES PER UNIT
-- ============================================================

create or replace view public.v_unit_available_transaction_features as
select
  bu.tenant_id,
  bu.id as unit_id,
  bu.kode_unit,
  bu.nama_unit,
  bu.jenis_unit,
  ut.id as template_id,
  ut.kode_template,
  ut.nama_template,
  utf.id as feature_template_id,
  utf.feature_code,
  utf.feature_name,
  utf.feature_description,
  utf.feature_group,
  utf.feature_kind,
  utf.route_path,
  utf.icon_name,
  utf.backing_rpc_name,
  utf.required_permission_code,
  utf.is_global,
  utf.is_active,
  utf.display_order
from public.business_units bu
left join public.unit_templates ut
  on ut.id = bu.template_id
join public.unit_transaction_feature_templates utf
  on utf.is_active = true
 and (
   utf.is_global = true
   or utf.template_id = bu.template_id
 )
where bu.status = 'aktif'::public.unit_status;

grant select on public.v_unit_available_transaction_features to authenticated, service_role;

commit;
