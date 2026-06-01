# Migration 000028 Static Dependency Audit

Tanggal audit: 2026-06-02

## Summary

- Raw FROM/JOIN references: 43
- Ignored CTE aliases: 17
- Ignored table aliases: 56
- Refined referenced objects: 23
- Missing from migrations: 4

## Referenced Objects

| Object | Found In Migrations | Found In Files |
|---|---:|---|
| `accounting_periods` | true | 000006_accounting_period_journal_engine.sql |
| `business_units` | true | 000002_core_identity_tenant_unit.sql |
| `capital_disbursements` | true | 000022_business_plan_capital_engine.sql |
| `capital_expenditure_payments` | false |  |
| `capital_expenditures` | true | 000018_capital_expenditure_engine.sql |
| `chart_of_accounts` | true | 000005_chart_of_accounts_engine.sql |
| `fixed_asset_depreciations` | false |  |
| `fixed_assets` | true | 000018_capital_expenditure_engine.sql |
| `journal_correction_notes` | true | 000024_journal_correction_governance_engine.sql |
| `journal_corrections` | true | 000024_journal_correction_governance_engine.sql |
| `journal_entries` | true | 000006_accounting_period_journal_engine.sql |
| `journal_lines` | true | 000006_accounting_period_journal_engine.sql |
| `official` | false |  |
| `profiles` | true | 000002_core_identity_tenant_unit.sql |
| `purchase_invoice_payments` | true | 000014_purchase_invoice_engine.sql |
| `purchase_invoices` | true | 000014_purchase_invoice_engine.sql |
| `sales_invoices` | false |  |
| `suppliers` | true | 000011_supplier_customer_master_engine.sql |
| `tenants` | true | 000002_core_identity_tenant_unit.sql |
| `v_laba_rugi_summary` | true | 000023_financial_reporting_views.sql |
| `v_neraca_detail` | true | 000023_financial_reporting_views.sql |
| `v_neraca_summary` | true | 000023_financial_reporting_views.sql |
| `v_unit_financial_health_scoring` | true | 000028_frontend_gap_views.sql |

## Missing Objects

- `capital_expenditure_payments`
- `fixed_asset_depreciations`
- `official`
- `sales_invoices`