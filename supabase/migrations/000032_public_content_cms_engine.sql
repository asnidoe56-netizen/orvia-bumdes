-- =========================================================
-- Migration 000026: Public Content CMS Engine
-- ORVIA-BUMDES / ERP BUMDes
--
-- Packages:
--   - public landing/content sections
--   - public content items/cards
--   - public news/popup posts
--   - public site settings / branding
--   - public read views
--   - super_admin_platform CMS governance policies
--
-- Packaging decision:
--   - Seed only safe default product content.
--   - Do not seed environment-specific storage URLs.
--   - Do not seed real/news demo article as mandatory product data.
-- =========================================================

-- =========================================================
-- Tables
-- =========================================================

create table if not exists public.public_content_sections (
  id uuid primary key default gen_random_uuid(),
  section_key text not null unique,
  section_label text not null,
  eyebrow text,
  title text not null,
  subtitle text,
  body text,
  cta_label text,
  cta_href text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  image_url text,
  constraint public_content_sections_key_format_chk
    check (section_key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  constraint public_content_sections_cta_pair_chk
    check (
      (
        cta_label is null
        and cta_href is null
      )
      or
      (
        cta_label is not null
        and cta_href is not null
      )
    )
);

create table if not exists public.public_content_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.public_content_sections(id) on delete cascade,
  item_key text,
  title text not null,
  description text,
  icon_key text,
  link_label text,
  link_href text,
  display_order integer not null default 0,
  is_published boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint public_content_items_unique_key_per_section unique (section_id, item_key),
  constraint public_content_items_link_pair_chk
    check (
      (
        link_label is null
        and link_href is null
      )
      or
      (
        link_label is not null
        and link_href is not null
      )
    )
);

create table if not exists public.public_news_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text,
  content text,
  cover_image_url text,
  author_name text,
  published_at timestamptz,
  is_published boolean not null default false,
  display_order integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  link_href text,
  popup_enabled boolean not null default false,
  popup_delay_seconds integer not null default 5,
  popup_position text not null default 'top-right'::text,
  constraint public_news_posts_slug_format_chk
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text),
  constraint public_news_posts_popup_delay_chk
    check (
      popup_delay_seconds >= 0
      and popup_delay_seconds <= 60
    ),
  constraint public_news_posts_popup_position_chk
    check (
      popup_position = any (
        array[
          'top-right'::text,
          'top-left'::text,
          'bottom-right'::text,
          'bottom-left'::text
        ]
      )
    )
);

create table if not exists public.public_site_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null default 'default'::text unique,
  brand_name text not null default 'ORVIA-BUMDES'::text,
  brand_subtitle text not null default 'Core Global Governance Engine'::text,
  product_name text not null default 'ORVIA-BUMDES OS 1.0'::text,
  product_tagline text default 'Sistem operasi tata kelola, akuntansi, dan laporan BUMDes.'::text,
  initiator_name text default 'Ruang Inovasi Digital Daerah'::text,
  initiator_label text default 'Sebuah inisiatif dari'::text,
  logo_url text,
  favicon_url text,
  primary_cta_label text not null default 'Signup'::text,
  primary_cta_href text not null default '/register'::text,
  secondary_cta_label text not null default 'Login'::text,
  secondary_cta_href text not null default '/login'::text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- =========================================================
-- Indexes
-- =========================================================

create index if not exists idx_public_content_sections_published_order
  on public.public_content_sections (is_published, display_order, section_key);

create index if not exists idx_public_content_items_section_published_order
  on public.public_content_items (section_id, is_published, display_order);

create index if not exists idx_public_news_posts_published_order
  on public.public_news_posts (is_published, published_at desc, display_order);

-- =========================================================
-- Trigger helper
-- =========================================================

create or replace function public.set_public_content_updated_at()
returns trigger
language plpgsql
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- =========================================================
-- Triggers
-- =========================================================

drop trigger if exists trg_public_content_sections_updated_at on public.public_content_sections;
create trigger trg_public_content_sections_updated_at
before update on public.public_content_sections
for each row
execute function public.set_public_content_updated_at();

