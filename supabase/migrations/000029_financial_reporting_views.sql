-- =========================================================
-- Migration 000023: Financial Reporting Views
-- ORVIA-BUMDES / ERP BUMDes
--
-- Purpose:
--   - Unit financial reporting views
--   - Laba Rugi
--   - Neraca
--   - Arus Kas
--   - Perubahan Ekuitas
--   - Financial dashboard summary
--
-- DB-first alignment:
--   chart_of_accounts uses:
--     kode, nama, tipe, account_type, normal_balance
--
-- Important:
--   All enum-like columns are cast to text in reporting views
--   to avoid UNION/type mismatch issues.
-- =========================================================

-- =========================================================
-- Drop existing views safely, from dependent to base.
-- =========================================================

drop view if exists public.v_financial_dashboard_summary;
drop view if exists public.v_statement_of_changes_in_equity;
drop view if exists public.v_cash_flow_statement;
drop view if exists public.v_neraca_summary;
drop view if exists public.v_neraca_detail;
drop view if exists public.v_laba_rugi_summary;
drop view if exists public.v_laba_rugi_detail;

-- =========================================================
-- LABA RUGI DETAIL
-- =========================================================

create view public.v_laba_rugi_detail as
with posted_lines as (
  select
    je.tenant_id,
    je.unit_id,
    je.accounting_period_id,
    ap.period_year,
    ap.period_month,
    jl.account_id,
    coa.kode,
    coa.nama,
    coa.tipe::text as tipe,
    coa.account_type::text as account_type,
    coa.normal_balance::text as normal_balance,
    coalesce(jl.debit, 0)::numeric as debit,
    coalesce(jl.credit, 0)::numeric as credit
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  left join public.accounting_periods ap
    on ap.id = je.accounting_period_id
  where je.status::text = 'posted'
    and (
      coa.tipe::text in ('pendapatan', 'beban')
      or coa.account_type::text in ('PENDAPATAN', 'BEBAN', 'HPP')
      or coa.kode like '4%'
      or coa.kode like '5%'
      or coa.kode like '6%'
      or coa.kode like '7%'
      or coa.kode like '8%'
      or coa.kode like '9%'
    )
),
classified as (
  select
    tenant_id,
    unit_id,
    accounting_period_id,
    period_year,
    period_month,
    account_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    case
      when tipe = 'pendapatan'
        or account_type = 'PENDAPATAN'
        or kode like '4%'
      then 'PENDAPATAN'

      when account_type = 'HPP'
        or kode like '5%'
      then 'HPP'

      when tipe = 'beban'
        or account_type = 'BEBAN'
        or kode like '6%'
        or kode like '7%'
        or kode like '8%'
        or kode like '9%'
      then 'BEBAN'

      else 'LAINNYA'
    end as kategori_laporan,
    debit,
    credit
  from posted_lines
)
select
  tenant_id,
  unit_id,
  accounting_period_id,
  period_year as periode_tahun,
  period_month as periode_bulan,
  account_id,
  kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  kategori_laporan,
  sum(debit) as total_debit,
  sum(credit) as total_credit,
  case
    when kategori_laporan = 'PENDAPATAN'
      then sum(credit - debit)
    when kategori_laporan in ('HPP', 'BEBAN')
      then sum(debit - credit)
    else sum(debit - credit)
  end as amount,
  case
    when kategori_laporan = 'PENDAPATAN' then 10
    when kategori_laporan = 'HPP' then 20
    when kategori_laporan = 'BEBAN' then 30
    else 90
  end as display_order
from classified
group by
  tenant_id,
  unit_id,
  accounting_period_id,
  period_year,
  period_month,
  account_id,
  kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  kategori_laporan;

-- =========================================================
-- LABA RUGI SUMMARY
-- =========================================================

