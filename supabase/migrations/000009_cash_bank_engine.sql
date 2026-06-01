-- ============================================================
-- ORVIA-BUMDES COMMERCIAL BASELINE MIGRATION
-- 000008_cash_bank_engine.sql
--
-- Scope:
-- - Cash/bank account master
-- - Cash/bank transaction ledger
-- - Cash/bank balance view
-- - Cash/bank balance helper
-- - Insufficient balance guard
-- - Default cash/bank provisioning
-- - Opening balance posting helper
-- - Scope validation guards
-- - Posted/cancelled/reversed mutation guard
--
-- Notes:
-- - Fresh-install baseline.
-- - Cash flow statement reporting is deferred to reporting migrations.
-- - Savings loan, revenue receipt, expense, capital, and other module posting
--   functions are deferred to their own module migrations.
-- ============================================================

begin;

-- ============================================================
-- 1. CASH/BANK ACCOUNT MASTER
-- ============================================================

create table if not exists public.cash_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  account_id uuid references public.chart_of_accounts(id) on delete restrict,
  account_code text not null,
  account_name text not null,
  account_kind text not null,
  bank_name text,
  bank_account_number text,
  bank_account_holder text,
  currency_code text not null default 'IDR',
  opening_balance numeric(18,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cash_bank_accounts_account_kind_check
    check (account_kind in ('cash', 'bank')),

  constraint cash_bank_accounts_code_not_blank
    check (btrim(account_code) <> ''),

  constraint cash_bank_accounts_name_not_blank
    check (btrim(account_name) <> ''),

  constraint cash_bank_accounts_currency_code_not_blank
    check (btrim(currency_code) <> '')
);

create unique index if not exists cash_bank_accounts_scope_code_unique
  on public.cash_bank_accounts(tenant_id, unit_id, account_code)
  nulls not distinct;

create index if not exists cash_bank_accounts_tenant_idx
  on public.cash_bank_accounts(tenant_id);

create index if not exists cash_bank_accounts_unit_idx
  on public.cash_bank_accounts(unit_id);

create index if not exists cash_bank_accounts_account_id_idx
  on public.cash_bank_accounts(account_id);

-- ============================================================
-- 2. CASH/BANK TRANSACTION LEDGER
-- ============================================================

create table if not exists public.cash_bank_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid references public.business_units(id) on delete cascade,
  cash_bank_account_id uuid not null references public.cash_bank_accounts(id) on delete restrict,
  transaction_no text not null,
  transaction_date date not null default current_date,
  transaction_type text not null,
  source_type text,
  source_id uuid,
  description text,
  amount numeric(18,2) not null,
  status text not null default 'draft',
  journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  posted_at timestamptz,
  posted_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancellation_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint cash_bank_transactions_amount_check
    check (amount > 0),

  constraint cash_bank_transactions_status_check
    check (status in ('draft', 'posted', 'cancelled', 'reversed')),

  constraint cash_bank_transactions_transaction_type_check
    check (
      transaction_type in (
        'receipt',
        'payment',
        'transfer_in',
        'transfer_out',
        'adjustment_in',
        'adjustment_out',
        'opening_balance'
      )
    ),

  constraint cash_bank_transactions_no_not_blank
    check (btrim(transaction_no) <> '')
);

create unique index if not exists cash_bank_transactions_scope_no_unique
  on public.cash_bank_transactions(tenant_id, unit_id, transaction_no)
  nulls not distinct;

create index if not exists cash_bank_transactions_tenant_idx
  on public.cash_bank_transactions(tenant_id);

create index if not exists cash_bank_transactions_unit_idx
  on public.cash_bank_transactions(unit_id);

create index if not exists cash_bank_transactions_account_idx
  on public.cash_bank_transactions(cash_bank_account_id);

create index if not exists cash_bank_transactions_source_idx
  on public.cash_bank_transactions(source_type, source_id);

create index if not exists cash_bank_transactions_status_idx
  on public.cash_bank_transactions(status);

create index if not exists cash_bank_transactions_journal_entry_idx
  on public.cash_bank_transactions(journal_entry_id);

create index if not exists cash_bank_transactions_date_idx
  on public.cash_bank_transactions(transaction_date);

-- ============================================================
-- 3. SCOPE VALIDATION GUARDS
-- ============================================================

