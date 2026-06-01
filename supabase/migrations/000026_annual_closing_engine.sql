-- ============================================================================
-- ORVIA-BUMDES OS 1.0
-- Migration 000020: Annual Closing Engine
--
-- Scope:
--   Tutup Buku Tahunan / Annual Closing.
--
-- Accounting flow:
--   - Calculate revenue, HPP, expenses, surplus/deficit from posted ledger.
--   - Post closing journal on 31 December.
--   - Close revenue accounts by debiting revenue.
--   - Close HPP/expense accounts by crediting HPP/expense.
--   - Credit retained earnings account 3200 for positive surplus.
--
-- Engine rules:
--   - Unit-scoped annual closing.
--   - One closing per tenant/unit/year.
--   - Posted/locked annual closing cannot be recalculated.
--   - Locked annual closing cannot be directly mutated.
--   - Posting validates current ledger equals calculated annual closing amount.
--
-- Status:
--   BASELINE_COMPLETE_NEEDS_FRESH_INSTALL_TEST
-- ============================================================================

-- ============================================================================
-- 1. Annual closings table
-- ============================================================================

create table if not exists public.annual_closings (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,

  closing_year integer not null,

  status text not null default 'draft'
    check (status = any (array[
      'draft'::text,
      'calculated'::text,
      'approved'::text,
      'posted'::text,
      'locked'::text,
      'reopened'::text
    ])),

  revenue_total numeric(18,2) not null default 0,
  expense_total numeric(18,2) not null default 0,
  surplus_deficit numeric(18,2) not null default 0,
  retained_earnings_amount numeric(18,2) not null default 0,

  journal_entry_id uuid references public.journal_entries(id) on delete restrict,

  calculated_at timestamptz,
  calculated_by uuid references auth.users(id) on delete set null,

  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,

  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,

  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint annual_closings_year_check
    check (closing_year >= 2000),

  constraint annual_closings_scope_year_unique
    unique nulls not distinct (tenant_id, unit_id, closing_year)
);

create index if not exists annual_closings_tenant_idx
  on public.annual_closings (tenant_id);

create index if not exists annual_closings_unit_idx
  on public.annual_closings (unit_id);

-- ============================================================================
-- 2. Locked mutation guard
-- ============================================================================

create or replace function public.prevent_locked_annual_closing_mutation()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' and old.status = 'locked' then
    raise exception 'locked annual closing cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status = 'locked' then
    raise exception 'locked annual closing cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_annual_closings_set_updated_at
on public.annual_closings;

drop trigger if exists trg_prevent_locked_annual_closing_mutation
on public.annual_closings;

create trigger trg_annual_closings_set_updated_at
before update on public.annual_closings
for each row
execute function public.set_updated_at();

create trigger trg_prevent_locked_annual_closing_mutation
before update or delete on public.annual_closings
for each row
execute function public.prevent_locked_annual_closing_mutation();

-- ============================================================================
-- 3. RPC: calculate annual closing
-- ============================================================================