create view public.v_laba_rugi_summary as
select
  tenant_id,
  unit_id,
  accounting_period_id,
  periode_tahun,
  periode_bulan,
  coalesce(sum(amount) filter (where kategori_laporan = 'PENDAPATAN'), 0)::numeric as total_pendapatan,
  coalesce(sum(amount) filter (where kategori_laporan = 'HPP'), 0)::numeric as total_hpp,
  (
    coalesce(sum(amount) filter (where kategori_laporan = 'PENDAPATAN'), 0)
    - coalesce(sum(amount) filter (where kategori_laporan = 'HPP'), 0)
  )::numeric as laba_kotor,
  coalesce(sum(amount) filter (where kategori_laporan = 'BEBAN'), 0)::numeric as total_beban,
  (
    coalesce(sum(amount) filter (where kategori_laporan = 'PENDAPATAN'), 0)
    - coalesce(sum(amount) filter (where kategori_laporan = 'HPP'), 0)
    - coalesce(sum(amount) filter (where kategori_laporan = 'BEBAN'), 0)
  )::numeric as laba_bersih
from public.v_laba_rugi_detail
group by
  tenant_id,
  unit_id,
  accounting_period_id,
  periode_tahun,
  periode_bulan;

-- =========================================================
-- NERACA DETAIL
-- =========================================================

create view public.v_neraca_detail as
with posted_lines as (
  select
    je.tenant_id,
    je.unit_id,
    je.accounting_period_id,
    ap.period_year,
    ap.period_month,
    jl.account_id,
    coa.kode,
    coa.nama,
    coa.tipe::text as tipe,
    coa.account_type::text as account_type,
    coa.normal_balance::text as normal_balance,
    coalesce(jl.debit, 0)::numeric as debit,
    coalesce(jl.credit, 0)::numeric as credit
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  left join public.accounting_periods ap
    on ap.id = je.accounting_period_id
  where je.status::text = 'posted'
    and (
      coa.tipe::text in ('aset', 'kewajiban', 'ekuitas')
      or coa.account_type::text in ('ASET', 'KEWAJIBAN', 'LIABILITAS', 'EKUITAS')
      or coa.kode like '1%'
      or coa.kode like '2%'
      or coa.kode like '3%'
    )
),
classified as (
  select
    tenant_id,
    unit_id,
    accounting_period_id,
    period_year,
    period_month,
    account_id,
    kode,
    nama,
    tipe,
    account_type,
    normal_balance,
    case
      when tipe = 'aset'
        or account_type = 'ASET'
        or kode like '1%'
      then 'ASET'

      when tipe = 'kewajiban'
        or account_type in ('KEWAJIBAN', 'LIABILITAS')
        or kode like '2%'
      then 'KEWAJIBAN'

      when tipe = 'ekuitas'
        or account_type = 'EKUITAS'
        or kode like '3%'
      then 'EKUITAS'

      else 'LAINNYA'
    end as kategori_laporan,
    debit,
    credit
  from posted_lines
)
select
  tenant_id,
  unit_id,
  accounting_period_id,
  period_year as periode_tahun,
  period_month as periode_bulan,
  account_id,
  kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  kategori_laporan,
  sum(debit) as total_debit,
  sum(credit) as total_credit,
  case
    when kategori_laporan = 'ASET'
      then sum(debit - credit)
    when kategori_laporan in ('KEWAJIBAN', 'EKUITAS')
      then sum(credit - debit)
    else sum(debit - credit)
  end as amount,
  case
    when kategori_laporan = 'ASET' then 10
    when kategori_laporan = 'KEWAJIBAN' then 20
    when kategori_laporan = 'EKUITAS' then 30
    else 90
  end as display_order
from classified
group by
  tenant_id,
  unit_id,
  accounting_period_id,
  period_year,
  period_month,
  account_id,
  kode,
  nama,
  tipe,
  account_type,
  normal_balance,
  kategori_laporan;

-- =========================================================
-- NERACA SUMMARY
-- =========================================================