create or replace function public.validate_cash_bank_account_scope()
returns trigger
language plpgsql
as $function$
declare
  v_coa_tenant_id uuid;
  v_coa_unit_id uuid;
begin
  if new.account_id is not null then
    select coa.tenant_id, coa.unit_id
    into v_coa_tenant_id, v_coa_unit_id
    from public.chart_of_accounts coa
    where coa.id = new.account_id;

    if v_coa_tenant_id is null then
      raise exception 'chart of account not found'
        using errcode = '23503';
    end if;

    if new.tenant_id <> v_coa_tenant_id
      or new.unit_id is distinct from v_coa_unit_id
    then
      raise exception 'cash bank account scope does not match chart of account scope'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.validate_cash_bank_transaction_scope()
returns trigger
language plpgsql
as $function$
declare
  v_account_tenant_id uuid;
  v_account_unit_id uuid;
begin
  select cba.tenant_id, cba.unit_id
  into v_account_tenant_id, v_account_unit_id
  from public.cash_bank_accounts cba
  where cba.id = new.cash_bank_account_id;

  if v_account_tenant_id is null then
    raise exception 'cash bank account not found'
      using errcode = '23503';
  end if;

  if new.tenant_id <> v_account_tenant_id
    or new.unit_id is distinct from v_account_unit_id
  then
    raise exception 'cash bank transaction scope does not match account scope'
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

create or replace function public.prevent_posted_cash_bank_transaction_mutation()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'DELETE' and old.status in ('posted', 'cancelled', 'reversed') then
    raise exception 'posted, cancelled, or reversed cash-bank transaction cannot be deleted'
      using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and old.status in ('posted', 'cancelled', 'reversed') then
    if new.status <> old.status
      or new.cancelled_at is distinct from old.cancelled_at
      or new.cancelled_by is distinct from old.cancelled_by
      or new.cancellation_reason is distinct from old.cancellation_reason
    then
      return new;
    end if;

    raise exception 'posted, cancelled, or reversed cash-bank transaction cannot be changed directly'
      using errcode = '42501';
  end if;

  return coalesce(new, old);
end;
$function$;

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

drop trigger if exists trg_cash_bank_accounts_set_updated_at on public.cash_bank_accounts;
create trigger trg_cash_bank_accounts_set_updated_at
before update on public.cash_bank_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists trg_cash_bank_accounts_validate_scope on public.cash_bank_accounts;
create trigger trg_cash_bank_accounts_validate_scope
before insert or update on public.cash_bank_accounts
for each row
execute function public.validate_cash_bank_account_scope();

drop trigger if exists trg_cash_bank_transactions_set_updated_at on public.cash_bank_transactions;
create trigger trg_cash_bank_transactions_set_updated_at
before update on public.cash_bank_transactions
for each row
execute function public.set_updated_at();

drop trigger if exists trg_cash_bank_transactions_validate_scope on public.cash_bank_transactions;
create trigger trg_cash_bank_transactions_validate_scope
before insert or update on public.cash_bank_transactions
for each row
execute function public.validate_cash_bank_transaction_scope();

drop trigger if exists trg_prevent_posted_cash_bank_transaction_mutation on public.cash_bank_transactions;
create trigger trg_prevent_posted_cash_bank_transaction_mutation
before update or delete on public.cash_bank_transactions
for each row
execute function public.prevent_posted_cash_bank_transaction_mutation();

-- ============================================================
-- 5. BALANCE VIEW
-- ============================================================

create or replace view public.v_cash_bank_balance as
select
  cba.tenant_id,
  cba.unit_id,
  cba.id as cash_bank_account_id,
  cba.account_code,
  cba.account_name,
  cba.account_kind,
  cba.opening_balance,
  (
    cba.opening_balance
    + coalesce(sum(
      case
        when cbt.status = 'posted'
          and cbt.transaction_type in (
            'receipt',
            'transfer_in',
            'adjustment_in',
            'opening_balance'
          )
        then cbt.amount

        when cbt.status = 'posted'
          and cbt.transaction_type in (
            'payment',
            'transfer_out',
            'adjustment_out'
          )
        then -cbt.amount

        else 0
      end
    ), 0)
  )::numeric(18,2) as current_balance