drop trigger if exists trg_public_content_items_updated_at on public.public_content_items;
create trigger trg_public_content_items_updated_at
before update on public.public_content_items
for each row
execute function public.set_public_content_updated_at();

drop trigger if exists trg_public_news_posts_updated_at on public.public_news_posts;
create trigger trg_public_news_posts_updated_at
before update on public.public_news_posts
for each row
execute function public.set_public_content_updated_at();

drop trigger if exists trg_public_site_settings_updated_at on public.public_site_settings;
create trigger trg_public_site_settings_updated_at
before update on public.public_site_settings
for each row
execute function public.set_public_content_updated_at();

-- =========================================================
-- Views
-- =========================================================

create or replace view public.v_public_landing_sections as
select
  id,
  section_key,
  section_label,
  eyebrow,
  title,
  subtitle,
  body,
  cta_label,
  cta_href,
  image_url,
  display_order
from public.public_content_sections
where is_published = true
order by display_order;

create or replace view public.v_public_landing_items as
select
  i.id,
  i.section_id,
  s.section_key,
  i.item_key,
  i.title,
  i.description,
  i.icon_key,
  i.link_label,
  i.link_href,
  i.display_order
from public.public_content_items i
join public.public_content_sections s
  on s.id = i.section_id
where i.is_published = true
  and s.is_published = true
order by s.display_order, i.display_order, i.item_key;

create or replace view public.v_public_news_posts as
select
  id,
  slug,
  title,
  excerpt,
  cover_image_url,
  author_name,
  published_at,
  display_order,
  link_href,
  popup_enabled,
  popup_delay_seconds,
  popup_position
from public.public_news_posts
where is_published = true;

create or replace view public.v_public_site_settings as
select
  id,
  setting_key,
  brand_name,
  brand_subtitle,
  product_name,
  product_tagline,
  initiator_name,
  initiator_label,
  logo_url,
  favicon_url,
  primary_cta_label,
  primary_cta_href,
  secondary_cta_label,
  secondary_cta_href,
  is_active,
  updated_at
from public.public_site_settings
where setting_key = 'default'::text
  and is_active = true;

-- =========================================================
-- RLS and Policies
-- =========================================================

alter table public.public_content_sections enable row level security;
alter table public.public_content_items enable row level security;
alter table public.public_news_posts enable row level security;
alter table public.public_site_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_content_sections'
      and policyname = 'Public can read published content sections'
  ) then
    create policy "Public can read published content sections"
    on public.public_content_sections
    for select
    to anon, authenticated
    using (is_published = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_content_sections'
      and policyname = 'Super admin can manage public content sections'
  ) then
    create policy "Super admin can manage public content sections"
    on public.public_content_sections
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    )
    with check (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_content_items'
      and policyname = 'Public can read published content items'
  ) then
    create policy "Public can read published content items"
    on public.public_content_items
    for select
    to anon, authenticated
    using (
      is_published = true
      and exists (
        select 1
        from public.public_content_sections s
        where s.id = public_content_items.section_id
          and s.is_published = true
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_content_items'
      and policyname = 'Super admin can manage public content items'
  ) then
    create policy "Super admin can manage public content items"
    on public.public_content_items
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    )
    with check (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_news_posts'
      and policyname = 'Public can read published news posts'
  ) then
    create policy "Public can read published news posts"
    on public.public_news_posts
    for select
    to anon, authenticated
    using (is_published = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_news_posts'
      and policyname = 'Super admin can manage public news posts'
  ) then
    create policy "Super admin can manage public news posts"
    on public.public_news_posts
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    )
    with check (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_site_settings'
      and policyname = 'Public can read active site settings'
  ) then
    create policy "Public can read active site settings"
    on public.public_site_settings
    for select
    to anon, authenticated
    using (is_active = true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'public_site_settings'
      and policyname = 'Super admin can manage public site settings'
  ) then
    create policy "Super admin can manage public site settings"
    on public.public_site_settings
    for all
    to authenticated
    using (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    )
    with check (
      exists (
        select 1
        from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role = 'super_admin_platform'::public.app_role
      )
    );
  end if;
end $$;