create view public.v_neraca_summary as
select
  tenant_id,
  unit_id,
  accounting_period_id,
  periode_tahun,
  periode_bulan,
  coalesce(sum(amount) filter (where kategori_laporan = 'ASET'), 0)::numeric as total_aset,
  coalesce(sum(amount) filter (where kategori_laporan = 'KEWAJIBAN'), 0)::numeric as total_kewajiban,
  coalesce(sum(amount) filter (where kategori_laporan = 'EKUITAS'), 0)::numeric as total_ekuitas,
  (
    coalesce(sum(amount) filter (where kategori_laporan = 'ASET'), 0)
    - coalesce(sum(amount) filter (where kategori_laporan = 'KEWAJIBAN'), 0)
    - coalesce(sum(amount) filter (where kategori_laporan = 'EKUITAS'), 0)
  )::numeric as selisih_neraca,
  case
    when abs(
      coalesce(sum(amount) filter (where kategori_laporan = 'ASET'), 0)
      - coalesce(sum(amount) filter (where kategori_laporan = 'KEWAJIBAN'), 0)
      - coalesce(sum(amount) filter (where kategori_laporan = 'EKUITAS'), 0)
    ) < 0.01
    then 'BALANCED'
    else 'UNBALANCED'
  end as audit_result
from public.v_neraca_detail
group by
  tenant_id,
  unit_id,
  accounting_period_id,
  periode_tahun,
  periode_bulan;

-- =========================================================
-- CASH FLOW STATEMENT
-- =========================================================

create view public.v_cash_flow_statement as
select
  cbt.tenant_id,
  cbt.unit_id,
  ap.id as accounting_period_id,
  ap.period_year as periode_tahun,
  ap.period_month as periode_bulan,
  cbt.cash_bank_account_id,
  cba.name as cash_bank_account_name,
  cba.account_type::text as cash_bank_account_type,
  cbt.transaction_type::text as transaction_type,
  cbt.direction::text as direction,
  cbt.source_type::text as source_type,
  count(*)::bigint as transaction_count,
  coalesce(
    sum(
      case
        when lower(cbt.direction::text) in ('in', 'masuk', 'receipt', 'debit')
          then cbt.amount
        when lower(cbt.transaction_type::text) in ('receipt', 'income', 'opening_balance', 'transfer_in')
          then cbt.amount
        else 0
      end
    ),
    0
  )::numeric as cash_in,
  coalesce(
    sum(
      case
        when lower(cbt.direction::text) in ('out', 'keluar', 'payment', 'credit')
          then cbt.amount
        when lower(cbt.transaction_type::text) in ('payment', 'expense', 'transfer_out')
          then cbt.amount
        else 0
      end
    ),
    0
  )::numeric as cash_out,
  (
    coalesce(
      sum(
        case
          when lower(cbt.direction::text) in ('in', 'masuk', 'receipt', 'debit')
            then cbt.amount
          when lower(cbt.transaction_type::text) in ('receipt', 'income', 'opening_balance', 'transfer_in')
            then cbt.amount
          else 0
        end
      ),
      0
    )
    -
    coalesce(
      sum(
        case
          when lower(cbt.direction::text) in ('out', 'keluar', 'payment', 'credit')
            then cbt.amount
          when lower(cbt.transaction_type::text) in ('payment', 'expense', 'transfer_out')
            then cbt.amount
          else 0
        end
      ),
      0
    )
  )::numeric as net_cash_flow
from public.cash_bank_transactions cbt
join public.cash_bank_accounts cba
  on cba.id = cbt.cash_bank_account_id
left join public.accounting_periods ap
  on ap.tenant_id = cbt.tenant_id
 and ap.unit_id = cbt.unit_id
 and extract(year from cbt.transaction_date)::integer = ap.period_year
 and extract(month from cbt.transaction_date)::integer = ap.period_month
where cbt.status::text = 'posted'
group by
  cbt.tenant_id,
  cbt.unit_id,
  ap.id,
  ap.period_year,
  ap.period_month,
  cbt.cash_bank_account_id,
  cba.name,
  cba.account_type::text,
  cbt.transaction_type::text,
  cbt.direction::text,
  cbt.source_type::text;

-- =========================================================
-- STATEMENT OF CHANGES IN EQUITY
-- =========================================================