from public.cash_bank_accounts cba
left join public.cash_bank_transactions cbt
  on cbt.cash_bank_account_id = cba.id
group by
  cba.tenant_id,
  cba.unit_id,
  cba.id,
  cba.account_code,
  cba.account_name,
  cba.account_kind,
  cba.opening_balance;

-- ============================================================
-- 6. BALANCE HELPERS
-- ============================================================

create or replace function public.get_cash_bank_balance(
  p_cash_bank_account_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_balance numeric(18,2);
begin
  select v.current_balance
  into v_balance
  from public.v_cash_bank_balance v
  where v.cash_bank_account_id = p_cash_bank_account_id;

  return coalesce(v_balance, 0);
end;
$function$;

create or replace function public.assert_cash_bank_account_sufficient_balance(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_account_id uuid,
  p_required_amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_code text;
  v_account_name text;
  v_total_balance numeric(18,2);
  v_cash_bank_count integer;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  if p_account_id is null then
    raise exception 'account_id kas/bank wajib diisi';
  end if;

  if p_required_amount is null or p_required_amount <= 0 then
    raise exception 'Nominal yang dicek harus lebih dari 0';
  end if;

  select
    coa.kode,
    coa.nama
  into
    v_account_code,
    v_account_name
  from public.chart_of_accounts coa
  where coa.id = p_account_id
    and coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.is_active = true
    and coa.is_postable = true;

  if v_account_code is null then
    raise exception 'COA kas/bank belum tersedia atau tidak aktif. Posting dibatalkan.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_account_id::text));

  select count(*)
  into v_cash_bank_count
  from public.cash_bank_accounts cba
  where cba.tenant_id = p_tenant_id
    and cba.unit_id = p_unit_id
    and cba.account_id = p_account_id
    and cba.is_active = true;

  if v_cash_bank_count = 0 then
    raise exception 'Akun kas/bank operasional belum dibuat. COA % - % sudah ada, tetapi belum terdaftar sebagai akun Kas & Bank aktif. Buat dulu akun kas/bank di menu Kas & Bank. Posting dibatalkan.',
      v_account_code,
      v_account_name;
  end if;

  select
    coalesce(sum(v.current_balance), 0)::numeric(18,2)
  into v_total_balance
  from public.cash_bank_accounts cba
  left join public.v_cash_bank_balance v
    on v.cash_bank_account_id = cba.id
  where cba.tenant_id = p_tenant_id
    and cba.unit_id = p_unit_id
    and cba.account_id = p_account_id
    and cba.is_active = true;

  if v_total_balance < p_required_amount then
    raise exception 'Saldo kas/bank tidak cukup. Akun: % - %. Saldo tersedia: Rp %, kebutuhan transaksi: Rp %. Posting dibatalkan.',
      v_account_code,
      v_account_name,
      trim(to_char(v_total_balance, 'FM999G999G999G999G990D00')),
      trim(to_char(p_required_amount, 'FM999G999G999G999G990D00'));
  end if;
end;
$function$;

-- ============================================================
-- 7. DEFAULT CASH/BANK PROVISIONING
-- ============================================================

create or replace function public.provision_default_cash_bank_accounts(
  p_tenant_id uuid,
  p_unit_id uuid,
  p_created_by uuid default auth.uid()
)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_created_count integer := 0;
  v_row_count integer := 0;
  v_cash_account_id uuid;
  v_bank_account_id uuid;
begin
  if p_tenant_id is null then
    raise exception 'tenant_id wajib diisi';
  end if;

  if p_unit_id is null then
    raise exception 'unit_id wajib diisi';
  end if;

  if public.unit_tenant_id(p_unit_id) is distinct from p_tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  select coa.id
  into v_cash_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.kode = '1110'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  select coa.id
  into v_bank_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = p_tenant_id
    and coa.unit_id = p_unit_id
    and coa.kode = '1120'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_cash_account_id is null then
    raise exception 'COA 1110 - Kas belum tersedia untuk unit ini';
  end if;

  if v_bank_account_id is null then
    raise exception 'COA 1120 - Bank belum tersedia untuk unit ini';
  end if;

  insert into public.cash_bank_accounts (
    tenant_id,
    unit_id,
    account_id,
    account_code,
    account_name,
    account_kind,
    currency_code,
    opening_balance,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    v_cash_account_id,
    'KAS-UTAMA',
    'Kas Tunai',
    'cash',
    'IDR',
    0,
    true,
    p_created_by
  )
  on conflict (tenant_id, unit_id, account_code) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_count := v_created_count + v_row_count;

  insert into public.cash_bank_accounts (
    tenant_id,
    unit_id,
    account_id,
    account_code,
    account_name,
    account_kind,
    currency_code,
    opening_balance,
    is_active,
    created_by
  )
  values (
    p_tenant_id,
    p_unit_id,
    v_bank_account_id,
    'BANK-UTAMA',
    'Bank Unit',
    'bank',
    'IDR',
    0,
    true,
    p_created_by
  )
  on conflict (tenant_id, unit_id, account_code) do nothing;

  get diagnostics v_row_count = row_count;
  v_created_count := v_created_count + v_row_count;

  return v_created_count;
end;
$function$;

-- ============================================================
-- 8. OPENING BALANCE POSTING HELPER
-- ============================================================

create or replace function public.create_cash_bank_opening_balance(
  p_cash_bank_account_id uuid,
  p_transaction_no text,
  p_transaction_date date,
  p_amount numeric,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account record;
  v_period_id uuid;
  v_equity_account_id uuid;
  v_journal_entry_id uuid;
  v_transaction_id uuid;
  v_actor_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'User belum login';
  end if;

  if p_cash_bank_account_id is null then
    raise exception 'Akun kas/bank wajib diisi';
  end if;

  if nullif(trim(p_transaction_no), '') is null then
    raise exception 'Nomor transaksi wajib diisi';
  end if;

  if p_transaction_date is null then
    raise exception 'Tanggal transaksi wajib diisi';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Nominal saldo awal harus lebih dari 0';
  end if;

  select
    cba.id,
    cba.tenant_id,
    cba.unit_id,
    cba.account_id,
    cba.account_code,
    cba.account_name,
    cba.account_kind,
    cba.is_active,
    coa.kode as coa_kode,
    coa.nama as coa_nama
  into v_account
  from public.cash_bank_accounts cba
  join public.chart_of_accounts coa
    on coa.id = cba.account_id
  where cba.id = p_cash_bank_account_id
  for update;

  if v_account.id is null then
    raise exception 'Akun kas/bank tidak ditemukan';
  end if;

  if v_account.is_active is not true then
    raise exception 'Akun kas/bank tidak aktif';
  end if;

  if not public.can_access_unit(v_account.unit_id, auth.uid()) then
    raise exception 'User tidak memiliki akses ke unit ini';
  end if;

  if public.unit_tenant_id(v_account.unit_id) is distinct from v_account.tenant_id then
    raise exception 'Unit tidak sesuai dengan tenant';
  end if;

  perform public.assert_user_has_permission(
    'cash_bank.manage',
    auth.uid(),
    v_account.tenant_id,
    v_account.unit_id
  );

  select ap.id
  into v_period_id
  from public.accounting_periods ap
  where ap.tenant_id = v_account.tenant_id
    and ap.unit_id = v_account.unit_id
    and p_transaction_date between ap.period_start and ap.period_end
  limit 1;

  perform public.assert_period_open(v_period_id);

  select coa.id
  into v_equity_account_id
  from public.chart_of_accounts coa
  where coa.tenant_id = v_account.tenant_id
    and coa.unit_id = v_account.unit_id
    and coa.kode = '3100'
    and coa.is_active = true
    and coa.is_postable = true
  limit 1;

  if v_equity_account_id is null then
    raise exception 'Akun Modal BUMDes kode 3100 tidak ditemukan atau tidak aktif';
  end if;

  if exists (
    select 1
    from public.cash_bank_transactions cbt
    where cbt.tenant_id = v_account.tenant_id
      and cbt.unit_id is not distinct from v_account.unit_id
      and cbt.transaction_no = upper(trim(p_transaction_no))
  ) then
    raise exception 'Nomor transaksi kas/bank sudah digunakan dalam unit ini';
  end if;

  if exists (
    select 1
    from public.journal_entries je
    where je.tenant_id = v_account.tenant_id
      and je.unit_id is not distinct from v_account.unit_id
      and je.journal_no = 'JKB-' || upper(trim(p_transaction_no))
  ) then
    raise exception 'Nomor jurnal kas/bank sudah digunakan dalam unit ini';
  end if;

  select ur.role
  into v_actor_role
  from public.user_roles ur
  where ur.user_id = auth.uid()
    and (
      ur.unit_id = v_account.unit_id
      or ur.tenant_id = v_account.tenant_id
      or ur.role = 'super_admin_platform'::public.app_role
    )
  order by
    case
      when ur.role = 'manager_unit' then 1
      when ur.role = 'operator_unit' then 2
      when ur.role = 'direktur_bumdes' then 3
      when ur.role = 'admin_bumdes' then 4
      when ur.role = 'super_admin_platform' then 5
      else 6
    end
  limit 1;

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
    v_account.tenant_id,
    v_account.unit_id,
    v_period_id,
    'JKB-' || upper(trim(p_transaction_no)),
    p_transaction_date,
    'cash_bank_opening_balance',
    v_account.id,
    coalesce(nullif(trim(p_description), ''), 'Saldo awal ' || v_account.account_name),
    'draft',
    auth.uid()
  )
  returning id into v_journal_entry_id;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    line_no,
    description,
    debit,
    credit
  )
  values
  (
    v_journal_entry_id,
    v_account.account_id,
    1,
    'Saldo awal ' || v_account.account_name,
    p_amount,
    0
  ),
  (
    v_journal_entry_id,
    v_equity_account_id,
    2,
    'Modal awal dari saldo awal ' || v_account.account_name,
    0,
    p_amount
  );

  perform public.assert_journal_balanced(v_journal_entry_id);

  update public.journal_entries
  set
    status = 'posted',
    posted_at = now(),
    posted_by = auth.uid(),
    updated_at = now()
  where id = v_journal_entry_id;

  insert into public.cash_bank_transactions (
    tenant_id,
    unit_id,
    cash_bank_account_id,
    transaction_no,
    transaction_date,
    transaction_type,
    source_type,
    source_id,
    description,
    amount,
    status,
    journal_entry_id,
    posted_at,
    posted_by,
    created_by
  )
  values (
    v_account.tenant_id,
    v_account.unit_id,
    v_account.id,
    upper(trim(p_transaction_no)),
    p_transaction_date,
    'opening_balance',
    'cash_bank_opening_balance',
    v_journal_entry_id,
    coalesce(nullif(trim(p_description), ''), 'Saldo awal ' || v_account.account_name),
    p_amount,
    'posted',
    v_journal_entry_id,
    now(),
    auth.uid(),
    auth.uid()
  )
  returning id into v_transaction_id;

  perform public.log_audit_event(
    v_account.tenant_id,
    v_account.unit_id,
    auth.uid(),
    v_actor_role,
    'cash_bank_opening_balance_created'::text,
    'cash_bank_transactions'::text,
    v_transaction_id,
    'unit_dashboard'::text,
    v_transaction_id,
    'Saldo awal kas/bank dibuat dan diposting.'::text,
    jsonb_build_object(
      'cash_bank_transaction_id', v_transaction_id,
      'cash_bank_account_id', v_account.id,
      'account_code', v_account.account_code,
      'account_name', v_account.account_name,
      'transaction_no', upper(trim(p_transaction_no)),
      'amount', p_amount,
      'journal_entry_id', v_journal_entry_id
    )
  );

  return v_transaction_id;
end;
$function$;

-- ============================================================
-- 9. GRANTS
-- ============================================================

grant select, insert, update on public.cash_bank_accounts
  to authenticated, service_role;

grant select, insert, update on public.cash_bank_transactions
  to authenticated, service_role;

grant select on public.v_cash_bank_balance
  to authenticated, service_role;

grant execute on function public.get_cash_bank_balance(uuid)
  to authenticated, service_role;

grant execute on function public.assert_cash_bank_account_sufficient_balance(uuid, uuid, uuid, numeric)
  to authenticated, service_role;

grant execute on function public.provision_default_cash_bank_accounts(uuid, uuid, uuid)
  to authenticated, service_role;

grant execute on function public.create_cash_bank_opening_balance(uuid, text, date, numeric, text)
  to authenticated, service_role;

commit;
