-- Migration 000029: Frontend Gap Views
-- Source: audited Lovable reverse-engineering draft
-- Purpose: package read-only reporting/compatibility views referenced by frontend but missing from official migrations.
-- Scope: 14 frontend gap views only. No functions, no RLS policies, no broad reverse dump.
-- Dependency order: helper views first, unit financial scoring before Bupati dashboard views.

-- -----------------------------------------------------------------------------
-- public.v_purchase_invoice_payables
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_purchase_invoice_payables AS
 SELECT pi.tenant_id,
    pi.unit_id,
    pi.id AS purchase_invoice_id,
    pi.supplier_id,
    s.supplier_name,
    pi.invoice_no,
    pi.invoice_date,
    pi.due_date,
    pi.payment_type,
    pi.status AS invoice_status,
    pi.total_amount,
    pi.paid_amount AS invoice_paid_amount,
    COALESCE(sum(pip.amount) FILTER (WHERE pip.status = 'posted'::text), 0::numeric)::numeric(18,2) AS payment_amount,
    (pi.total_amount - COALESCE(pi.paid_amount, 0::numeric) - COALESCE(sum(pip.amount) FILTER (WHERE pip.status = 'posted'::text), 0::numeric))::numeric(18,2) AS outstanding_amount,
        CASE
            WHEN (pi.total_amount - COALESCE(pi.paid_amount, 0::numeric) - COALESCE(sum(pip.amount) FILTER (WHERE pip.status = 'posted'::text), 0::numeric)) <= 0::numeric THEN 'paid'::text
            WHEN COALESCE(sum(pip.amount) FILTER (WHERE pip.status = 'posted'::text), 0::numeric) > 0::numeric THEN 'partial'::text
            ELSE 'unpaid'::text
        END AS payable_status
   FROM purchase_invoices pi
     LEFT JOIN suppliers s ON s.id = pi.supplier_id
     LEFT JOIN purchase_invoice_payments pip ON pip.purchase_invoice_id = pi.id
  WHERE pi.payment_type = 'credit'::text AND pi.status = 'posted'::text
  GROUP BY pi.tenant_id, pi.unit_id, pi.id, pi.supplier_id, s.supplier_name, pi.invoice_no, pi.invoice_date, pi.due_date, pi.payment_type, pi.status, pi.total_amount, pi.paid_amount;

-- ---------- v_purchase_summary ----------

GRANT SELECT ON public.v_purchase_invoice_payables TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_capital_expenditure_payables
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_capital_expenditure_payables AS
 SELECT ce.tenant_id,
    ce.unit_id,
    ce.id AS capital_expenditure_id,
    ce.supplier_id,
    s.supplier_name,
    ce.transaction_no,
    ce.transaction_date,
    ce.due_date,
    ce.payment_type,
    ce.status AS capital_expenditure_status,
    ce.total_amount,
    ce.paid_amount AS capital_expenditure_paid_amount,
    COALESCE(sum(cep.amount) FILTER (WHERE cep.status = 'posted'::text), 0::numeric)::numeric(18,2) AS payment_amount,
    (ce.total_amount - COALESCE(ce.paid_amount, 0::numeric) - COALESCE(sum(cep.amount) FILTER (WHERE cep.status = 'posted'::text), 0::numeric))::numeric(18,2) AS outstanding_amount,
        CASE
            WHEN (ce.total_amount - COALESCE(ce.paid_amount, 0::numeric) - COALESCE(sum(cep.amount) FILTER (WHERE cep.status = 'posted'::text), 0::numeric)) <= 0::numeric THEN 'paid'::text
            WHEN COALESCE(sum(cep.amount) FILTER (WHERE cep.status = 'posted'::text), 0::numeric) > 0::numeric THEN 'partial'::text
            ELSE 'unpaid'::text
        END AS payable_status
   FROM capital_expenditures ce
     LEFT JOIN suppliers s ON s.id = ce.supplier_id
     LEFT JOIN capital_expenditure_payments cep ON cep.capital_expenditure_id = ce.id
  WHERE ce.payment_type = 'credit'::text AND ce.status = 'posted'::text
  GROUP BY ce.tenant_id, ce.unit_id, ce.id, ce.supplier_id, s.supplier_name, ce.transaction_no, ce.transaction_date, ce.due_date, ce.payment_type, ce.status, ce.total_amount, ce.paid_amount;

-- ---------- v_cash_bank_balance ----------

GRANT SELECT ON public.v_capital_expenditure_payables TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_fixed_asset_depreciation_summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_fixed_asset_depreciation_summary AS
 WITH depreciation_summary AS (
         SELECT fad.fixed_asset_id,
            count(*) FILTER (WHERE fad.status = 'posted'::text) AS posted_depreciation_count,
            COALESCE(sum(fad.depreciation_amount) FILTER (WHERE fad.status = 'posted'::text), 0::numeric) AS accumulated_depreciation_total,
            max(fad.depreciation_date) FILTER (WHERE fad.status = 'posted'::text) AS last_depreciation_date,
            count(DISTINCT fad.journal_entry_id) FILTER (WHERE fad.status = 'posted'::text) AS posted_journal_count
           FROM fixed_asset_depreciations fad
          GROUP BY fad.fixed_asset_id
        ), current_period AS (
         SELECT ap.id,
            ap.tenant_id,
            ap.unit_id,
            ap.period_year,
            ap.period_month,
            ap.period_start,
            ap.period_end,
            ap.status
           FROM accounting_periods ap
          WHERE CURRENT_DATE >= ap.period_start AND CURRENT_DATE <= ap.period_end
        )
 SELECT fa.id AS fixed_asset_id,
    fa.tenant_id,
    fa.unit_id,
    fa.asset_code,
    fa.asset_name,
    fa.acquisition_date,
    fa.acquisition_cost,
    fa.residual_value,
    fa.useful_life_months,
    fa.depreciation_method,
    fa.status AS asset_status,
    asset_coa.kode AS asset_account_code,
    asset_coa.nama AS asset_account_name,
    acc_coa.kode AS accumulated_depreciation_account_code,
    acc_coa.nama AS accumulated_depreciation_account_name,
    dep_coa.kode AS depreciation_expense_account_code,
    dep_coa.nama AS depreciation_expense_account_name,
    COALESCE(ds.posted_depreciation_count, 0::bigint) AS posted_depreciation_count,
    COALESCE(ds.accumulated_depreciation_total, 0::numeric) AS accumulated_depreciation_total,
    round(fa.acquisition_cost - COALESCE(ds.accumulated_depreciation_total, 0::numeric), 2) AS current_book_value,
    ds.last_depreciation_date,
    COALESCE(ds.posted_journal_count, 0::bigint) AS posted_journal_count,
    cp.id AS current_period_id,
    cp.period_year AS current_period_year,
    cp.period_month AS current_period_month,
    cp.status AS current_period_status,
        CASE
            WHEN fa.status <> 'active'::text THEN 'SKIP: aset tidak aktif'::text
            WHEN fa.accumulated_depreciation_account_id IS NULL THEN 'NOT_READY: akun akumulasi penyusutan kosong'::text
            WHEN fa.depreciation_expense_account_id IS NULL THEN 'NOT_READY: akun beban penyusutan kosong'::text
            WHEN fa.acquisition_cost <= fa.residual_value THEN 'NOT_READY: nilai perolehan tidak lebih besar dari residu'::text
            WHEN fa.useful_life_months <= 0 THEN 'NOT_READY: umur manfaat tidak valid'::text
            WHEN cp.id IS NULL THEN 'NOT_READY: periode berjalan tidak ditemukan'::text
            WHEN cp.status <> 'open'::text THEN 'NOT_READY: periode berjalan tidak open'::text
            WHEN (EXISTS ( SELECT 1
               FROM fixed_asset_depreciations fad
              WHERE fad.fixed_asset_id = fa.id AND fad.period_id = cp.id AND (fad.status = ANY (ARRAY['draft'::text, 'posted'::text])))) THEN 'DONE: sudah disusutkan periode berjalan'::text
            ELSE 'READY'::text
        END AS depreciation_readiness_status,
    round((fa.acquisition_cost - fa.residual_value) / fa.useful_life_months::numeric, 2) AS monthly_depreciation_estimate,
    fa.created_at,
    fa.updated_at
   FROM fixed_assets fa
     LEFT JOIN depreciation_summary ds ON ds.fixed_asset_id = fa.id
     LEFT JOIN current_period cp ON cp.tenant_id = fa.tenant_id AND NOT cp.unit_id IS DISTINCT FROM fa.unit_id
     LEFT JOIN chart_of_accounts asset_coa ON asset_coa.id = fa.asset_account_id
     LEFT JOIN chart_of_accounts acc_coa ON acc_coa.id = fa.accumulated_depreciation_account_id
     LEFT JOIN chart_of_accounts dep_coa ON dep_coa.id = fa.depreciation_expense_account_id;