create or replace function public.calculate_annual_closing(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_closing_year integer,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_annual_closing_id uuid;
  v_revenue_total numeric := 0;
  v_expense_total numeric := 0;
  v_surplus_deficit numeric := 0;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_tenant_id is null then
    raise exception 'Tenant wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'Unit wajib diisi untuk annual closing unit';
  end if;

  if p_closing_year is null or p_closing_year < 2000 then
    raise exception 'Tahun closing tidak valid';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  if not public.can_access_unit(p_unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    p_tenant_id,
    p_unit_id
  );

  if exists (
    select 1
    from public.annual_closings ac
    where ac.tenant_id = p_tenant_id
      and ac.unit_id is not distinct from p_unit_id
      and ac.closing_year = p_closing_year
      and ac.status in ('posted', 'locked')
  ) then
    raise exception 'Annual closing tahun % sudah posted/locked dan tidak dapat dihitung ulang', p_closing_year;
  end if;

  select
    coalesce(sum(
      case
        when coa.account_type = 'PENDAPATAN'::public.account_type
          then jl.credit - jl.debit
        else 0
      end
    ), 0),
    coalesce(sum(
      case
        when coa.account_type in ('BEBAN'::public.account_type, 'HPP'::public.account_type)
          then jl.debit - jl.credit
        else 0
      end
    ), 0)
  into
    v_revenue_total,
    v_expense_total
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  where je.tenant_id = p_tenant_id
    and je.unit_id is not distinct from p_unit_id
    and je.status = 'posted'
    and je.journal_date >= make_date(p_closing_year, 1, 1)
    and je.journal_date < make_date(p_closing_year + 1, 1, 1)
    and coa.account_type in (
      'PENDAPATAN'::public.account_type,
      'BEBAN'::public.account_type,
      'HPP'::public.account_type
    );

  v_revenue_total := round(coalesce(v_revenue_total, 0), 2);
  v_expense_total := round(coalesce(v_expense_total, 0), 2);
  v_surplus_deficit := round(v_revenue_total - v_expense_total, 2);

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from p_unit_id
      or ur.tenant_id is not distinct from p_tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  insert into public.annual_closings (
    tenant_id,
    unit_id,
    closing_year,
    status,
    revenue_total,
    expense_total,
    surplus_deficit,
    retained_earnings_amount,
    calculated_at,
    calculated_by,
    notes
  )
  values (
    p_tenant_id,
    p_unit_id,
    p_closing_year,
    'calculated',
    v_revenue_total,
    v_expense_total,
    v_surplus_deficit,
    v_surplus_deficit,
    now(),
    v_actor_id,
    nullif(trim(coalesce(p_notes, '')), '')
  )
  on conflict (tenant_id, unit_id, closing_year)
  do update
  set
    status = 'calculated',
    revenue_total = excluded.revenue_total,
    expense_total = excluded.expense_total,
    surplus_deficit = excluded.surplus_deficit,
    retained_earnings_amount = excluded.retained_earnings_amount,
    calculated_at = now(),
    calculated_by = v_actor_id,
    notes = excluded.notes,
    updated_at = now()
  where public.annual_closings.status in ('draft', 'calculated', 'reopened')
  returning id into v_annual_closing_id;

  if v_annual_closing_id is null then
    raise exception 'Annual closing tidak dapat dihitung ulang karena status tidak mengizinkan';
  end if;

  perform public.log_audit_event(
    p_tenant_id := p_tenant_id,
    p_unit_id := p_unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'annual_closing_calculated',
    p_entity_type := 'annual_closings',
    p_entity_id := v_annual_closing_id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_annual_closing_id,
    p_description := 'Annual closing dihitung untuk tahun ' || p_closing_year,
    p_metadata := jsonb_build_object(
      'annual_closing_id', v_annual_closing_id,
      'closing_year', p_closing_year,
      'revenue_total', v_revenue_total,
      'expense_total', v_expense_total,
      'surplus_deficit', v_surplus_deficit
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Annual closing berhasil dihitung',
    'annual_closing_id', v_annual_closing_id,
    'closing_year', p_closing_year,
    'revenue_total', v_revenue_total,
    'expense_total', v_expense_total,
    'surplus_deficit', v_surplus_deficit,
    'retained_earnings_amount', v_surplus_deficit
  );
end;
$$;

-- ============================================================================
-- 4. RPC: post annual closing
-- ============================================================================

create or replace function public.post_annual_closing(
  p_annual_closing_id uuid,
  p_retained_earnings_account_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role public.app_role;
  v_closing public.annual_closings%rowtype;

  v_period_id uuid;
  v_journal_entry_id uuid;
  v_journal_no text;

  v_line record;
  v_line_no integer := 0;

  v_total_revenue numeric := 0;
  v_total_expense numeric := 0;
  v_net_surplus numeric := 0;
begin
  v_actor_id := auth.uid();

  if v_actor_id is null then
    raise exception 'User belum login';
  end if;

  if p_annual_closing_id is null then
    raise exception 'Annual closing wajib diisi';
  end if;

  if p_retained_earnings_account_id is null then
    raise exception 'Akun saldo laba ditahan wajib diisi';
  end if;

  select *
  into v_closing
  from public.annual_closings
  where id = p_annual_closing_id
  for update;

  if not found then
    raise exception 'Annual closing tidak ditemukan';
  end if;

  if v_closing.status not in ('calculated', 'approved') then
    raise exception 'Annual closing hanya dapat diposting dari status calculated/approved. Status saat ini: %', v_closing.status;
  end if;

  if v_closing.journal_entry_id is not null then
    raise exception 'Annual closing sudah memiliki jurnal';
  end if;

  if v_closing.locked_at is not null or v_closing.status = 'locked' then
    raise exception 'Annual closing sudah locked';
  end if;

  if not public.can_access_unit(v_closing.unit_id, v_actor_id) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  perform public.assert_user_has_permission(
    'profit_sharing.manage',
    v_actor_id,
    v_closing.tenant_id,
    v_closing.unit_id
  );

  if not exists (
    select 1
    from public.chart_of_accounts coa
    where coa.id = p_retained_earnings_account_id
      and coa.tenant_id = v_closing.tenant_id
      and coa.unit_id is not distinct from v_closing.unit_id
      and coa.kode = '3200'
      and coa.account_type = 'EKUITAS'::public.account_type
      and coa.normal_balance = 'credit'
      and coa.is_active = true
      and coa.is_postable = true
  ) then
    raise exception 'Akun saldo laba ditahan tidak valid. Harus akun 3200 aktif/postable pada scope tenant/unit yang sama';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.tenant_id = v_closing.tenant_id
      and je.unit_id is not distinct from v_closing.unit_id
      and je.source_type = 'annual_closing'
      and je.source_id = v_closing.id
  ) then
    raise exception 'Jurnal annual closing untuk record ini sudah pernah dibuat';
  end if;

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_closing.tenant_id
    and ap.unit_id is not distinct from v_closing.unit_id
    and ap.period_year = v_closing.closing_year
    and ap.period_month = 12
  order by ap.period_start desc
  limit 1;

  if v_period_id is null then
    select ap.id
    into v_period_id
    from public.accounting_periods ap
    where ap.tenant_id = v_closing.tenant_id
      and ap.unit_id is not distinct from v_closing.unit_id
      and make_date(v_closing.closing_year, 12, 31) between ap.period_start and ap.period_end
    order by ap.period_start desc
    limit 1;
  end if;

  if v_period_id is null then
    raise exception 'Periode akuntansi Desember tahun closing tidak ditemukan';
  end if;

  perform public.assert_period_open(v_period_id);

  select
    round(coalesce(sum(
      case
        when coa.account_type = 'PENDAPATAN'::public.account_type
          then jl.credit - jl.debit
        else 0
      end
    ), 0), 2),
    round(coalesce(sum(
      case
        when coa.account_type in ('BEBAN'::public.account_type, 'HPP'::public.account_type)
          then jl.debit - jl.credit
        else 0
      end
    ), 0), 2)
  into
    v_total_revenue,
    v_total_expense
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  where je.tenant_id = v_closing.tenant_id
    and je.unit_id is not distinct from v_closing.unit_id
    and je.status = 'posted'
    and je.journal_date >= make_date(v_closing.closing_year, 1, 1)
    and je.journal_date < make_date(v_closing.closing_year + 1, 1, 1)
    and je.source_type <> 'annual_closing'
    and coa.account_type in (
      'PENDAPATAN'::public.account_type,
      'BEBAN'::public.account_type,
      'HPP'::public.account_type
    )
    and coa.is_postable = true;

  v_net_surplus := round(v_total_revenue - v_total_expense, 2);

  if v_total_revenue <> round(v_closing.revenue_total, 2)
     or v_total_expense <> round(v_closing.expense_total, 2)
     or v_net_surplus <> round(v_closing.surplus_deficit, 2) then
    raise exception 'Nilai ledger tidak sama dengan annual closing. Ledger revenue %, expense %, surplus %. Annual closing revenue %, expense %, surplus %',
      v_total_revenue,
      v_total_expense,
      v_net_surplus,
      v_closing.revenue_total,
      v_closing.expense_total,
      v_closing.surplus_deficit;
  end if;

  if v_net_surplus <= 0 then
    raise exception 'Posting annual closing saat ini hanya mendukung surplus positif. Nilai surplus: %', v_net_surplus;
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = v_actor_id
    and (
      ur.unit_id is not distinct from v_closing.unit_id
      or ur.tenant_id is not distinct from v_closing.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'direktur_bumdes' then 1
      when ur.role = 'admin_bumdes' then 2
      when ur.role = 'super_admin_platform' then 3
      else 4
    end,
    ur.created_at desc
  limit 1;

  v_journal_no := 'JCL-' || v_closing.closing_year::text || '-' || substr(v_closing.id::text, 1, 8);

  insert into public.journal_entries (
    tenant_id,
    unit_id,
    period_id,
    journal_no,
    journal_date,
    source_type,
    source_id,
    description,
    status,
    created_by
  )
  values (
    v_closing.tenant_id,
    v_closing.unit_id,
    v_period_id,
    v_journal_no,
    make_date(v_closing.closing_year, 12, 31),
    'annual_closing',
    v_closing.id,
    'Posting tutup tahun ' || v_closing.closing_year::text,
    'draft',
    v_actor_id
  )
  returning id into v_journal_entry_id;

  for v_line in
    select
      coa.id as account_id,
      coa.kode,
      coa.nama,
      coa.account_type,
      round(sum(jl.credit - jl.debit), 2) as amount
    from public.journal_entries je
    join public.journal_lines jl
      on jl.journal_entry_id = je.id
    join public.chart_of_accounts coa
      on coa.id = jl.account_id
    where je.tenant_id = v_closing.tenant_id
      and je.unit_id is not distinct from v_closing.unit_id
      and je.status = 'posted'
      and je.journal_date >= make_date(v_closing.closing_year, 1, 1)
      and je.journal_date < make_date(v_closing.closing_year + 1, 1, 1)
      and je.source_type <> 'annual_closing'
      and coa.account_type = 'PENDAPATAN'::public.account_type
      and coa.is_postable = true
    group by coa.id, coa.kode, coa.nama, coa.account_type
    having round(sum(jl.credit - jl.debit), 2) <> 0
    order by coa.kode
  loop
    v_line_no := v_line_no + 1;

    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values (
      v_journal_entry_id,
      v_line.account_id,
      v_line_no,
      'Tutup saldo pendapatan ' || v_line.kode || ' - ' || v_line.nama,
      v_line.amount,
      0
    );
  end loop;

  for v_line in
    select
      coa.id as account_id,
      coa.kode,
      coa.nama,
      coa.account_type,
      round(sum(jl.debit - jl.credit), 2) as amount
    from public.journal_entries je
    join public.journal_lines jl
      on jl.journal_entry_id = je.id
    join public.chart_of_accounts coa
      on coa.id = jl.account_id
    where je.tenant_id = v_closing.tenant_id
      and je.unit_id is not distinct from v_closing.unit_id
      and je.status = 'posted'
      and je.journal_date >= make_date(v_closing.closing_year, 1, 1)
      and je.journal_date < make_date(v_closing.closing_year + 1, 1, 1)
      and je.source_type <> 'annual_closing'
      and coa.account_type in ('BEBAN'::public.account_type, 'HPP'::public.account_type)
      and coa.is_postable = true
    group by coa.id, coa.kode, coa.nama, coa.account_type
    having round(sum(jl.debit - jl.credit), 2) <> 0
    order by coa.kode
  loop
    v_line_no := v_line_no + 1;

    insert into public.journal_lines (
      journal_entry_id,
      account_id,
      line_no,
      description,
      debit,
      credit
    )
    values (
      v_journal_entry_id,
      v_line.account_id,
      v_line_no,
      'Tutup saldo beban/HPP ' || v_line.kode || ' - ' || v_line.nama,
      0,
      v_line.amount
    );
  end loop;

  v_line_no := v_line_no + 1;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    line_no,
    description,
    debit,
    credit
  )
  values (
    v_journal_entry_id,
    p_retained_earnings_account_id,
    v_line_no,
    'Pemindahan surplus tahun berjalan ke saldo laba ditahan',
    0,
    v_net_surplus
  );

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_journal_entry_id;

  update public.annual_closings
  set
    status = 'posted',
    journal_entry_id = v_journal_entry_id,
    posted_at = now(),
    posted_by = v_actor_id,
    updated_at = now()
  where id = v_closing.id;

  perform public.log_audit_event(
    p_tenant_id := v_closing.tenant_id,
    p_unit_id := v_closing.unit_id,
    p_actor_id := v_actor_id,
    p_actor_role := v_actor_role,
    p_event_type := 'annual_closing_posted',
    p_entity_type := 'annual_closings',
    p_entity_id := v_closing.id,
    p_source_type := 'bumdes_dashboard',
    p_source_id := v_closing.id,
    p_description := 'Annual closing diposting untuk tahun ' || v_closing.closing_year::text,
    p_metadata := jsonb_build_object(
      'annual_closing_id', v_closing.id,
      'closing_year', v_closing.closing_year,
      'journal_entry_id', v_journal_entry_id,
      'journal_no', v_journal_no,
      'revenue_total', v_total_revenue,
      'expense_total', v_total_expense,
      'surplus_deficit', v_net_surplus,
      'retained_earnings_account_id', p_retained_earnings_account_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Annual closing berhasil diposting',
    'annual_closing_id', v_closing.id,
    'closing_year', v_closing.closing_year,
    'journal_entry_id', v_journal_entry_id,
    'journal_no', v_journal_no,
    'revenue_total', v_total_revenue,
    'expense_total', v_total_expense,
    'surplus_deficit', v_net_surplus,
    'status', 'posted'
  );
end;
$$;

-- ============================================================================
-- 5. Reporting / audit views
-- ============================================================================

create or replace view public.v_annual_closing_flow_audit as
select
  ac.id as annual_closing_id,
  ac.tenant_id,
  ac.unit_id,
  ac.closing_year,
  ac.status,
  ac.revenue_total,
  ac.expense_total,
  ac.surplus_deficit,
  ac.retained_earnings_amount,
  ac.journal_entry_id,
  je.journal_no,
  je.journal_date,
  je.status as journal_status,
  coalesce(journal_totals.total_debit, 0)::numeric(18,2) as total_debit,
  coalesce(journal_totals.total_credit, 0)::numeric(18,2) as total_credit,
  exists (
    select 1
    from public.journal_lines jl
    join public.chart_of_accounts coa on coa.id = jl.account_id
    where jl.journal_entry_id = ac.journal_entry_id
      and coa.account_type = 'PENDAPATAN'::public.account_type
      and jl.debit > 0
  ) as has_revenue_closing_debit,
  exists (
    select 1
    from public.journal_lines jl
    join public.chart_of_accounts coa on coa.id = jl.account_id
    where jl.journal_entry_id = ac.journal_entry_id
      and coa.account_type in ('BEBAN'::public.account_type, 'HPP'::public.account_type)
      and jl.credit > 0
  ) as has_expense_hpp_closing_credit,
  exists (
    select 1
    from public.journal_lines jl
    join public.chart_of_accounts coa on coa.id = jl.account_id
    where jl.journal_entry_id = ac.journal_entry_id
      and coa.kode = '3200'
      and coa.account_type = 'EKUITAS'::public.account_type
      and jl.credit = ac.surplus_deficit
  ) as has_retained_earnings_credit,
  case
    when ac.status in ('draft', 'calculated', 'approved', 'reopened') then 'NOT_POSTED'
    when ac.status in ('posted', 'locked') and ac.journal_entry_id is null then 'FAIL_NO_JOURNAL'
    when ac.status in ('posted', 'locked') and je.status <> 'posted' then 'FAIL_JOURNAL_NOT_POSTED'
    when ac.status in ('posted', 'locked')
      and coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'FAIL_JOURNAL_NOT_BALANCED'
    when ac.status in ('posted', 'locked')
      and not exists (
        select 1
        from public.journal_lines jl
        join public.chart_of_accounts coa on coa.id = jl.account_id
        where jl.journal_entry_id = ac.journal_entry_id
          and coa.kode = '3200'
          and coa.account_type = 'EKUITAS'::public.account_type
          and jl.credit = ac.surplus_deficit
      ) then 'FAIL_NO_RETAINED_EARNINGS_CREDIT'
    else 'PASS'
  end as audit_result,
  array_remove(array[
    case when ac.status in ('draft', 'calculated', 'approved', 'reopened') then 'annual closing not posted' end,
    case when ac.status in ('posted', 'locked') and ac.journal_entry_id is null then 'missing journal entry' end,
    case when ac.status in ('posted', 'locked') and je.status <> 'posted' then 'journal not posted' end,
    case when ac.status in ('posted', 'locked')
      and coalesce(journal_totals.total_debit, 0) <> coalesce(journal_totals.total_credit, 0) then 'journal not balanced' end,
    case when ac.status in ('posted', 'locked')
      and ac.surplus_deficit <= 0 then 'surplus is not positive' end
  ], null) as audit_notes,
  ac.calculated_at,
  ac.calculated_by,
  ac.approved_at,
  ac.approved_by,
  ac.posted_at,
  ac.posted_by,
  ac.locked_at,
  ac.locked_by,
  ac.created_at,
  ac.updated_at
from public.annual_closings ac
left join public.journal_entries je
  on je.id = ac.journal_entry_id
left join lateral (
  select
    coalesce(sum(jl.debit), 0) as total_debit,
    coalesce(sum(jl.credit), 0) as total_credit
  from public.journal_lines jl
  where jl.journal_entry_id = ac.journal_entry_id
) journal_totals on true;

create or replace view public.v_annual_closing_flow as
select *
from public.v_annual_closing_flow_audit;

-- ============================================================================
-- 6. Grants / comments
-- ============================================================================

grant select on public.annual_closings to authenticated;
grant select on public.v_annual_closing_flow to authenticated;
grant select on public.v_annual_closing_flow_audit to authenticated;

grant execute on function public.calculate_annual_closing(
  uuid,
  uuid,
  integer,
  text
) to authenticated;

grant execute on function public.post_annual_closing(
  uuid,
  uuid
) to authenticated;

comment on table public.annual_closings is
'Annual Closing / Tutup Buku Tahunan: calculates annual surplus, posts closing journal, and provides basis for profit-sharing allocation.';

comment on function public.calculate_annual_closing(
  uuid,
  uuid,
  integer,
  text
) is
'Calculates unit annual closing from posted revenue, HPP, and expense ledger for a specific year.';

comment on function public.post_annual_closing(
  uuid,
  uuid
) is
'Posts annual closing journal: closes revenue, HPP, and expense balances to retained earnings account 3200.';

comment on view public.v_annual_closing_flow_audit is
'Audit/reporting view for Annual Closing / Tutup Buku Tahunan flow.';