create view public.v_statement_of_changes_in_equity as
select
  em.tenant_id,
  em.unit_id,
  ap.id as accounting_period_id,
  ap.period_year as periode_tahun,
  ap.period_month as periode_bulan,
  em.equity_account_id,
  ea.equity_type::text as equity_type,
  coa.kode,
  coa.nama,
  coa.tipe::text as tipe,
  coa.account_type::text as account_type,
  em.movement_type::text as movement_type,
  em.source_type::text as source_type,
  count(*)::bigint as movement_count,
  coalesce(
    sum(
      case
        when lower(em.movement_type::text) in (
          'capital_in',
          'increase',
          'surplus',
          'profit_allocation',
          'retained_earning',
          'reserve_in',
          'cadangan_in'
        )
        then em.amount
        else 0
      end
    ),
    0
  )::numeric as equity_increase,
  coalesce(
    sum(
      case
        when lower(em.movement_type::text) in (
          'capital_out',
          'decrease',
          'withdrawal',
          'deficit',
          'distribution',
          'reserve_out',
          'cadangan_out'
        )
        then em.amount
        else 0
      end
    ),
    0
  )::numeric as equity_decrease,
  (
    coalesce(
      sum(
        case
          when lower(em.movement_type::text) in (
            'capital_in',
            'increase',
            'surplus',
            'profit_allocation',
            'retained_earning',
            'reserve_in',
            'cadangan_in'
          )
          then em.amount
          else 0
        end
      ),
      0
    )
    -
    coalesce(
      sum(
        case
          when lower(em.movement_type::text) in (
            'capital_out',
            'decrease',
            'withdrawal',
            'deficit',
            'distribution',
            'reserve_out',
            'cadangan_out'
          )
          then em.amount
          else 0
        end
      ),
      0
    )
  )::numeric as net_equity_change
from public.equity_movements em
join public.equity_accounts ea
  on ea.id = em.equity_account_id
left join public.chart_of_accounts coa
  on coa.id = ea.account_id
left join public.accounting_periods ap
  on ap.tenant_id = em.tenant_id
 and ap.unit_id = em.unit_id
 and extract(year from em.movement_date)::integer = ap.period_year
 and extract(month from em.movement_date)::integer = ap.period_month
where em.status::text = 'posted'
group by
  em.tenant_id,
  em.unit_id,
  ap.id,
  ap.period_year,
  ap.period_month,
  em.equity_account_id,
  ea.equity_type::text,
  coa.kode,
  coa.nama,
  coa.tipe::text,
  coa.account_type::text,
  em.movement_type::text,
  em.source_type::text;

-- =========================================================
-- FINANCIAL DASHBOARD SUMMARY
-- =========================================================

create view public.v_financial_dashboard_summary as
with laba_rugi_base as (
  select
    tenant_id,
    unit_id,
    period_id as accounting_period_id,
    period_year as report_year,
    period_month as report_month,
    total_pendapatan,
    total_hpp,
    laba_kotor,
    total_beban,
    laba_rugi_bersih
  from public.v_laba_rugi_summary
),
cash_summary as (
  select
    tenant_id,
    unit_id,
    report_year,
    report_month,
    sum(cash_in_amount)::numeric as total_cash_in,
    sum(cash_out_amount)::numeric as total_cash_out,
    sum(cash_effect_amount)::numeric as net_cash_flow
  from public.v_cash_flow_statement
  group by
    tenant_id,
    unit_id,
    report_year,
    report_month
),
equity_summary as (
  select
    tenant_id,
    unit_id,
    report_year,
    sum(
      case
        when equity_effect_amount >= 0 then equity_effect_amount
        else 0
      end
    )::numeric as total_equity_increase,
    sum(
      case
        when equity_effect_amount < 0 then abs(equity_effect_amount)
        else 0
      end
    )::numeric as total_equity_decrease,
    sum(equity_effect_amount)::numeric as net_equity_change
  from public.v_statement_of_changes_in_equity
  group by
    tenant_id,
    unit_id,
    report_year
),
report_keys as (
  select
    tenant_id,
    unit_id,
    accounting_period_id,
    report_year,
    report_month
  from laba_rugi_base

  union

  select
    tenant_id,
    unit_id,
    null::uuid as accounting_period_id,
    report_year,
    report_month
  from cash_summary

  union

  select
    tenant_id,
    unit_id,
    null::uuid as accounting_period_id,
    report_year,
    null::integer as report_month
  from equity_summary

  union

  select
    tenant_id,
    unit_id,
    null::uuid as accounting_period_id,
    null::integer as report_year,
    null::integer as report_month
  from public.v_neraca_summary
)
select
  rk.tenant_id,
  rk.unit_id,
  rk.accounting_period_id,
  rk.report_year,
  rk.report_month,

  coalesce(lr.total_pendapatan, 0)::numeric as total_pendapatan,
  coalesce(lr.total_hpp, 0)::numeric as total_hpp,
  coalesce(lr.laba_kotor, 0)::numeric as laba_kotor,
  coalesce(lr.total_beban, 0)::numeric as total_beban,
  coalesce(lr.laba_rugi_bersih, 0)::numeric as laba_rugi_bersih,

  coalesce(ns.total_aset, 0)::numeric as total_aset,
  coalesce(ns.total_kewajiban, 0)::numeric as total_kewajiban,
  coalesce(ns.total_ekuitas, 0)::numeric as total_ekuitas,
  coalesce(ns.total_kewajiban_ekuitas, 0)::numeric as total_kewajiban_ekuitas,
  coalesce(ns.selisih_neraca, 0)::numeric as selisih_neraca,
  coalesce(ns.status_neraca, 'NO_BALANCE_DATA')::text as status_neraca,

  coalesce(cs.total_cash_in, 0)::numeric as total_cash_in,
  coalesce(cs.total_cash_out, 0)::numeric as total_cash_out,
  coalesce(cs.net_cash_flow, 0)::numeric as net_cash_flow,

  coalesce(es.total_equity_increase, 0)::numeric as total_equity_increase,
  coalesce(es.total_equity_decrease, 0)::numeric as total_equity_decrease,
  coalesce(es.net_equity_change, 0)::numeric as net_equity_change,

  case
    when coalesce(ns.status_neraca, 'NO_BALANCE_DATA') in ('BALANCED', 'SEIMBANG', 'PASS')
      then 'PASS'
    when ns.status_neraca is null
      then 'NO_BALANCE_DATA'
    else 'CHECK_BALANCE'
  end as audit_result
