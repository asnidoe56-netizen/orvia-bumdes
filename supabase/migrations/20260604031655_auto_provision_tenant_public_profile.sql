-- Auto-provision public BUMDes profile after tenant approval.
-- Additive helper functions + minimal approve_tenant_registration patch.
-- Does not modify journal, posting, ledger, finance provisioning, or accounting period logic.

create or replace function public.generate_unique_tenant_public_slug(
  p_base_text text
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_base text;
  v_slug text;
  v_counter integer := 1;
begin
  v_base := lower(coalesce(nullif(trim(p_base_text), ''), 'bumdes'));

  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '(^-+|-+$)', '', 'g');

  if v_base is null or v_base = '' then
    v_base := 'bumdes';
  end if;

  v_slug := v_base;

  while exists (
    select 1
    from public.tenant_public_profiles p
    where p.public_slug = v_slug
  ) loop
    v_counter := v_counter + 1;
    v_slug := v_base || '-' || v_counter::text;
  end loop;

  return v_slug;
end;
$function$;

create or replace function public.provision_tenant_public_profile(
  p_tenant_id uuid,
  p_actor_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tenant public.tenants%rowtype;
  v_slug text;
  v_existing_slug text;
begin
  select *
  into v_tenant
  from public.tenants
  where id = p_tenant_id;

  if not found then
    raise exception 'Tenant tidak ditemukan';
  end if;

  select p.public_slug
  into v_existing_slug
  from public.tenant_public_profiles p
  where p.tenant_id = p_tenant_id;

  if v_existing_slug is not null then
    return v_existing_slug;
  end if;

  v_slug := public.generate_unique_tenant_public_slug(v_tenant.nama_bumdes);

  insert into public.tenant_public_profiles (
    tenant_id,
    public_slug,
    is_published,
    hero_title,
    hero_subtitle,
    tagline,
    profile_description,
    contact_phone,
    contact_email,
    contact_address,
    created_by,
    updated_by
  )
  values (
    v_tenant.id,
    v_slug,
    false,
    v_tenant.nama_bumdes,
    concat('Desa ', v_tenant.nama_desa, ', Kecamatan ', v_tenant.nama_kecamatan),
    'Profil resmi BUMDes ' || v_tenant.nama_bumdes,
    'Halaman profil publik BUMDes ' || v_tenant.nama_bumdes || ' sebagai sarana informasi, transparansi, dan layanan masyarakat.',
    v_tenant.nomor_whatsapp,
    v_tenant.email,
    v_tenant.alamat,
    p_actor_id,
    p_actor_id
  )
  on conflict (tenant_id) do nothing;

  insert into public.tenant_public_ppid (
    tenant_id,
    service_phone,
    service_email,
    service_address,
    service_hours,
    request_procedure,
    objection_procedure,
    is_published,
    created_by,
    updated_by
  )
  values (
    v_tenant.id,
    v_tenant.nomor_whatsapp,
    v_tenant.email,
    v_tenant.alamat,
    'Senin-Jumat, jam kerja layanan BUMDes',
    'Masyarakat dapat mengajukan permohonan informasi melalui kontak resmi BUMDes atau datang langsung ke alamat layanan.',
    'Keberatan informasi dapat diajukan melalui kontak resmi BUMDes untuk ditindaklanjuti oleh penanggung jawab layanan informasi.',
    false,
    p_actor_id,
    p_actor_id
  )
  on conflict (tenant_id) do nothing;

  return v_slug;
end;
$function$;

create or replace function public.approve_tenant_registration(
  p_registration_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_registration public.tenant_registrations%rowtype;
  v_tenant_id uuid;
  v_actor_role public.app_role;
  v_finance_result jsonb;
  v_period_id uuid;
  v_public_slug text;
  v_period_year integer := extract(year from current_date)::integer;
  v_period_month integer := extract(month from current_date)::integer;
  v_period_start date := date_trunc('month', current_date)::date;
  v_period_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  perform public.assert_user_has_permission(
    'platform.manage',
    auth.uid(),
    null,
    null
  );

  select *
  into v_registration
  from public.tenant_registrations
  where id = p_registration_id
  for update;

  if not found then
    raise exception 'Data registrasi tidak ditemukan';
  end if;

  if v_registration.status <> 'pending'::public.registration_status then
    raise exception 'Registrasi sudah diproses';
  end if;

  if v_registration.submitted_by is null then
    raise exception 'Registrasi lama belum memiliki akun login pemohon. Gunakan backfill direktur atau minta pemohon daftar ulang dengan password.';
  end if;

  if exists (
    select 1
    from public.tenants
    where lower(kode_bumdes) = lower(v_registration.kode_bumdes)
  ) then
    raise exception 'Kode BUMDes sudah terdaftar sebagai tenant';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'super_admin_platform'::public.app_role
  ) then
    raise exception 'User super_admin_platform tidak boleh menjadi direktur BUMDes';
  end if;

  if exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.tenant_id is not null
  ) then
    raise exception 'User pemohon sudah memiliki role pada tenant lain. Gunakan akun/email khusus untuk BUMDes ini.';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  order by
    case
      when ur.role = 'super_admin_platform' then 1
      else 2
    end
  limit 1;

  insert into public.tenants (
    nama_bumdes,
    kode_bumdes,
    nama_desa,
    nama_kecamatan,
    alamat,
    nomor_whatsapp,
    email,
    status,
    approved_at,
    approved_by
  )
  values (
    v_registration.nama_bumdes,
    v_registration.kode_bumdes,
    v_registration.nama_desa,
    v_registration.nama_kecamatan,
    v_registration.alamat,
    v_registration.nomor_whatsapp,
    v_registration.email,
    'active'::public.tenant_status,
    now(),
    auth.uid()
  )
  returning id into v_tenant_id;

  insert into public.profiles (
    id,
    full_name,
    phone,
    default_tenant_id
  )
  values (
    v_registration.submitted_by,
    coalesce(v_registration.requester_name, v_registration.nama_bumdes),
    v_registration.requester_phone,
    v_tenant_id
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = coalesce(excluded.phone, public.profiles.phone),
    default_tenant_id = excluded.default_tenant_id,
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    tenant_id,
    unit_id
  )
  select
    v_registration.submitted_by,
    'direktur_bumdes'::public.app_role,
    v_tenant_id,
    null::uuid
  where not exists (
    select 1
    from public.user_roles ur
    where ur.user_id = v_registration.submitted_by
      and ur.role = 'direktur_bumdes'::public.app_role
      and ur.tenant_id = v_tenant_id
      and ur.unit_id is null
  );

  v_finance_result := public.provision_tenant_core_finance_accounts(
    v_tenant_id,
    auth.uid()
  );

  insert into public.accounting_periods (
    tenant_id,
    unit_id,
    period_year,
    period_month,
    period_start,
    period_end,
    status,
    notes
  )
  values (
    v_tenant_id,
    null,
    v_period_year,
    v_period_month,
    v_period_start,
    v_period_end,
    'open',
    'Periode pusat otomatis dibuat saat approval registrasi BUMDes'
  )
  on conflict on constraint accounting_periods_scope_unique do nothing
  returning id into v_period_id;

  v_public_slug := public.provision_tenant_public_profile(
    v_tenant_id,
    auth.uid()
  );

  update public.tenant_registrations
  set
    status = 'approved'::public.registration_status,
    reviewed_at = now(),
    reviewed_by = auth.uid(),
    updated_at = now()
  where id = p_registration_id;

  perform public.log_audit_event(
    v_tenant_id,
    null::uuid,
    auth.uid(),
    v_actor_role,
    'tenant_registration_approved'::text,
    'tenant_registrations'::text,
    p_registration_id,
    'platform_dashboard'::text,
    v_tenant_id,
    'Registrasi BUMDes disetujui, tenant aktif dibuat, direktur ditetapkan, pondasi finance pusat diprovision, dan draft profil publik dibuat.'::text,
    jsonb_build_object(
      'registration_id', p_registration_id,
      'tenant_id', v_tenant_id,
      'submitted_by', v_registration.submitted_by,
      'nama_bumdes', v_registration.nama_bumdes,
      'kode_bumdes', v_registration.kode_bumdes,
      'director_role', 'direktur_bumdes',
      'finance_result', v_finance_result,
      'period_year', v_period_year,
      'period_month', v_period_month,
      'period_created', v_period_id is not null,
      'public_slug', v_public_slug,
      'public_profile_status', 'draft',
      'status', 'active'
    )
  );

  return v_tenant_id;
end;
$function$;

grant execute on function public.generate_unique_tenant_public_slug(text) to authenticated;
grant execute on function public.provision_tenant_public_profile(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';