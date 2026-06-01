# Migration 000028 Blueprint — Frontend Gap Views

Tanggal: 2026-06-02
Status: BLUEPRINT_ONLY_NOT_SQL

## Tujuan

Blueprint ini mencatat kandidat view yang perlu dipaketkan ke migration 000028 berdasarkan audit frontend vs migration 000001–000027.

Migration 000028 tidak boleh mengubah perilaku engine aktif. Isinya harus berupa view compatibility/reporting layer yang mendukung frontend existing.

## Kandidat View 000028

### 1. Dashboard Bupati / Executive Monitoring

- v_bupati_dashboard_summary
- v_bupati_kecamatan_performance
- v_bupati_bumdes_priority_attention
- v_bupati_top_performing_bumdes

Kebutuhan utama:

- Menyediakan agregasi lintas BUMDes/kecamatan.
- Mendukung order by skor_rata_rata.
- Mendukung order by skor_kesehatan.
- Aman sebagai read-only view.

Kolom penting dari frontend:

- report_year
- total_bumdes_terpantau
- total_unit_terpantau
- total_dana_tersalur
- total_aset
- total_pendapatan
- laba_rugi_bersih
- skor_kesehatan_rata_rata
- skor_maksimal_rata_rata
- total_sehat
- total_kurang_sehat
- total_tidak_sehat
- status_kesehatan_kabupaten
- aset_terhadap_dana_tersalur_percent
- produktivitas_dana_percent
- nama_kecamatan
- total_bumdes
- total_unit
- skor_rata_rata
- kode_bumdes
- nama_bumdes
- nama_desa
- nama_unit
- kas_setara_kas
- skor_kesehatan
- skor_maksimal
- dashboard_health_status
- accounting_consistency_status
- masalah_utama
- roe_percent
- roi_percent

### 2. Payable Helper Views

- v_purchase_invoice_payables
- v_capital_expenditure_payables

Kebutuhan utama:

- Dipakai oleh form pembayaran utang supplier dan pelunasan utang belanja modal.
- Harus mendukung filter tenant_id, unit_id, outstanding_amount > 0.
- Harus mendukung order by invoice_date / transaction_date.

Kolom penting:

- tenant_id
- unit_id
- purchase_invoice_id
- capital_expenditure_id
- invoice_no
- transaction_no
- supplier_name
- invoice_date
- transaction_date
- due_date
- total_amount
- payment_amount
- outstanding_amount
- payable_status

### 3. Fixed Asset Depreciation Reporting Views

- v_fixed_asset_depreciation_summary
- v_fixed_asset_depreciation_flow_audit

Kebutuhan utama:

- Mendukung halaman aset tetap dan cek alur transaksi.
- Harus read-only.
- Tidak boleh membuat posting depresiasi baru jika engine aktif belum memakai tabel depresiasi.

Catatan:

- Jika tabel depresiasi aktif belum ada di migration/database, view harus dibuat sebagai safe compatibility view berbasis fixed_assets dan journal/cash/audit yang tersedia, atau ditunda sampai bukti DB aktif lengkap.

### 4. Journal Correction Frontend Views

- v_journal_correction_eligible_entries
- v_journal_correction_eligible_entry_lines
- v_journal_correction_flow
- v_journal_correction_governance_timeline
- v_journal_correction_line_comparison

Kebutuhan utama:

- Dipakai halaman koreksi transaksi BUMDes, Unit, dan Pengawas.
- Harus mendukung daftar jurnal yang layak dikoreksi.
- Harus mendukung detail flow koreksi, timeline governance, dan perbandingan line jurnal.
- Tidak boleh membuka mutasi langsung ke posted journal.

Catatan:

- View harus dibangun dari journal_entries, journal_lines, journal_corrections, journal_correction_notes, audit_timeline, tenants, business_units, dan chart_of_accounts sesuai struktur migration yang sudah ada.

### 5. Unit Financial Health Scoring

- v_unit_financial_health_scoring

Kebutuhan utama:

- Dipakai halaman laporan skoring unit.
- Harus berbasis reporting views yang sudah ada: laba rugi, neraca, arus kas, dashboard summary.
- Read-only.

## Prinsip Pembuatan SQL 000028

1. Jangan ubah tabel transaksi yang sudah proven.
2. Jangan rename kolom/tabel existing.
3. Jangan drop function/view existing.
4. Buat view compatibility/reporting layer saja.
5. Gunakan create or replace view.
6. Grant select ke authenticated.
7. Jika perlu anon/public, harus diaudit terpisah; default jangan buka anon.
8. Setelah SQL dibuat, wajib npm run lint dan npm run build.
9. Belum FINAL_READY sampai fresh install test database kosong berhasil.

## Status

READY_FOR_SQL_DRAFT_000028_AFTER_COLUMN_REVIEW

