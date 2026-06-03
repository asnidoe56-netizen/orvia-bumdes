create or replace view public.v_journal_book as
select
  row_number() over (
    partition by je.tenant_id, je.unit_id, extract(year from je.journal_date)::int
    order by je.journal_date, je.journal_no, jl.line_no, jl.id
  )::integer as row_no,

  je.tenant_id,
  je.unit_id,
  extract(year from je.journal_date)::int as report_year,

  je.id as journal_entry_id,
  jl.id as journal_line_id,

  je.journal_no,
  je.journal_date,
  je.source_type,
  je.source_id,
  je.description as journal_description,
  je.status,
  je.posted_at,

  jl.line_no,
  jl.account_id,
  coa.kode as account_code,
  coa.nama as account_name,
  coa.tipe::text as account_tipe,
  coa.account_type::text as account_type,
  coa.normal_balance,

  jl.description as line_description,
  coalesce(jl.debit, 0)::numeric(18,2) as debit,
  coalesce(jl.credit, 0)::numeric(18,2) as credit

from public.journal_entries je
join public.journal_lines jl
  on jl.journal_entry_id = je.id
join public.chart_of_accounts coa
  on coa.id = jl.account_id
where je.status = 'posted';

grant select on public.v_journal_book to authenticated;

notify pgrst, 'reload schema';