-- =========================================================
-- Grants
-- =========================================================

grant select on public.public_content_sections to anon, authenticated;
grant select on public.public_content_items to anon, authenticated;
grant select on public.public_news_posts to anon, authenticated;
grant select on public.public_site_settings to anon, authenticated;

grant insert, update, delete on public.public_content_sections to authenticated;
grant insert, update, delete on public.public_content_items to authenticated;
grant insert, update, delete on public.public_news_posts to authenticated;
grant insert, update, delete on public.public_site_settings to authenticated;

grant select on public.v_public_landing_sections to anon, authenticated;
grant select on public.v_public_landing_items to anon, authenticated;
grant select on public.v_public_news_posts to anon, authenticated;
grant select on public.v_public_site_settings to anon, authenticated;

-- =========================================================
-- Safe Default Seed Data
-- =========================================================

insert into public.public_site_settings (
  setting_key,
  brand_name,
  brand_subtitle,
  product_name,
  product_tagline,
  initiator_name,
  initiator_label,
  logo_url,
  favicon_url,
  primary_cta_label,
  primary_cta_href,
  secondary_cta_label,
  secondary_cta_href,
  is_active
)
values (
  'default',
  'RUANG INOVASI DIGITAL',
  'Core Global Governance Engine',
  'ORVIA-BUMDES OS 1.0',
  'Sistem operasi tata kelola, akuntansi, dan laporan BUMDes.',
  'Ruang Inovasi Digital Daerah',
  'Sebuah inisiatif dari',
  null,
  null,
  'Signup',
  '/register',
  'Login',
  '/login',
  true
)
on conflict (setting_key) do update
set
  brand_name = excluded.brand_name,
  brand_subtitle = excluded.brand_subtitle,
  product_name = excluded.product_name,
  product_tagline = excluded.product_tagline,
  initiator_name = excluded.initiator_name,
  initiator_label = excluded.initiator_label,
  primary_cta_label = excluded.primary_cta_label,
  primary_cta_href = excluded.primary_cta_href,
  secondary_cta_label = excluded.secondary_cta_label,
  secondary_cta_href = excluded.secondary_cta_href,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.public_content_sections (
  section_key,
  section_label,
  eyebrow,
  title,
  subtitle,
  body,
  cta_label,
  cta_href,
  image_url,
  display_order,
  is_published
)
values
(
  'beranda',
  'Beranda / Hero',
  'ORVIA-BUMDES Core Global Governance Engine by Ruang Inovasi Digital Daerah',
  'ORVIA-BUMDES OS 1.0',
  'Sistem operasi tata kelola, akuntansi, dan laporan BUMDes.',
  'Dibangun di atas Core Global Governance Engine sebagai inisiatif dari Ruang Inovasi Digital Daerah untuk membantu BUMDes mengelola tenant, unit usaha, transaksi, modal, laporan, audit, dan pengawasan dalam satu ekosistem digital yang tertib, transparan, dan akuntabel.',
  'Masuk ke Dashboard',
  '/login',
  null,
  1,
  true
),
(
  'aplikasi',
  'Aplikasi',
  'Aplikasi',
  'Satu ekosistem kerja untuk banyak peran.',
  'Platform ERP BUMDes yang menyatukan tenant, unit usaha, transaksi, laporan, dan pengawasan.',
  'Konten aplikasi ini dapat diperbarui dari Super Admin Platform agar informasi publik selalu relevan.',
  null,
  null,
  null,
  10,
  true
),
(
  'manajemen',
  'Manajemen',
  'Manajemen Platform',
  'Manajemen Platform yang Terstruktur untuk Ekosistem BUMDes yang Lebih Akuntabel.',
  'ORVIA-BUMDES dikelola dengan pendekatan organisasi modern yang menggabungkan teknologi, tata kelola, pendampingan, dan monitoring agar proses bisnis BUMDes menjadi lebih transparan, terukur, dan berkelanjutan.',
  'Halaman ini menjelaskan bagaimana ORVIA-BUMDES dikelola sebagai sebuah organisasi platform: mulai dari pengelola platform, tim teknologi dan sistem, tata kelola dan akuntansi, pendampingan implementasi, sampai monitoring dan evaluasi. Manajemen platform ini menjadi fondasi untuk menjaga akuntabilitas, transparansi, keamanan data, kualitas layanan, dan keberlanjutan ekosistem BUMDes.',
  'Lihat Struktur Manajemen',
  '/manajemen#struktur-manajemen',
  null,
  20,
  true
),
(
  'tentang',
  'Tentang',
  'Tentang ORVIA-BUMDES',
  'Platform tata kelola yang menjaga kepercayaan publik desa.',
  'ORVIA-BUMDES dibangun untuk membantu BUMDes bekerja lebih tertib, transparan, dan akuntabel.',
  'ORVIA-BUMDES dibangun untuk membantu BUMDes bekerja lebih tertib, transparan, dan akuntabel. Sistem ini menghubungkan proses usaha, keuangan, pelaporan, pendampingan, dan pengawasan dalam satu ekosistem yang terintegrasi. Filosofinya adalah kejernihan: jernih dalam mencatat, jernih dalam melaporkan, jernih dalam mengambil keputusan, dan jernih dalam mempertanggungjawabkan amanah desa.',
  null,
  null,
  null,
  40,
  true
)
on conflict (section_key) do update
set
  section_label = excluded.section_label,
  eyebrow = excluded.eyebrow,
  title = excluded.title,
  subtitle = excluded.subtitle,
  body = excluded.body,
  cta_label = excluded.cta_label,
  cta_href = excluded.cta_href,
  image_url = excluded.image_url,
  display_order = excluded.display_order,
  is_published = excluded.is_published,
  updated_at = now();