from report_keys rk
left join laba_rugi_base lr
  on lr.tenant_id = rk.tenant_id
 and lr.unit_id = rk.unit_id
 and lr.accounting_period_id is not distinct from rk.accounting_period_id
 and lr.report_year is not distinct from rk.report_year
 and lr.report_month is not distinct from rk.report_month
left join public.v_neraca_summary ns
  on ns.tenant_id = rk.tenant_id
 and ns.unit_id = rk.unit_id
left join cash_summary cs
  on cs.tenant_id = rk.tenant_id
 and cs.unit_id = rk.unit_id
 and cs.report_year is not distinct from rk.report_year
 and cs.report_month is not distinct from rk.report_month
left join equity_summary es
  on es.tenant_id = rk.tenant_id
 and es.unit_id = rk.unit_id
 and es.report_year is not distinct from rk.report_year;
-- =========================================================
-- Grants
-- =========================================================

grant select on public.v_laba_rugi_detail to authenticated;
grant select on public.v_laba_rugi_summary to authenticated;
grant select on public.v_neraca_detail to authenticated;
grant select on public.v_neraca_summary to authenticated;
grant select on public.v_cash_flow_statement to authenticated;
grant select on public.v_statement_of_changes_in_equity to authenticated;
grant select on public.v_financial_dashboard_summary to authenticated;

-- =========================================================
-- Documentation comments
-- =========================================================

comment on view public.v_laba_rugi_detail is
'Financial reporting detail view for unit income statement. Uses chart_of_accounts.kode/nama/tipe/account_type.';

comment on view public.v_laba_rugi_summary is
'Financial reporting summary view for unit income statement: pendapatan, HPP, laba kotor, beban, laba bersih.';

comment on view public.v_neraca_detail is
'Financial reporting detail view for balance sheet. Uses posted journal lines and COA classification.';

comment on view public.v_neraca_summary is
'Financial reporting summary view for balance sheet with balance audit result.';

comment on view public.v_cash_flow_statement is
'Financial cash flow statement based on posted cash_bank_transactions.';

comment on view public.v_statement_of_changes_in_equity is
'Statement of changes in equity based on posted equity_movements.';

comment on view public.v_financial_dashboard_summary is
'Unified financial dashboard summary combining laba rugi, neraca, arus kas, and equity movement summaries.';