-- ---------- v_inventory_stock ----------

GRANT SELECT ON public.v_fixed_asset_depreciation_summary TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_fixed_asset_depreciation_flow_audit
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_fixed_asset_depreciation_flow_audit AS
 WITH journal_summary AS (
         SELECT je_1.id AS journal_entry_id,
            sum(jl.debit) AS total_debit,
            sum(jl.credit) AS total_credit,
            round(sum(jl.debit) - sum(jl.credit), 2) AS journal_diff
           FROM journal_entries je_1
             JOIN journal_lines jl ON jl.journal_entry_id = je_1.id
          GROUP BY je_1.id
        ), journal_checks AS (
         SELECT fad_1.id AS depreciation_id,
            bool_or(jl.account_id = fa_1.depreciation_expense_account_id AND jl.debit = fad_1.depreciation_amount AND jl.credit = 0::numeric) AS has_expense_debit,
            bool_or(jl.account_id = fa_1.accumulated_depreciation_account_id AND jl.credit = fad_1.depreciation_amount AND jl.debit = 0::numeric) AS has_accumulated_credit
           FROM fixed_asset_depreciations fad_1
             JOIN fixed_assets fa_1 ON fa_1.id = fad_1.fixed_asset_id
             LEFT JOIN journal_lines jl ON jl.journal_entry_id = fad_1.journal_entry_id
          GROUP BY fad_1.id
        )
 SELECT fad.id AS depreciation_id,
    fad.tenant_id,
    fad.unit_id,
    fad.fixed_asset_id,
    fa.asset_code,
    fa.asset_name,
    fa.acquisition_date,
    fa.acquisition_cost,
    fa.residual_value,
    fa.useful_life_months,
    fa.status AS asset_status,
    fad.period_id,
    ap.period_year,
    ap.period_month,
    fad.depreciation_date,
    fad.depreciation_amount,
    fad.accumulated_depreciation_amount,
    fad.book_value_after,
    fad.status AS depreciation_status,
    fad.journal_entry_id,
    je.journal_no,
    je.status AS journal_status,
    exp_coa.kode AS depreciation_expense_account_code,
    exp_coa.nama AS depreciation_expense_account_name,
    acc_coa.kode AS accumulated_depreciation_account_code,
    acc_coa.nama AS accumulated_depreciation_account_name,
    COALESCE(js.total_debit, 0::numeric) AS total_debit,
    COALESCE(js.total_credit, 0::numeric) AS total_credit,
    COALESCE(js.journal_diff, 0::numeric) AS journal_diff,
    COALESCE(jc.has_expense_debit, false) AS has_expense_debit,
    COALESCE(jc.has_accumulated_credit, false) AS has_accumulated_credit,
        CASE
            WHEN fad.status = 'posted'::text AND je.status = 'posted'::text AND COALESCE(js.journal_diff, 0::numeric) = 0::numeric AND COALESCE(jc.has_expense_debit, false) AND COALESCE(jc.has_accumulated_credit, false) AND fad.depreciation_amount > 0::numeric AND fad.book_value_after >= fa.residual_value THEN 'PASS'::text
            ELSE 'CHECK'::text
        END AS audit_result,
    array_remove(ARRAY[
        CASE
            WHEN fad.status <> 'posted'::text THEN 'Penyusutan belum posted'::text
            ELSE NULL::text
        END,
        CASE
            WHEN je.id IS NULL THEN 'Jurnal penyusutan belum terbentuk'::text
            ELSE NULL::text
        END,
        CASE
            WHEN je.status IS DISTINCT FROM 'posted'::text THEN 'Jurnal penyusutan belum posted'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(js.journal_diff, 0::numeric) <> 0::numeric THEN 'Jurnal penyusutan tidak seimbang'::text
            ELSE NULL::text
        END,
        CASE
            WHEN NOT COALESCE(jc.has_expense_debit, false) THEN 'Debit beban penyusutan belum sesuai'::text
            ELSE NULL::text
        END,
        CASE
            WHEN NOT COALESCE(jc.has_accumulated_credit, false) THEN 'Kredit akumulasi penyusutan belum sesuai'::text
            ELSE NULL::text
        END,
        CASE
            WHEN fad.depreciation_amount <= 0::numeric THEN 'Nilai penyusutan tidak valid'::text
            ELSE NULL::text
        END,
        CASE
            WHEN fad.book_value_after < fa.residual_value THEN 'Nilai buku lebih kecil dari nilai residu'::text
            ELSE NULL::text
        END], NULL::text) AS audit_notes,
    fad.created_at,
    fad.updated_at
   FROM fixed_asset_depreciations fad
     JOIN fixed_assets fa ON fa.id = fad.fixed_asset_id
     JOIN accounting_periods ap ON ap.id = fad.period_id
     LEFT JOIN journal_entries je ON je.id = fad.journal_entry_id
     LEFT JOIN chart_of_accounts exp_coa ON exp_coa.id = fa.depreciation_expense_account_id
     LEFT JOIN chart_of_accounts acc_coa ON acc_coa.id = fa.accumulated_depreciation_account_id
     LEFT JOIN journal_summary js ON js.journal_entry_id = fad.journal_entry_id
     LEFT JOIN journal_checks jc ON jc.depreciation_id = fad.id;

-- ---------- v_fixed_asset_depreciation_summary ----------

GRANT SELECT ON public.v_fixed_asset_depreciation_flow_audit TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_journal_correction_eligible_entries
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_journal_correction_eligible_entries AS
 WITH journal_totals AS (
         SELECT jl.journal_entry_id,
            COALESCE(sum(jl.debit), 0::numeric) AS total_debit,
            COALESCE(sum(jl.credit), 0::numeric) AS total_credit,
            count(jl.id) AS line_count
           FROM journal_lines jl
          GROUP BY jl.journal_entry_id
        ), active_corrections AS (
         SELECT DISTINCT jc.original_journal_entry_id
           FROM journal_corrections jc
          WHERE jc.status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'posted'::text])
        )
 SELECT je.id AS journal_entry_id,
    je.tenant_id,
    t.kode_bumdes,
    t.nama_bumdes,
    je.unit_id,
    bu.kode_unit,
    bu.nama_unit,
    je.journal_no,
    je.journal_date,
    je.source_type,
    je.source_id,
    je.description,
    je.status AS journal_status,
    jt.total_debit,
    jt.total_credit,
    jt.line_count,
    je.created_at,
    jt.total_debit = jt.total_credit AND jt.line_count >= 2 AS is_balanced
   FROM journal_entries je
     JOIN journal_totals jt ON jt.journal_entry_id = je.id
     JOIN tenants t ON t.id = je.tenant_id
     LEFT JOIN business_units bu ON bu.id = je.unit_id
     LEFT JOIN active_corrections ac ON ac.original_journal_entry_id = je.id
  WHERE je.status = 'posted'::text AND je.reversal_of IS NULL AND ac.original_journal_entry_id IS NULL AND jt.total_debit = jt.total_credit AND jt.line_count >= 2 AND (je.source_type <> ALL (ARRAY['journal_correction_reversal'::text, 'journal_correction_replacement'::text]));