with aplikasi_section as (
  select id
  from public.public_content_sections
  where section_key = 'aplikasi'
  limit 1
)
insert into public.public_content_items (
  section_id,
  item_key,
  title,
  description,
  icon_key,
  link_label,
  link_href,
  display_order,
  is_published
)
select
  aplikasi_section.id,
  seed.item_key,
  seed.title,
  seed.description,
  seed.icon_key,
  seed.link_label,
  seed.link_href,
  seed.display_order,
  true
from aplikasi_section
cross join (
  values
    (
      'multi-tenant-bumdes',
      'Multi-Tenant BUMDes',
      'Satu sistem melayani banyak BUMDes dengan scope tenant dan unit yang terpisah.',
      'users',
      null::text,
      null::text,
      10
    ),
    (
      'role-dashboard',
      'Role-Based Dashboard',
      'Dashboard berbeda untuk Platform, BUMDes, Unit, Pengawas, Pendamping, Dinas PMD, Inspektorat, dan Bupati.',
      'dashboard',
      null::text,
      null::text,
      20
    ),
    (
      'governance-engine',
      'Governance Engine',
      'Transaksi, jurnal, koreksi, closing, dan audit dikendalikan melalui database RPC yang aman.',
      'shield',
      null::text,
      null::text,
      30
    )
) as seed(item_key, title, description, icon_key, link_label, link_href, display_order)
on conflict (section_id, item_key) do update
set
  title = excluded.title,
  description = excluded.description,
  icon_key = excluded.icon_key,
  link_label = excluded.link_label,
  link_href = excluded.link_href,
  display_order = excluded.display_order,
  is_published = excluded.is_published,
  updated_at = now();

-- =========================================================
-- Comments
-- =========================================================

comment on table public.public_content_sections is
'Public CMS sections for ORVIA-BUMDES landing pages such as beranda, aplikasi, manajemen, and tentang.';

comment on table public.public_content_items is
'Public CMS item/card records attached to landing sections.';

comment on table public.public_news_posts is
'Public news and popup content managed from Super Admin Platform.';

comment on table public.public_site_settings is
'Public branding, CTA, logo, and default site settings.';

comment on view public.v_public_landing_sections is
'Published public landing sections for frontend public pages.';

comment on view public.v_public_landing_items is
'Published public landing items joined with published sections.';

comment on view public.v_public_news_posts is
'Published public news posts including popup configuration.';

comment on view public.v_public_site_settings is
'Active default public site settings for branding and CTA.';
