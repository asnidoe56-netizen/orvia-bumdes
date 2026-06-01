# Frontend vs Migration Gap Audit — ORVIA-BUMDES

Tanggal audit: 2026-06-02
Mode audit: compatible clean version

## Ringkasan

- Source files scanned: 192
- Migration files scanned: 29
- Frontend DB references found: 131
- Found in migrations: 117
- Missing from migrations: 14

## Missing From Migrations

| Type | Name | Reference Count | Files |
|---|---:|---:|---|
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_bupati_bumdes_priority_attention; ReferenceCount=1; FoundInMigrations=False; Files=src\app\bupati\dashboard\page.tsx}.Name) | 1 | src\app\bupati\dashboard\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_bupati_dashboard_summary; ReferenceCount=1; FoundInMigrations=False; Files=src\app\bupati\dashboard\page.tsx}.Name) | 1 | src\app\bupati\dashboard\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_bupati_kecamatan_performance; ReferenceCount=1; FoundInMigrations=False; Files=src\app\bupati\dashboard\page.tsx}.Name) | 1 | src\app\bupati\dashboard\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_bupati_top_performing_bumdes; ReferenceCount=1; FoundInMigrations=False; Files=src\app\bupati\dashboard\page.tsx}.Name) | 1 | src\app\bupati\dashboard\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_capital_expenditure_payables; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\catat-transaksi\_components\capital-debt-payment-entry-form.tsx}.Name) | 1 | src\app\unit\dashboard\catat-transaksi\_components\capital-debt-payment-entry-form.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_fixed_asset_depreciation_flow_audit; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\cek-alur-transaksi\page.tsx}.Name) | 1 | src\app\unit\dashboard\cek-alur-transaksi\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_fixed_asset_depreciation_summary; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\aset-tetap\page.tsx}.Name) | 1 | src\app\unit\dashboard\aset-tetap\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_journal_correction_eligible_entries; ReferenceCount=2; FoundInMigrations=False; Files=src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx; src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx}.Name) | 2 | src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx; src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_journal_correction_eligible_entry_lines; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx}.Name) | 1 | src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\new\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_journal_correction_flow; ReferenceCount=5; FoundInMigrations=False; Files=src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\bumdes\dashboard\koreksi-transaksi\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\page.tsx; src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx}.Name) | 5 | src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\bumdes\dashboard\koreksi-transaksi\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\page.tsx; src\app\unit\dashboard\catat-transaksi\koreksi-transaksi\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_journal_correction_governance_timeline; ReferenceCount=2; FoundInMigrations=False; Files=src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx}.Name) | 2 | src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_journal_correction_line_comparison; ReferenceCount=2; FoundInMigrations=False; Files=src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx}.Name) | 2 | src\app\bumdes\dashboard\koreksi-transaksi\[id]\page.tsx; src\app\pengawas\dashboard\koreksi-transaksi\[id]\page.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_purchase_invoice_payables; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\catat-transaksi\_components\supplier-payment-entry-form.tsx}.Name) | 1 | src\app\unit\dashboard\catat-transaksi\_components\supplier-payment-entry-form.tsx |
| TABLE_OR_VIEW | $(@{Type=TABLE_OR_VIEW; Name=v_unit_financial_health_scoring; ReferenceCount=1; FoundInMigrations=False; Files=src\app\unit\dashboard\reports\skoring\page.tsx}.Name) | 1 | src\app\unit\dashboard\reports\skoring\page.tsx |

## Catatan

- Audit ini hanya membandingkan referensi frontend dengan isi migration secara literal.
- public-content dikeluarkan dari hasil karena merupakan route/folder, bukan nama table/view database.
- Hasil missing belum otomatis berarti database rusak.
- Hasil missing adalah kandidat review untuk migration 000028.
- Jangan hapus atau ubah engine berdasarkan audit ini saja.