-- ---------- v_journal_correction_eligible_entry_lines ----------

GRANT SELECT ON public.v_journal_correction_eligible_entries TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_journal_correction_eligible_entry_lines
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_journal_correction_eligible_entry_lines AS
 SELECT je.id AS journal_entry_id,
    je.tenant_id,
    je.unit_id,
    je.journal_no,
    je.journal_date,
    je.source_type,
    je.description AS journal_description,
    je.status AS journal_status,
    jl.id AS journal_line_id,
    jl.line_no,
    jl.account_id,
    coa.kode AS account_code,
    coa.nama AS account_name,
    coa.tipe AS account_tipe,
    coa.account_type,
    coa.normal_balance,
    jl.description AS line_description,
    jl.debit,
    jl.credit
   FROM journal_entries je
     JOIN journal_lines jl ON jl.journal_entry_id = je.id
     JOIN chart_of_accounts coa ON coa.id = jl.account_id
  WHERE je.status = 'posted'::text AND (je.source_type = ANY (ARRAY['purchase_invoice'::text, 'sales_invoice'::text, 'cash_bank_transaction'::text, 'operational_expense'::text, 'capital_expenditure'::text, 'revenue_receipt'::text, 'debt_payment'::text])) AND NOT (EXISTS ( SELECT 1
           FROM journal_corrections jc
          WHERE jc.original_journal_entry_id = je.id AND (jc.status = ANY (ARRAY['draft'::text, 'pending_approval'::text, 'approved'::text, 'posted'::text]))));

-- ---------- v_journal_correction_flow ----------

GRANT SELECT ON public.v_journal_correction_eligible_entry_lines TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_journal_correction_flow
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_journal_correction_flow AS
 WITH journal_totals AS (
         SELECT je.id AS journal_entry_id,
            COALESCE(sum(jl.debit), 0::numeric) AS total_debit,
            COALESCE(sum(jl.credit), 0::numeric) AS total_credit,
            count(jl.id) AS line_count
           FROM journal_entries je
             LEFT JOIN journal_lines jl ON jl.journal_entry_id = je.id
          GROUP BY je.id
        )
 SELECT jc.id AS correction_id,
    jc.tenant_id,
    t.kode_bumdes,
    t.nama_bumdes,
    jc.unit_id,
    bu.kode_unit,
    bu.nama_unit,
    jc.correction_no,
    jc.correction_date,
    jc.reason,
    jc.status AS correction_status,
    jc.original_journal_entry_id,
    original_je.journal_no AS original_journal_no,
    original_je.journal_date AS original_journal_date,
    original_je.source_type AS original_source_type,
    original_je.source_id AS original_source_id,
    original_je.description AS original_description,
    original_je.status AS original_journal_status,
    original_total.total_debit AS original_total_debit,
    original_total.total_credit AS original_total_credit,
    original_total.line_count AS original_line_count,
    jc.reversal_journal_entry_id,
    reversal_je.journal_no AS reversal_journal_no,
    reversal_je.journal_date AS reversal_journal_date,
    reversal_je.source_type AS reversal_source_type,
    reversal_je.description AS reversal_description,
    reversal_je.status AS reversal_journal_status,
    reversal_je.reversal_of,
    reversal_total.total_debit AS reversal_total_debit,
    reversal_total.total_credit AS reversal_total_credit,
    reversal_total.line_count AS reversal_line_count,
    jc.corrected_journal_entry_id,
    corrected_je.journal_no AS corrected_journal_no,
    corrected_je.journal_date AS corrected_journal_date,
    corrected_je.source_type AS corrected_source_type,
    corrected_je.description AS corrected_description,
    corrected_je.status AS corrected_journal_status,
    corrected_total.total_debit AS corrected_total_debit,
    corrected_total.total_credit AS corrected_total_credit,
    corrected_total.line_count AS corrected_line_count,
    jc.requested_by,
    requested_profile.full_name AS requested_by_name,
    jc.requested_at,
    jc.approved_by,
    approved_profile.full_name AS approved_by_name,
    jc.approved_at,
    jc.rejected_by,
    rejected_profile.full_name AS rejected_by_name,
    jc.rejected_at,
    jc.rejection_reason,
    jc.posted_by,
    posted_profile.full_name AS posted_by_name,
    jc.posted_at,
    jc.cancelled_by,
    cancelled_profile.full_name AS cancelled_by_name,
    jc.cancelled_at,
    jc.cancellation_reason,
    jc.created_by,
    created_profile.full_name AS created_by_name,
    jc.created_at,
    jc.updated_at,
        CASE
            WHEN jc.status = 'draft'::text AND jc.corrected_journal_entry_id IS NULL THEN 'NEED_REPLACEMENT_JOURNAL'::text
            WHEN jc.status = 'draft'::text AND jc.corrected_journal_entry_id IS NOT NULL THEN 'READY_TO_REQUEST_APPROVAL'::text
            WHEN jc.status = 'pending_approval'::text THEN 'WAITING_PENGAWAS_APPROVAL'::text
            WHEN jc.status = 'approved'::text AND jc.corrected_journal_entry_id IS NOT NULL THEN 'READY_TO_POST'::text
            WHEN jc.status = 'approved'::text AND jc.corrected_journal_entry_id IS NULL THEN 'APPROVED_BUT_MISSING_REPLACEMENT'::text
            WHEN jc.status = 'rejected'::text THEN 'REJECTED_BY_PENGAWAS'::text
            WHEN jc.status = 'cancelled'::text THEN 'CANCELLED'::text
            WHEN jc.status = 'posted'::text AND original_je.status = 'reversed'::text AND reversal_je.status = 'posted'::text AND corrected_je.status = 'posted'::text AND original_total.total_debit = original_total.total_credit AND reversal_total.total_debit = reversal_total.total_credit AND corrected_total.total_debit = corrected_total.total_credit THEN 'POSTED_AUDIT_PASS'::text
            WHEN jc.status = 'posted'::text THEN 'POSTED_AUDIT_NEEDS_REVIEW'::text
            ELSE 'UNKNOWN'::text
        END AS flow_status,
        CASE
            WHEN original_total.total_debit = original_total.total_credit AND original_total.total_debit > 0::numeric THEN true
            ELSE false
        END AS original_balanced,
        CASE
            WHEN jc.reversal_journal_entry_id IS NULL THEN NULL::boolean
            WHEN reversal_total.total_debit = reversal_total.total_credit AND reversal_total.total_debit > 0::numeric THEN true
            ELSE false
        END AS reversal_balanced,
        CASE
            WHEN jc.corrected_journal_entry_id IS NULL THEN NULL::boolean
            WHEN corrected_total.total_debit = corrected_total.total_credit AND corrected_total.total_debit > 0::numeric THEN true
            ELSE false
        END AS corrected_balanced,
        CASE
            WHEN jc.status = 'posted'::text AND original_je.status = 'reversed'::text AND reversal_je.status = 'posted'::text AND corrected_je.status = 'posted'::text AND original_total.total_debit = original_total.total_credit AND reversal_total.total_debit = reversal_total.total_credit AND corrected_total.total_debit = corrected_total.total_credit THEN 'PASS'::text
            WHEN jc.status = 'posted'::text THEN 'FAIL'::text
            ELSE 'NOT_POSTED'::text
        END AS audit_result
   FROM journal_corrections jc
     JOIN tenants t ON t.id = jc.tenant_id
     LEFT JOIN business_units bu ON bu.id = jc.unit_id
     JOIN journal_entries original_je ON original_je.id = jc.original_journal_entry_id
     LEFT JOIN journal_totals original_total ON original_total.journal_entry_id = original_je.id
     LEFT JOIN journal_entries reversal_je ON reversal_je.id = jc.reversal_journal_entry_id
     LEFT JOIN journal_totals reversal_total ON reversal_total.journal_entry_id = reversal_je.id
     LEFT JOIN journal_entries corrected_je ON corrected_je.id = jc.corrected_journal_entry_id
     LEFT JOIN journal_totals corrected_total ON corrected_total.journal_entry_id = corrected_je.id
     LEFT JOIN profiles requested_profile ON requested_profile.id = jc.requested_by
     LEFT JOIN profiles approved_profile ON approved_profile.id = jc.approved_by
     LEFT JOIN profiles rejected_profile ON rejected_profile.id = jc.rejected_by
     LEFT JOIN profiles posted_profile ON posted_profile.id = jc.posted_by
     LEFT JOIN profiles cancelled_profile ON cancelled_profile.id = jc.cancelled_by
     LEFT JOIN profiles created_profile ON created_profile.id = jc.created_by;

