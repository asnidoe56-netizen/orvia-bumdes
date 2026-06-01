# Lovable Draft 000028 Target Audit

Tanggal audit: 2026-06-02

Tujuan: memeriksa apakah 14 view gap dan 2 kandidat purchase compatibility RPC tersedia di draft reverse-engineering Lovable dan/atau sudah ada di migration resmi.

| Object | Lovable Views | Lovable Functions | Official Migrations |
|---|---:|---:|---:|
| $(@{ObjectName=v_bupati_dashboard_summary; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_bupati_kecamatan_performance; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_bupati_bumdes_priority_attention; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_bupati_top_performing_bumdes; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_purchase_invoice_payables; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_capital_expenditure_payables; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_fixed_asset_depreciation_summary; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_fixed_asset_depreciation_flow_audit; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_journal_correction_eligible_entries; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_journal_correction_eligible_entry_lines; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_journal_correction_flow; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_journal_correction_governance_timeline; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_journal_correction_line_comparison; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=v_unit_financial_health_scoring; InLovableViews=True; InLovableFunctions=False; InOfficialMigrations=False}.ObjectName) | True | False | False |
| $(@{ObjectName=create_purchase_invoice; InLovableViews=False; InLovableFunctions=True; InOfficialMigrations=True}.ObjectName) | False | True | True |
| $(@{ObjectName=post_purchase_invoice; InLovableViews=False; InLovableFunctions=True; InOfficialMigrations=True}.ObjectName) | False | True | True |

## Catatan

- Jika object ada di Lovable tetapi belum ada di official migrations, object tersebut kandidat untuk migration 000028.
- Jika object sudah ada di official migrations, jangan dibuat ulang kecuali hanya CREATE OR REPLACE VIEW yang aman.
- Jangan mengambil seluruh 80_functions_triggers.sql atau 90_rls_policies_grants.sql ke migration resmi.
- Draft Lovable tetap artefak audit, bukan migration final.
