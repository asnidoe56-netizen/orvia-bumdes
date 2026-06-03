create or replace view public.v_cash_bank_ledger_reconciliation as
with cash_subledger as (
  select
    cbt.tenant_id,
    cbt.unit_id,
    cba.account_id,
    cba.account_code as cash_bank_account_code,
    cba.account_name as cash_bank_account_name,
    extract(year from cbt.transaction_date)::int as report_year,
    sum(
      case
        when cbt.transaction_type in ('receipt', 'transfer_in') then coalesce(cbt.amount, 0)
        when cbt.transaction_type in ('payment', 'transfer_out') then coalesce(cbt.amount, 0) * -1
        else 0
      end
    )::numeric(18,2) as subledger_cash_balance
  from public.cash_bank_transactions cbt
  join public.cash_bank_accounts cba
    on cba.id = cbt.cash_bank_account_id
  where cbt.status = 'posted'
  group by
    cbt.tenant_id,
    cbt.unit_id,
    cba.account_id,
    cba.account_code,
    cba.account_name,
    extract(year from cbt.transaction_date)::int
),
ledger_cash as (
  select
    gl.tenant_id,
    gl.unit_id,
    gl.account_id,
    gl.account_code,
    gl.account_name,
    extract(year from gl.journal_date)::int as report_year,
    sum(
      case
        when gl.normal_balance = 'credit' then coalesce(gl.credit, 0) - coalesce(gl.debit, 0)
        else coalesce(gl.debit, 0) - coalesce(gl.credit, 0)
      end
    )::numeric(18,2) as ledger_cash_balance
  from public.v_general_ledger gl
  where gl.account_id in (
    select distinct account_id
    from public.cash_bank_accounts
    where account_id is not null
  )
  group by
    gl.tenant_id,
    gl.unit_id,
    gl.account_id,
    gl.account_code,
    gl.account_name,
    extract(year from gl.journal_date)::int
)
select
  coalesce(c.tenant_id, l.tenant_id) as tenant_id,
  coalesce(c.unit_id, l.unit_id) as unit_id,
  coalesce(c.account_id, l.account_id) as account_id,
  coalesce(c.cash_bank_account_code, l.account_code) as account_code,
  coalesce(c.cash_bank_account_name, l.account_name) as account_name,
  coalesce(c.report_year, l.report_year) as report_year,
  coalesce(c.subledger_cash_balance, 0)::numeric(18,2) as subledger_cash_balance,
  coalesce(l.ledger_cash_balance, 0)::numeric(18,2) as ledger_cash_balance,
  (
    coalesce(c.subledger_cash_balance, 0)
    - coalesce(l.ledger_cash_balance, 0)
  )::numeric(18,2) as difference_amount,
  case
    when abs(coalesce(c.subledger_cash_balance, 0) - coalesce(l.ledger_cash_balance, 0)) < 0.01
      then 'MATCH'
    else 'DIFFERENCE'
  end as reconciliation_status
from cash_subledger c
full outer join ledger_cash l
  on l.tenant_id = c.tenant_id
 and l.unit_id = c.unit_id
 and l.account_id = c.account_id
 and l.report_year = c.report_year;


create or replace view public.v_equity_ledger_reconciliation as
with equity_statement as (
  select
    tenant_id,
    unit_id,
    report_year,
    sum(coalesce(equity_effect_amount, 0))::numeric(18,2) as statement_equity_effect
  from public.v_statement_of_changes_in_equity
  group by tenant_id, unit_id, report_year
),
ledger_equity as (
  select
    tenant_id,
    unit_id,
    extract(year from journal_date)::int as report_year,
    sum(
      case
        when account_type = 'EKUITAS' then coalesce(credit, 0) - coalesce(debit, 0)
        when account_type = 'PENDAPATAN' then coalesce(credit, 0) - coalesce(debit, 0)
        when account_type in ('HPP', 'BEBAN') then (coalesce(debit, 0) - coalesce(credit, 0)) * -1
        else 0
      end
    )::numeric(18,2) as ledger_equity_effect_with_current_profit
  from public.v_general_ledger
  where account_type in ('EKUITAS', 'PENDAPATAN', 'HPP', 'BEBAN')
    and source_type is distinct from 'annual_closing'
    and source_type is distinct from 'journal_correction_reversal'
  group by tenant_id, unit_id, extract(year from journal_date)::int
)
select
  coalesce(s.tenant_id, l.tenant_id) as tenant_id,
  coalesce(s.unit_id, l.unit_id) as unit_id,
  coalesce(s.report_year, l.report_year) as report_year,
  coalesce(s.statement_equity_effect, 0)::numeric(18,2) as statement_equity_effect,
  coalesce(l.ledger_equity_effect_with_current_profit, 0)::numeric(18,2) as ledger_equity_effect_with_current_profit,
  (
    coalesce(s.statement_equity_effect, 0)
    - coalesce(l.ledger_equity_effect_with_current_profit, 0)
  )::numeric(18,2) as difference_amount,
  case
    when abs(coalesce(s.statement_equity_effect, 0) - coalesce(l.ledger_equity_effect_with_current_profit, 0)) < 0.01
      then 'MATCH'
    else 'DIFFERENCE'
  end as reconciliation_status
from equity_statement s
full outer join ledger_equity l
  on l.tenant_id = s.tenant_id
 and l.unit_id = s.unit_id
 and l.report_year = s.report_year;


grant select on public.v_cash_bank_ledger_reconciliation to authenticated;
grant select on public.v_equity_ledger_reconciliation to authenticated;

notify pgrst, 'reload schema';