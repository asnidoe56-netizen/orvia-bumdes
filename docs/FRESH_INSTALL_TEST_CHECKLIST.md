# ORVIA-BUMDES Fresh Install Test Checklist

Date: 2026-06-02  
Status: REQUIRED_BEFORE_FINAL_COMMERCIAL_READY

## Purpose

This checklist validates that ORVIA-BUMDES can be installed from source and migrations on a clean Supabase project/database without relying on historical development database state.

## Current Candidate Baseline

- Commercial status: COMMERCIAL_RELEASE_CANDIDATE_1
- Remote migration evidence: 000001 through 000034 aligned
- Local lint: PASS
- Local build: PASS
- Security/package cleanliness audit: PASS for RC1
- GitHub/Vercel push: not yet pushed after RC1 local commits

## Fresh Install Test Scope

### 1. Empty Database Migration Test

- Create clean Supabase project or isolated empty database branch.
- Connect local Supabase CLI to clean target.
- Run all migrations from 000001 to 000034.
- Confirm migration list shows local and remote aligned through 000034.
- Confirm no failed statements, missing functions, missing columns, invalid enum references, invalid grants, or RLS policy errors.

### 2. Core Schema Verification

Verify core objects exist:

- tenants
- profiles
- user_roles
- business_units
- unit_access_credentials
- permissions
- role_permissions
- accounting_periods
- chart_of_accounts
- journal_entries
- journal_lines
- audit_timeline
- cash_bank_accounts
- cash_bank_transactions
- equity_accounts
- equity_movements

### 3. Core Engine Verification

Verify required RPC/functions exist:

- get_user_login_context
- has_permission
- assert_user_has_permission
- provision_business_unit
- create_and_post_purchase_invoice
- create_and_post_sales_invoice
- create_and_post_revenue_receipt
- create_and_post_operational_expense
- create_and_post_capital_expenditure
- create_and_post_savings_loan_repayment
- generate_savings_loan_repayment_schedule

### 4. Reporting Views Verification

Verify report views exist:

- v_laba_rugi_summary
- v_laba_rugi_detail
- v_neraca_summary
- v_neraca_detail
- v_cash_flow_statement
- v_statement_of_changes_in_equity
- v_financial_dashboard_summary
- v_unit_financial_health_scoring

### 5. Frontend Build Verification

- Install dependencies.
- Configure .env.local using clean Supabase project values.
- Run npm run lint.
- Run npm run build.
- Confirm production build succeeds.

### 6. End-to-End Functional Smoke Test

Minimum smoke test:

- Register/login.
- Platform approves tenant registration.
- Create/provision BUMDes and business unit.
- Create accounting period.
- Provision COA.
- Create cash/bank account.
- Post purchase transaction.
- Post sales transaction.
- Post revenue receipt.
- Post operational expense.
- View financial reports.
- Create savings loan member.
- Submit savings loan application.
- Post savings loan disbursement.
- Post savings loan repayment.
- Confirm audit timeline and journal balance.

### 7. Security Verification

- Confirm no .env files are tracked.
- Confirm no service role key is committed.
- Confirm no Supabase access token is committed.
- Confirm no simulation tenant data is committed.
- Confirm public pages do not expose private operational data.

## Final Commercial Ready Rule

The project can be marked FINAL_COMMERCIAL_READY only after:

1. Fresh install migration test passes on empty database.
2. Production build passes after clean environment configuration.
3. End-to-end smoke test passes.
4. Security cleanup passes.
5. Installation and operator documentation are complete.
