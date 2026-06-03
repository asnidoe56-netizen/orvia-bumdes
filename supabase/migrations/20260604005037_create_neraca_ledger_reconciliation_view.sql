create or replace view public.v_neraca_ledger_reconciliation as
with ledger_totals as (
  select
    tenant_id,
    unit_id,

    sum(
      case
        when account_tipe = 'aset' then signed_amount
        else 0
      end
    )::numeric(18,2) as ledger_total_aset,

    sum(
      case
        when account_tipe = 'kewajiban' then signed_amount
        else 0
      end
    )::numeric(18,2) as ledger_total_kewajiban,

    sum(
      case
        when account_tipe = 'ekuitas' then signed_amount
        else 0
      end
    )::numeric(18,2) as ledger_total_ekuitas_formal,

    sum(
      case
        when account_tipe = 'pendapatan' then signed_amount
        when account_tipe = 'beban' then signed_amount * -1
        else 0
      end
    )::numeric(18,2) as ledger_laba_rugi_berjalan

  from public.v_general_ledger
  group by tenant_id, unit_id
),
reconciliation as (
  select
    n.tenant_id,
    n.unit_id,

    n.total_aset::numeric(18,2) as neraca_total_aset,
    coalesce(l.ledger_total_aset, 0)::numeric(18,2) as ledger_total_aset,

    n.total_kewajiban::numeric(18,2) as neraca_total_kewajiban,
    coalesce(l.ledger_total_kewajiban, 0)::numeric(18,2) as ledger_total_kewajiban,

    n.total_ekuitas::numeric(18,2) as neraca_total_ekuitas,
    coalesce(l.ledger_total_ekuitas_formal, 0)::numeric(18,2) as ledger_total_ekuitas_formal,
    coalesce(l.ledger_laba_rugi_berjalan, 0)::numeric(18,2) as ledger_laba_rugi_berjalan,

    (
      coalesce(l.ledger_total_ekuitas_formal, 0)
      + coalesce(l.ledger_laba_rugi_berjalan, 0)
    )::numeric(18,2) as ledger_total_ekuitas_dengan_laba_berjalan,

    n.total_kewajiban_ekuitas::numeric(18,2) as neraca_total_kewajiban_ekuitas,
    n.selisih_neraca::numeric(18,2) as neraca_selisih,
    n.status_neraca

  from public.v_neraca_summary n
  left join ledger_totals l
    on l.tenant_id = n.tenant_id
   and l.unit_id = n.unit_id
)
select
  tenant_id,
  unit_id,

  neraca_total_aset,
  ledger_total_aset,
  (neraca_total_aset - ledger_total_aset)::numeric(18,2) as diff_aset,

  neraca_total_kewajiban,
  ledger_total_kewajiban,
  (neraca_total_kewajiban - ledger_total_kewajiban)::numeric(18,2) as diff_kewajiban,

  neraca_total_ekuitas,
  ledger_total_ekuitas_formal,
  ledger_laba_rugi_berjalan,
  ledger_total_ekuitas_dengan_laba_berjalan,
  (neraca_total_ekuitas - ledger_total_ekuitas_dengan_laba_berjalan)::numeric(18,2) as diff_ekuitas,

  neraca_total_kewajiban_ekuitas,
  neraca_selisih,
  status_neraca,

  case
    when abs(neraca_total_aset - ledger_total_aset) <= 0.01
     and abs(neraca_total_kewajiban - ledger_total_kewajiban) <= 0.01
     and abs(neraca_total_ekuitas - ledger_total_ekuitas_dengan_laba_berjalan) <= 0.01
     and abs(neraca_selisih) <= 0.01
    then 'MATCH'
    else 'DIFFERENCE'
  end as reconciliation_status,

  now() as checked_at

from reconciliation;

grant select on public.v_neraca_ledger_reconciliation to authenticated;

notify pgrst, 'reload schema';