-- ---------- v_journal_correction_governance_timeline ----------

GRANT SELECT ON public.v_journal_correction_flow TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_journal_correction_governance_timeline
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_journal_correction_governance_timeline AS
 SELECT jc.id AS correction_id,
    jc.tenant_id,
    t.kode_bumdes,
    t.nama_bumdes,
    jc.unit_id,
    bu.kode_unit,
    bu.nama_unit,
    jc.correction_no,
    jc.correction_date,
    jc.status AS correction_status,
    jcn.id AS note_id,
    jcn.note_type,
    jcn.note,
    jcn.actor_id,
    actor_profile.full_name AS actor_name,
    jcn.created_at AS event_at,
        CASE
            WHEN jcn.note_type = 'note'::text AND jcn.note ~~* 'Draft koreksi dibuat:%'::text THEN 'DRAFT_CREATED'::text
            WHEN jcn.note_type = 'note'::text AND jcn.note ~~* 'Draft jurnal pengganti disiapkan:%'::text THEN 'REPLACEMENT_PREPARED'::text
            WHEN jcn.note_type = 'review'::text THEN 'REQUESTED_FOR_APPROVAL'::text
            WHEN jcn.note_type = 'approval'::text THEN 'APPROVED_BY_PENGAWAS'::text
            WHEN jcn.note_type = 'rejection'::text THEN 'REJECTED_BY_PENGAWAS'::text
            WHEN jcn.note_type = 'posting'::text THEN 'POSTED_BY_SYSTEM'::text
            ELSE upper(jcn.note_type)
        END AS timeline_event,
        CASE
            WHEN jcn.note_type = 'note'::text AND jcn.note ~~* 'Draft koreksi dibuat:%'::text THEN 10
            WHEN jcn.note_type = 'note'::text AND jcn.note ~~* 'Draft jurnal pengganti disiapkan:%'::text THEN 20
            WHEN jcn.note_type = 'review'::text THEN 30
            WHEN jcn.note_type = 'approval'::text THEN 40
            WHEN jcn.note_type = 'rejection'::text THEN 45
            WHEN jcn.note_type = 'posting'::text THEN 50
            ELSE 99
        END AS timeline_order
   FROM journal_correction_notes jcn
     JOIN journal_corrections jc ON jc.id = jcn.correction_id
     JOIN tenants t ON t.id = jc.tenant_id
     LEFT JOIN business_units bu ON bu.id = jc.unit_id
     LEFT JOIN profiles actor_profile ON actor_profile.id = jcn.actor_id;

-- ---------- v_journal_correction_line_comparison ----------

GRANT SELECT ON public.v_journal_correction_governance_timeline TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_journal_correction_line_comparison
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_journal_correction_line_comparison AS
 WITH correction_journals AS (
         SELECT jc.id AS correction_id,
            jc.tenant_id,
            jc.unit_id,
            jc.correction_no,
            jc.correction_date,
            jc.status AS correction_status,
            'original'::text AS journal_role,
            jc.original_journal_entry_id AS journal_entry_id
           FROM journal_corrections jc
        UNION ALL
         SELECT jc.id AS correction_id,
            jc.tenant_id,
            jc.unit_id,
            jc.correction_no,
            jc.correction_date,
            jc.status AS correction_status,
            'reversal'::text AS journal_role,
            jc.reversal_journal_entry_id AS journal_entry_id
           FROM journal_corrections jc
          WHERE jc.reversal_journal_entry_id IS NOT NULL
        UNION ALL
         SELECT jc.id AS correction_id,
            jc.tenant_id,
            jc.unit_id,
            jc.correction_no,
            jc.correction_date,
            jc.status AS correction_status,
            'corrected'::text AS journal_role,
            jc.corrected_journal_entry_id AS journal_entry_id
           FROM journal_corrections jc
          WHERE jc.corrected_journal_entry_id IS NOT NULL
        )
 SELECT cj.correction_id,
    cj.tenant_id,
    t.kode_bumdes,
    t.nama_bumdes,
    cj.unit_id,
    bu.kode_unit,
    bu.nama_unit,
    cj.correction_no,
    cj.correction_date,
    cj.correction_status,
    cj.journal_role,
    je.id AS journal_entry_id,
    je.journal_no,
    je.journal_date,
    je.source_type,
    je.status AS journal_status,
    je.description AS journal_description,
    je.reversal_of,
    jl.id AS journal_line_id,
    jl.line_no,
    jl.account_id,
    coa.kode AS account_code,
    coa.nama AS account_name,
    coa.tipe::text AS account_tipe,
    coa.account_type::text AS account_type,
    jl.description AS line_description,
    jl.debit,
    jl.credit,
        CASE
            WHEN cj.journal_role = 'original'::text THEN 1
            WHEN cj.journal_role = 'reversal'::text THEN 2
            WHEN cj.journal_role = 'corrected'::text THEN 3
            ELSE 9
        END AS journal_role_order
   FROM correction_journals cj
     JOIN tenants t ON t.id = cj.tenant_id
     LEFT JOIN business_units bu ON bu.id = cj.unit_id
     JOIN journal_entries je ON je.id = cj.journal_entry_id
     JOIN journal_lines jl ON jl.journal_entry_id = je.id
     JOIN chart_of_accounts coa ON coa.id = jl.account_id;

-- ---------- v_laba_rugi_detail ----------

