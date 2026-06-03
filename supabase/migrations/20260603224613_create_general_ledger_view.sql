create or replace view public.v_general_ledger as
with posted_lines as (
  select
    je.tenant_id,
    je.unit_id,
    je.id as journal_entry_id,
    je.journal_no,
    je.journal_date,
    je.source_type,
    je.source_id,
    je.description as journal_description,
    je.status,
    je.posted_at,
    jl.id as journal_line_id,
    jl.line_no,
    jl.account_id,
    coa.kode as account_code,
    coa.nama as account_name,
    coa.tipe::text as account_tipe,
    coa.account_type::text as account_type,
    coa.normal_balance,
    jl.description as line_description,
    coalesce(jl.debit, 0)::numeric(18,2) as debit,
    coalesce(jl.credit, 0)::numeric(18,2) as credit,
    case
      when coa.normal_balance = 'credit'
        then (coalesce(jl.credit, 0) - coalesce(jl.debit, 0))::numeric(18,2)
      else
        (coalesce(jl.debit, 0) - coalesce(jl.credit, 0))::numeric(18,2)
    end as signed_amount
  from public.journal_entries je
  join public.journal_lines jl
    on jl.journal_entry_id = je.id
  join public.chart_of_accounts coa
    on coa.id = jl.account_id
  where je.status = 'posted'
)
select
  tenant_id,
  unit_id,
  journal_entry_id,
  journal_line_id,
  journal_no,
  journal_date,
  source_type,
  source_id,
  journal_description,
  line_no,
  account_id,
  account_code,
  account_name,
  account_tipe,
  account_type,
  normal_balance,
  line_description,
  debit,
  credit,
  signed_amount,
  sum(signed_amount) over (
    partition by tenant_id, unit_id, account_id
    order by journal_date, journal_no, line_no, journal_line_id
    rows between unbounded preceding and current row
  )::numeric(18,2) as running_balance,
  posted_at
from posted_lines;

grant select on public.v_general_ledger to authenticated;

notify pgrst, 'reload schema';