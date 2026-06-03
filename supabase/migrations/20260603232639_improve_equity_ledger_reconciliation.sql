drop view if exists public.v_equity_ledger_reconciliation;

create view public.v_equity_ledger_reconciliation as
with equity_statement as (
  select
    tenant_id,
    unit_id,
    report_year,
    sum(coalesce(equity_effect_amount, 0))::numeric(18,2) as statement_equity_effect
  from public.v_statement_of_changes_in_equity
  where report_year is not null
  group by tenant_id, unit_id, report_year
),
ledger_components as (
  select
    tenant_id,
    unit_id,
    extract(year from journal_date)::int as report_year,

    sum(
      case
        when account_type = 'EKUITAS'
          then coalesce(credit, 0) - coalesce(debit, 0)
        else 0
      end
    )::numeric(18,2) as ledger_equity_only,

    sum(
      case
        when account_type = 'PENDAPATAN'
          then coalesce(credit, 0) - coalesce(debit, 0)
        when account_type in ('HPP', 'BEBAN')
          then (coalesce(debit, 0) - coalesce(credit, 0)) * -1
        else 0
      end
    )::numeric(18,2) as ledger_current_profit_loss

  from public.v_general_ledger
  where account_type in ('EKUITAS', 'PENDAPATAN', 'HPP', 'BEBAN')
    and source_type is distinct from 'annual_closing'
    and source_type is distinct from 'journal_correction_reversal'
  group by tenant_id, unit_id, extract(year from journal_date)::int
),
joined as (
  select
    coalesce(s.tenant_id, l.tenant_id) as tenant_id,
    coalesce(s.unit_id, l.unit_id) as unit_id,
    coalesce(s.report_year, l.report_year) as report_year,
    coalesce(s.statement_equity_effect, 0)::numeric(18,2) as statement_equity_effect,
    coalesce(l.ledger_equity_only, 0)::numeric(18,2) as ledger_equity_only,
    coalesce(l.ledger_current_profit_loss, 0)::numeric(18,2) as ledger_current_profit_loss,
    (
      coalesce(l.ledger_equity_only, 0)
      + coalesce(l.ledger_current_profit_loss, 0)
    )::numeric(18,2) as ledger_equity_with_current_profit
  from equity_statement s
  full outer join ledger_components l
    on l.tenant_id = s.tenant_id
   and l.unit_id = s.unit_id
   and l.report_year = s.report_year
)
select
  tenant_id,
  unit_id,
  report_year,

  statement_equity_effect,
  ledger_equity_only,
  ledger_current_profit_loss,
  ledger_equity_with_current_profit,

  (
    statement_equity_effect - ledger_equity_only
  )::numeric(18,2) as difference_formal_equity,

  (
    statement_equity_effect - ledger_equity_with_current_profit
  )::numeric(18,2) as difference_with_current_profit,

  case
    when abs(statement_equity_effect - ledger_equity_only) < 0.01
      then 'MATCH_FORMAL_EQUITY'
    when abs(statement_equity_effect - ledger_equity_with_current_profit) < 0.01
      then 'MATCH_WITH_CURRENT_PROFIT'
    else 'DIFFERENCE'
  end as reconciliation_status

from joined;

grant select on public.v_equity_ledger_reconciliation to authenticated;

notify pgrst, 'reload schema';