GRANT SELECT ON public.v_journal_correction_line_comparison TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_unit_financial_health_scoring
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_unit_financial_health_scoring AS
 WITH laba_rugi_yearly AS (
         SELECT v_laba_rugi_summary.tenant_id,
            v_laba_rugi_summary.unit_id,
            v_laba_rugi_summary.period_year AS report_year,
            sum(COALESCE(v_laba_rugi_summary.total_pendapatan, 0::numeric)) AS total_pendapatan,
            sum(COALESCE(v_laba_rugi_summary.total_hpp, 0::numeric)) AS total_hpp,
            sum(COALESCE(v_laba_rugi_summary.laba_kotor, 0::numeric)) AS laba_kotor,
            sum(COALESCE(v_laba_rugi_summary.total_beban, 0::numeric)) AS total_beban,
            sum(COALESCE(v_laba_rugi_summary.laba_rugi_bersih, 0::numeric)) AS laba_rugi_bersih
           FROM v_laba_rugi_summary
          GROUP BY v_laba_rugi_summary.tenant_id, v_laba_rugi_summary.unit_id, v_laba_rugi_summary.period_year
        ), neraca_detail_grouped AS (
         SELECT v_neraca_detail.tenant_id,
            v_neraca_detail.unit_id,
            sum(
                CASE
                    WHEN v_neraca_detail.account_code = ANY (ARRAY['1110'::text, '1111'::text, '1120'::text]) THEN COALESCE(v_neraca_detail.neraca_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS kas_setara_kas,
            sum(
                CASE
                    WHEN v_neraca_detail.account_code = '1130'::text THEN COALESCE(v_neraca_detail.neraca_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS piutang_usaha,
            sum(
                CASE
                    WHEN v_neraca_detail.account_code = '1300'::text THEN COALESCE(v_neraca_detail.neraca_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS persediaan,
            sum(
                CASE
                    WHEN v_neraca_detail.account_code = ANY (ARRAY['1110'::text, '1111'::text, '1120'::text, '1130'::text, '1300'::text]) THEN COALESCE(v_neraca_detail.neraca_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS aset_lancar,
            sum(
                CASE
                    WHEN v_neraca_detail.account_code ~~ '21%'::text THEN COALESCE(v_neraca_detail.neraca_amount, 0::numeric)
                    ELSE 0::numeric
                END) AS kewajiban_lancar
           FROM v_neraca_detail
          GROUP BY v_neraca_detail.tenant_id, v_neraca_detail.unit_id
        ), credit_sales_yearly AS (
         SELECT sales_invoices.tenant_id,
            sales_invoices.unit_id,
            EXTRACT(year FROM sales_invoices.invoice_date)::integer AS report_year,
            sum(COALESCE(sales_invoices.total_amount, 0::numeric)) AS total_penjualan_kredit
           FROM sales_invoices
          WHERE sales_invoices.status = 'posted'::text AND sales_invoices.payment_type = 'credit'::text
          GROUP BY sales_invoices.tenant_id, sales_invoices.unit_id, (EXTRACT(year FROM sales_invoices.invoice_date)::integer)
        ), base AS (
         SELECT lr.tenant_id,
            t.kode_bumdes,
            t.nama_bumdes,
            t.nama_desa,
            t.nama_kecamatan,
            lr.unit_id,
            bu.kode_unit,
            bu.nama_unit,
            lr.report_year,
            lr.total_pendapatan,
            lr.total_hpp,
            lr.laba_kotor,
            lr.total_beban,
            lr.laba_rugi_bersih,
            ns.total_aset,
            ns.total_kewajiban,
            ns.total_ekuitas,
            ns.selisih_neraca,
            ns.status_neraca,
            COALESCE(nd.kas_setara_kas, 0::numeric) AS kas_setara_kas,
            COALESCE(nd.piutang_usaha, 0::numeric) AS piutang_usaha,
            COALESCE(nd.persediaan, 0::numeric) AS persediaan,
            COALESCE(nd.aset_lancar, 0::numeric) AS aset_lancar,
            COALESCE(nd.kewajiban_lancar, 0::numeric) AS kewajiban_lancar,
            COALESCE(cs.total_penjualan_kredit, 0::numeric) AS total_penjualan_kredit,
                CASE
                    WHEN COALESCE(ns.total_ekuitas, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(lr.laba_rugi_bersih / ns.total_ekuitas * 100::numeric, 2)
                END AS roe_percent,
                CASE
                    WHEN COALESCE(ns.total_aset, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(lr.laba_rugi_bersih / ns.total_aset * 100::numeric, 2)
                END AS roi_percent,
                CASE
                    WHEN COALESCE(nd.kewajiban_lancar, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(COALESCE(nd.kas_setara_kas, 0::numeric) / nd.kewajiban_lancar * 100::numeric, 2)
                END AS rasio_kas_percent,
                CASE
                    WHEN COALESCE(nd.kewajiban_lancar, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(COALESCE(nd.aset_lancar, 0::numeric) / nd.kewajiban_lancar * 100::numeric, 2)
                END AS rasio_lancar_percent,
                CASE
                    WHEN COALESCE(cs.total_penjualan_kredit, 0::numeric) = 0::numeric THEN 0::numeric
                    ELSE round(COALESCE(nd.piutang_usaha, 0::numeric) / cs.total_penjualan_kredit * 365::numeric, 2)
                END AS collection_period_days,
                CASE
                    WHEN COALESCE(lr.total_hpp, 0::numeric) = 0::numeric AND COALESCE(nd.persediaan, 0::numeric) = 0::numeric THEN 0::numeric
                    WHEN COALESCE(lr.total_hpp, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(COALESCE(nd.persediaan, 0::numeric) / lr.total_hpp * 365::numeric, 2)
                END AS inventory_turnover_days,
                CASE
                    WHEN COALESCE(ns.total_aset, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(lr.total_pendapatan / ns.total_aset * 100::numeric, 2)
                END AS total_asset_turnover_percent,
                CASE
                    WHEN COALESCE(ns.total_aset, 0::numeric) = 0::numeric THEN NULL::numeric
                    ELSE round(ns.total_ekuitas / ns.total_aset * 100::numeric, 2)
                END AS owner_equity_to_asset_percent
           FROM laba_rugi_yearly lr
             JOIN tenants t ON t.id = lr.tenant_id
             LEFT JOIN business_units bu ON bu.id = lr.unit_id
             LEFT JOIN v_neraca_summary ns ON ns.tenant_id = lr.tenant_id AND NOT ns.unit_id IS DISTINCT FROM lr.unit_id
             LEFT JOIN neraca_detail_grouped nd ON nd.tenant_id = lr.tenant_id AND NOT nd.unit_id IS DISTINCT FROM lr.unit_id
             LEFT JOIN credit_sales_yearly cs ON cs.tenant_id = lr.tenant_id AND NOT cs.unit_id IS DISTINCT FROM lr.unit_id AND cs.report_year = lr.report_year
        ), scored AS (
         SELECT b.tenant_id,
            b.kode_bumdes,
            b.nama_bumdes,
            b.nama_desa,
            b.nama_kecamatan,
            b.unit_id,
            b.kode_unit,
            b.nama_unit,
            b.report_year,
            b.total_pendapatan,
            b.total_hpp,
            b.laba_kotor,
            b.total_beban,
            b.laba_rugi_bersih,
            b.total_aset,
            b.total_kewajiban,
            b.total_ekuitas,
            b.selisih_neraca,
            b.status_neraca,
            b.kas_setara_kas,
            b.piutang_usaha,
            b.persediaan,
            b.aset_lancar,
            b.kewajiban_lancar,
            b.total_penjualan_kredit,
            b.roe_percent,
            b.roi_percent,
            b.rasio_kas_percent,
            b.rasio_lancar_percent,
            b.collection_period_days,
            b.inventory_turnover_days,
            b.total_asset_turnover_percent,
            b.owner_equity_to_asset_percent,
                CASE
                    WHEN b.roe_percent IS NULL THEN 0
                    WHEN b.roe_percent < 0::numeric THEN 0
                    WHEN b.roe_percent < 5::numeric THEN 10
                    WHEN b.roe_percent < 10::numeric THEN 15
                    WHEN b.roe_percent < 15::numeric THEN 20
                    WHEN b.roe_percent < 20::numeric THEN 25
                    ELSE 29
                END AS roe_score,
                CASE
                    WHEN b.roi_percent IS NULL THEN 0
                    WHEN b.roi_percent < 0::numeric THEN 0
                    WHEN b.roi_percent < 2.5 THEN 3
                    WHEN b.roi_percent < 5::numeric THEN 6
                    WHEN b.roi_percent < 7.5 THEN 10
                    WHEN b.roi_percent < 10::numeric THEN 16
                    ELSE 22
                END AS roi_score,
                CASE
                    WHEN b.kewajiban_lancar = 0::numeric THEN 7
                    WHEN b.rasio_kas_percent IS NULL THEN 0
                    WHEN b.rasio_kas_percent < 10::numeric THEN 1
                    WHEN b.rasio_kas_percent < 20::numeric THEN 2
                    WHEN b.rasio_kas_percent < 50::numeric THEN 3
                    WHEN b.rasio_kas_percent < 100::numeric THEN 5
                    ELSE 7
                END AS rasio_kas_score,
                CASE
                    WHEN b.kewajiban_lancar = 0::numeric THEN 7
                    WHEN b.rasio_lancar_percent IS NULL THEN 0
                    WHEN b.rasio_lancar_percent < 100::numeric THEN 2
                    WHEN b.rasio_lancar_percent < 125::numeric THEN 4
                    WHEN b.rasio_lancar_percent < 150::numeric THEN 5
                    WHEN b.rasio_lancar_percent < 200::numeric THEN 6
                    ELSE 7
                END AS rasio_lancar_score,
                CASE
                    WHEN b.collection_period_days IS NULL THEN 0
                    WHEN b.collection_period_days <= 30::numeric THEN 7
                    WHEN b.collection_period_days <= 60::numeric THEN 6
                    WHEN b.collection_period_days <= 90::numeric THEN 5
                    WHEN b.collection_period_days <= 120::numeric THEN 4
                    WHEN b.collection_period_days <= 180::numeric THEN 3
                    ELSE 1
                END AS collection_period_score,
                CASE
                    WHEN b.inventory_turnover_days IS NULL THEN 0
                    WHEN b.inventory_turnover_days <= 60::numeric THEN 7
                    WHEN b.inventory_turnover_days <= 90::numeric THEN 6
                    WHEN b.inventory_turnover_days <= 120::numeric THEN 5
                    WHEN b.inventory_turnover_days <= 150::numeric THEN 4
                    WHEN b.inventory_turnover_days <= 180::numeric THEN 3
                    WHEN b.inventory_turnover_days <= 240::numeric THEN 2
                    ELSE 1
                END AS inventory_turnover_score,
                CASE
                    WHEN b.total_asset_turnover_percent IS NULL THEN 0
                    WHEN b.total_asset_turnover_percent < 10::numeric THEN 1
                    WHEN b.total_asset_turnover_percent < 30::numeric THEN 2
                    WHEN b.total_asset_turnover_percent < 50::numeric THEN 3
                    WHEN b.total_asset_turnover_percent < 100::numeric THEN 4
                    WHEN b.total_asset_turnover_percent < 150::numeric THEN 5
                    WHEN b.total_asset_turnover_percent < 200::numeric THEN 6
                    ELSE 7
                END AS total_asset_turnover_score,
                CASE
                    WHEN b.owner_equity_to_asset_percent IS NULL THEN 0
                    WHEN b.owner_equity_to_asset_percent < 20::numeric THEN 3
                    WHEN b.owner_equity_to_asset_percent < 40::numeric THEN 6
                    WHEN b.owner_equity_to_asset_percent < 60::numeric THEN 14
                    WHEN b.owner_equity_to_asset_percent < 80::numeric THEN 12
                    ELSE 9
                END AS owner_equity_to_asset_score
           FROM base b
        )
 SELECT tenant_id,
    kode_bumdes,
    nama_bumdes,
    nama_desa,
    nama_kecamatan,
    unit_id,
    kode_unit,
    nama_unit,
    report_year,
    total_pendapatan,
    total_hpp,
    laba_kotor,
    total_beban,
    laba_rugi_bersih,
    total_aset,
    total_kewajiban,
    total_ekuitas,
    selisih_neraca,
    status_neraca,
    kas_setara_kas,
    piutang_usaha,
    persediaan,
    aset_lancar,
    kewajiban_lancar,
    total_penjualan_kredit,
    roe_percent,
    roi_percent,
    rasio_kas_percent,
    rasio_lancar_percent,
    collection_period_days,
    inventory_turnover_days,
    total_asset_turnover_percent,
    owner_equity_to_asset_percent,
    29 AS roe_max_score,
    roe_score,
    22 AS roi_max_score,
    roi_score,
    7 AS rasio_kas_max_score,
    rasio_kas_score,
    7 AS rasio_lancar_max_score,
    rasio_lancar_score,
    7 AS collection_period_max_score,
    collection_period_score,
    7 AS inventory_turnover_max_score,
    inventory_turnover_score,
    7 AS total_asset_turnover_max_score,
    total_asset_turnover_score,
    14 AS owner_equity_to_asset_max_score,
    owner_equity_to_asset_score,
    roe_score + roi_score + rasio_kas_score + rasio_lancar_score + collection_period_score + inventory_turnover_score + total_asset_turnover_score + owner_equity_to_asset_score AS total_score,
    100 AS max_score,
        CASE
            WHEN (roe_score + roi_score + rasio_kas_score + rasio_lancar_score + collection_period_score + inventory_turnover_score + total_asset_turnover_score + owner_equity_to_asset_score) >= 65 THEN 'Sehat'::text
            WHEN (roe_score + roi_score + rasio_kas_score + rasio_lancar_score + collection_period_score + inventory_turnover_score + total_asset_turnover_score + owner_equity_to_asset_score) >= 30 THEN 'Kurang Sehat'::text
            ELSE 'Tidak Sehat'::text
        END AS health_status,
        CASE
            WHEN status_neraca = 'SEIMBANG'::text AND COALESCE(selisih_neraca, 0::numeric) = 0::numeric THEN 'PASS'::text
            ELSE 'WARNING'::text
        END AS accounting_consistency_status
   FROM scored;


GRANT SELECT ON public.v_unit_financial_health_scoring TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_bupati_dashboard_summary
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_bupati_dashboard_summary AS
 WITH latest_year AS (
         SELECT COALESCE(max(v_unit_financial_health_scoring.report_year), EXTRACT(year FROM CURRENT_DATE)::integer) AS report_year
           FROM v_unit_financial_health_scoring
        ), health_base AS (
         SELECT h.tenant_id,
            h.kode_bumdes,
            h.nama_bumdes,
            h.nama_desa,
            h.nama_kecamatan,
            h.unit_id,
            h.kode_unit,
            h.nama_unit,
            h.report_year,
            h.total_pendapatan,
            h.total_hpp,
            h.laba_kotor,
            h.total_beban,
            h.laba_rugi_bersih,
            h.total_aset,
            h.total_kewajiban,
            h.total_ekuitas,
            h.selisih_neraca,
            h.status_neraca,
            h.kas_setara_kas,
            h.piutang_usaha,
            h.persediaan,
            h.aset_lancar,
            h.kewajiban_lancar,
            h.total_penjualan_kredit,
            h.roe_percent,
            h.roi_percent,
            h.rasio_kas_percent,
            h.rasio_lancar_percent,
            h.collection_period_days,
            h.inventory_turnover_days,
            h.total_asset_turnover_percent,
            h.owner_equity_to_asset_percent,
            h.roe_max_score,
            h.roe_score,
            h.roi_max_score,
            h.roi_score,
            h.rasio_kas_max_score,
            h.rasio_kas_score,
            h.rasio_lancar_max_score,
            h.rasio_lancar_score,
            h.collection_period_max_score,
            h.collection_period_score,
            h.inventory_turnover_max_score,
            h.inventory_turnover_score,
            h.total_asset_turnover_max_score,
            h.total_asset_turnover_score,
            h.owner_equity_to_asset_max_score,
            h.owner_equity_to_asset_score,
            h.total_score,
            h.max_score,
            h.health_status,
            h.accounting_consistency_status,
            COALESCE(h.total_score, 0)::numeric AS dashboard_health_score,
            COALESCE(h.max_score, 100)::numeric AS dashboard_max_score,
            COALESCE(h.health_status, 'BELUM_DINILAI'::text) AS dashboard_health_status
           FROM v_unit_financial_health_scoring h
             JOIN latest_year y_1 ON y_1.report_year = h.report_year
        ), capital_summary AS (
         SELECT COALESCE(sum(cd.amount), 0::numeric) AS total_dana_tersalur
           FROM capital_disbursements cd
          WHERE cd.status::text = 'posted'::text
        ), financial_summary AS (
         SELECT count(DISTINCT hb.tenant_id)::integer AS total_bumdes_terpantau,
            count(DISTINCT hb.unit_id)::integer AS total_unit_terpantau,
            COALESCE(sum(hb.total_pendapatan), 0::numeric) AS total_pendapatan,
            COALESCE(sum(hb.total_hpp), 0::numeric) AS total_hpp,
            COALESCE(sum(hb.laba_kotor), 0::numeric) AS laba_kotor,
            COALESCE(sum(hb.total_beban), 0::numeric) AS total_beban,
            COALESCE(sum(hb.laba_rugi_bersih), 0::numeric) AS laba_rugi_bersih,
            COALESCE(sum(hb.total_aset), 0::numeric) AS total_aset,
            COALESCE(sum(hb.total_kewajiban), 0::numeric) AS total_kewajiban,
            COALESCE(sum(hb.total_ekuitas), 0::numeric) AS total_ekuitas,
            COALESCE(avg(hb.dashboard_health_score), 0::numeric) AS skor_kesehatan_rata_rata,
            COALESCE(avg(hb.dashboard_max_score), 100::numeric) AS skor_maksimal_rata_rata,
            count(*) FILTER (WHERE hb.dashboard_health_status ~~* '%SEHAT%'::text AND hb.dashboard_health_status !~~* '%KURANG%'::text AND hb.dashboard_health_status !~~* '%TIDAK%'::text)::integer AS total_sehat,
            count(*) FILTER (WHERE hb.dashboard_health_status ~~* '%KURANG%'::text)::integer AS total_kurang_sehat,
            count(*) FILTER (WHERE hb.dashboard_health_status ~~* '%TIDAK%'::text)::integer AS total_tidak_sehat
           FROM health_base hb
        )
 SELECT y.report_year,
    fs.total_bumdes_terpantau,
    fs.total_unit_terpantau,
    cs.total_dana_tersalur,
    fs.total_aset,
    fs.total_kewajiban,
    fs.total_ekuitas,
    fs.total_pendapatan,
    fs.total_hpp,
    fs.laba_kotor,
    fs.total_beban,
    fs.laba_rugi_bersih,
    fs.skor_kesehatan_rata_rata,
    fs.skor_maksimal_rata_rata,
    fs.total_sehat,
    fs.total_kurang_sehat,
    fs.total_tidak_sehat,
        CASE
            WHEN fs.skor_kesehatan_rata_rata >= 70::numeric THEN 'SEHAT'::text
            WHEN fs.skor_kesehatan_rata_rata >= 45::numeric THEN 'KURANG_SEHAT'::text
            ELSE 'TIDAK_SEHAT'::text
        END AS status_kesehatan_kabupaten,
        CASE
            WHEN cs.total_dana_tersalur > 0::numeric THEN round(fs.total_aset / cs.total_dana_tersalur * 100::numeric, 2)
            ELSE 0::numeric
        END AS aset_terhadap_dana_tersalur_percent,
        CASE
            WHEN cs.total_dana_tersalur > 0::numeric THEN round(fs.laba_rugi_bersih / cs.total_dana_tersalur * 100::numeric, 2)
            ELSE 0::numeric
        END AS produktivitas_dana_percent
   FROM latest_year y
     CROSS JOIN financial_summary fs
     CROSS JOIN capital_summary cs;

-- ---------- v_bupati_kecamatan_performance ----------

GRANT SELECT ON public.v_bupati_dashboard_summary TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_bupati_kecamatan_performance
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_bupati_kecamatan_performance AS
 WITH latest_year AS (
         SELECT COALESCE(max(v_unit_financial_health_scoring.report_year), EXTRACT(year FROM CURRENT_DATE)::integer) AS report_year
           FROM v_unit_financial_health_scoring
        ), base AS (
         SELECT h.tenant_id,
            h.kode_bumdes,
            h.nama_bumdes,
            h.nama_desa,
            h.nama_kecamatan,
            h.unit_id,
            h.kode_unit,
            h.nama_unit,
            h.report_year,
            h.total_pendapatan,
            h.total_hpp,
            h.laba_kotor,
            h.total_beban,
            h.laba_rugi_bersih,
            h.total_aset,
            h.total_kewajiban,
            h.total_ekuitas,
            h.selisih_neraca,
            h.status_neraca,
            h.kas_setara_kas,
            h.piutang_usaha,
            h.persediaan,
            h.aset_lancar,
            h.kewajiban_lancar,
            h.total_penjualan_kredit,
            h.roe_percent,
            h.roi_percent,
            h.rasio_kas_percent,
            h.rasio_lancar_percent,
            h.collection_period_days,
            h.inventory_turnover_days,
            h.total_asset_turnover_percent,
            h.owner_equity_to_asset_percent,
            h.roe_max_score,
            h.roe_score,
            h.roi_max_score,
            h.roi_score,
            h.rasio_kas_max_score,
            h.rasio_kas_score,
            h.rasio_lancar_max_score,
            h.rasio_lancar_score,
            h.collection_period_max_score,
            h.collection_period_score,
            h.inventory_turnover_max_score,
            h.inventory_turnover_score,
            h.total_asset_turnover_max_score,
            h.total_asset_turnover_score,
            h.owner_equity_to_asset_max_score,
            h.owner_equity_to_asset_score,
            h.total_score,
            h.max_score,
            h.health_status,
            h.accounting_consistency_status,
            COALESCE(h.total_score, 0)::numeric AS dashboard_health_score,
            COALESCE(h.max_score, 100)::numeric AS dashboard_max_score,
            COALESCE(h.health_status, 'BELUM_DINILAI'::text) AS dashboard_health_status
           FROM v_unit_financial_health_scoring h
             JOIN latest_year y ON y.report_year = h.report_year
        ), capital_by_kecamatan AS (
         SELECT t.nama_kecamatan,
            COALESCE(sum(cd.amount), 0::numeric) AS total_dana_tersalur
           FROM capital_disbursements cd
             JOIN tenants t ON t.id = cd.tenant_id
          WHERE cd.status::text = 'posted'::text
          GROUP BY t.nama_kecamatan
        )
 SELECT b.nama_kecamatan,
    count(DISTINCT b.tenant_id)::integer AS total_bumdes,
    count(DISTINCT b.unit_id)::integer AS total_unit,
    COALESCE(sum(b.total_pendapatan), 0::numeric) AS total_pendapatan,
    COALESCE(sum(b.laba_rugi_bersih), 0::numeric) AS laba_rugi_bersih,
    COALESCE(sum(b.total_aset), 0::numeric) AS total_aset,
    COALESCE(avg(b.dashboard_health_score), 0::numeric) AS skor_rata_rata,
    COALESCE(avg(b.dashboard_max_score), 100::numeric) AS skor_maksimal_rata_rata,
    count(*) FILTER (WHERE b.dashboard_health_status ~~* '%SEHAT%'::text AND b.dashboard_health_status !~~* '%KURANG%'::text AND b.dashboard_health_status !~~* '%TIDAK%'::text)::integer AS total_sehat,
    count(*) FILTER (WHERE b.dashboard_health_status ~~* '%KURANG%'::text)::integer AS total_kurang_sehat,
    count(*) FILTER (WHERE b.dashboard_health_status ~~* '%TIDAK%'::text)::integer AS total_tidak_sehat,
    COALESCE(cbk.total_dana_tersalur, 0::numeric) AS total_dana_tersalur
   FROM base b
     LEFT JOIN capital_by_kecamatan cbk ON cbk.nama_kecamatan = b.nama_kecamatan
  GROUP BY b.nama_kecamatan, cbk.total_dana_tersalur;

-- ---------- v_bupati_top_performing_bumdes ----------

GRANT SELECT ON public.v_bupati_kecamatan_performance TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_bupati_bumdes_priority_attention
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_bupati_bumdes_priority_attention AS
 WITH latest_year AS (
         SELECT COALESCE(max(v_unit_financial_health_scoring.report_year), EXTRACT(year FROM CURRENT_DATE)::integer) AS report_year
           FROM v_unit_financial_health_scoring
        ), base AS (
         SELECT h.tenant_id,
            h.kode_bumdes,
            h.nama_bumdes,
            h.nama_desa,
            h.nama_kecamatan,
            h.unit_id,
            h.kode_unit,
            h.nama_unit,
            h.report_year,
            h.total_pendapatan,
            h.total_hpp,
            h.laba_kotor,
            h.total_beban,
            h.laba_rugi_bersih,
            h.total_aset,
            h.total_kewajiban,
            h.total_ekuitas,
            h.selisih_neraca,
            h.status_neraca,
            h.kas_setara_kas,
            h.piutang_usaha,
            h.persediaan,
            h.aset_lancar,
            h.kewajiban_lancar,
            h.total_penjualan_kredit,
            h.roe_percent,
            h.roi_percent,
            h.rasio_kas_percent,
            h.rasio_lancar_percent,
            h.collection_period_days,
            h.inventory_turnover_days,
            h.total_asset_turnover_percent,
            h.owner_equity_to_asset_percent,
            h.roe_max_score,
            h.roe_score,
            h.roi_max_score,
            h.roi_score,
            h.rasio_kas_max_score,
            h.rasio_kas_score,
            h.rasio_lancar_max_score,
            h.rasio_lancar_score,
            h.collection_period_max_score,
            h.collection_period_score,
            h.inventory_turnover_max_score,
            h.inventory_turnover_score,
            h.total_asset_turnover_max_score,
            h.total_asset_turnover_score,
            h.owner_equity_to_asset_max_score,
            h.owner_equity_to_asset_score,
            h.total_score,
            h.max_score,
            h.health_status,
            h.accounting_consistency_status,
            COALESCE(h.total_score, 0)::numeric AS dashboard_health_score,
            COALESCE(h.max_score, 100)::numeric AS dashboard_max_score,
            COALESCE(h.health_status, 'BELUM_DINILAI'::text) AS dashboard_health_status
           FROM v_unit_financial_health_scoring h
             JOIN latest_year y ON y.report_year = h.report_year
        )
 SELECT tenant_id,
    kode_bumdes,
    nama_bumdes,
    nama_desa,
    nama_kecamatan,
    unit_id,
    kode_unit,
    nama_unit,
    report_year,
    total_pendapatan,
    laba_rugi_bersih,
    total_aset,
    kas_setara_kas,
    piutang_usaha,
    persediaan,
    roe_percent,
    roi_percent,
    rasio_kas_percent,
    rasio_lancar_percent,
    dashboard_health_score AS skor_kesehatan,
    dashboard_max_score AS skor_maksimal,
    dashboard_health_status,
    accounting_consistency_status,
    concat_ws(', '::text,
        CASE
            WHEN COALESCE(laba_rugi_bersih, 0::numeric) < 0::numeric THEN 'rugi bersih'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(kas_setara_kas, 0::numeric) <= 0::numeric THEN 'kas rendah'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(roe_percent, 0::numeric) < 0::numeric THEN 'ROE negatif'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(rasio_lancar_percent, 0::numeric) < 100::numeric THEN 'rasio lancar rendah'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(piutang_usaha, 0::numeric) > 0::numeric AND COALESCE(collection_period_days, 0::numeric) > 60::numeric THEN 'piutang tinggi'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(inventory_turnover_days, 0::numeric) > 90::numeric THEN 'persediaan lambat'::text
            ELSE NULL::text
        END,
        CASE
            WHEN COALESCE(accounting_consistency_status, ''::text) !~~* '%PASS%'::text THEN 'konsistensi akuntansi perlu dicek'::text
            ELSE NULL::text
        END) AS masalah_utama
   FROM base b
  WHERE dashboard_health_status ~~* '%KURANG%'::text OR dashboard_health_status ~~* '%TIDAK%'::text OR COALESCE(laba_rugi_bersih, 0::numeric) < 0::numeric OR COALESCE(kas_setara_kas, 0::numeric) <= 0::numeric OR COALESCE(roe_percent, 0::numeric) < 0::numeric OR COALESCE(accounting_consistency_status, ''::text) !~~* '%PASS%'::text
  ORDER BY dashboard_health_score, laba_rugi_bersih;

-- ---------- v_bupati_dashboard_summary ----------

GRANT SELECT ON public.v_bupati_bumdes_priority_attention TO authenticated;

-- -----------------------------------------------------------------------------
-- public.v_bupati_top_performing_bumdes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_bupati_top_performing_bumdes AS
 WITH latest_year AS (
         SELECT COALESCE(max(v_unit_financial_health_scoring.report_year), EXTRACT(year FROM CURRENT_DATE)::integer) AS report_year
           FROM v_unit_financial_health_scoring
        ), base AS (
         SELECT h.tenant_id,
            h.kode_bumdes,
            h.nama_bumdes,
            h.nama_desa,
            h.nama_kecamatan,
            h.unit_id,
            h.kode_unit,
            h.nama_unit,
            h.report_year,
            h.total_pendapatan,
            h.total_hpp,
            h.laba_kotor,
            h.total_beban,
            h.laba_rugi_bersih,
            h.total_aset,
            h.total_kewajiban,
            h.total_ekuitas,
            h.selisih_neraca,
            h.status_neraca,
            h.kas_setara_kas,
            h.piutang_usaha,
            h.persediaan,
            h.aset_lancar,
            h.kewajiban_lancar,
            h.total_penjualan_kredit,
            h.roe_percent,
            h.roi_percent,
            h.rasio_kas_percent,
            h.rasio_lancar_percent,
            h.collection_period_days,
            h.inventory_turnover_days,
            h.total_asset_turnover_percent,
            h.owner_equity_to_asset_percent,
            h.roe_max_score,
            h.roe_score,
            h.roi_max_score,
            h.roi_score,
            h.rasio_kas_max_score,
            h.rasio_kas_score,
            h.rasio_lancar_max_score,
            h.rasio_lancar_score,
            h.collection_period_max_score,
            h.collection_period_score,
            h.inventory_turnover_max_score,
            h.inventory_turnover_score,
            h.total_asset_turnover_max_score,
            h.total_asset_turnover_score,
            h.owner_equity_to_asset_max_score,
            h.owner_equity_to_asset_score,
            h.total_score,
            h.max_score,
            h.health_status,
            h.accounting_consistency_status,
            COALESCE(h.total_score, 0)::numeric AS dashboard_health_score,
            COALESCE(h.max_score, 100)::numeric AS dashboard_max_score,
            COALESCE(h.health_status, 'BELUM_DINILAI'::text) AS dashboard_health_status
           FROM v_unit_financial_health_scoring h
             JOIN latest_year y ON y.report_year = h.report_year
        )
 SELECT tenant_id,
    kode_bumdes,
    nama_bumdes,
    nama_desa,
    nama_kecamatan,
    unit_id,
    kode_unit,
    nama_unit,
    report_year,
    total_pendapatan,
    laba_rugi_bersih,
    total_aset,
    roe_percent,
    roi_percent,
    dashboard_health_score AS skor_kesehatan,
    dashboard_max_score AS skor_maksimal,
    dashboard_health_status,
    accounting_consistency_status
   FROM base b
  WHERE COALESCE(laba_rugi_bersih, 0::numeric) > 0::numeric AND COALESCE(total_aset, 0::numeric) > 0::numeric
  ORDER BY dashboard_health_score DESC, laba_rugi_bersih DESC, total_pendapatan DESC;

-- ---------- v_business_plan_budget_lines ----------

GRANT SELECT ON public.v_bupati_top_performing_bumdes TO authenticated;


