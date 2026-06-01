-- ============================================================
-- ORVIA-BUMDES DATABASE MIGRATION
-- File    : 000001_extensions_enums.sql
-- Purpose : Extensions and enum types baseline
-- Notes   : Baseline extracted from active development database.
-- ============================================================

begin;

-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- ENUM TYPES
-- ============================================================

do $$ begin
  create type public.account_type as enum (
    'ASET',
    'KEWAJIBAN',
    'EKUITAS',
    'PENDAPATAN',
    'HPP',
    'BEBAN'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.app_role as enum (
    'super_admin_platform',
    'direktur_bumdes',
    'admin_bumdes',
    'manager_unit',
    'operator_unit',
    'viewer_unit',
    'pendamping_kecamatan',
    'pengawas',
    'bupati'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.business_plan_review_result as enum (
    'needs_revision',
    'not_feasible',
    'ready_for_village_submission'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.business_plan_status as enum (
    'draft',
    'submitted_to_facilitator',
    'under_facilitator_review',
    'needs_revision',
    'not_feasible',
    'ready_for_village_submission',
    'submitted_to_village',
    'approved_by_village',
    'rejected_by_village',
    'disbursed',
    'allocated_to_unit',
    'closed',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.capital_disbursement_status as enum (
    'draft',
    'posted',
    'cancelled',
    'reversed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.coa_tipe as enum (
    'aset',
    'kewajiban',
    'ekuitas',
    'pendapatan',
    'beban'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.registration_status as enum (
    'pending',
    'approved',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_application_input_mode as enum (
    'self_service',
    'assisted_by_officer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_application_method as enum (
    'individual',
    'group'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_application_status as enum (
    'draft',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'cancelled',
    'disbursed',
    'partial_paid',
    'paid_off'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_application_verification_status as enum (
    'pending_verification',
    'verified',
    'needs_correction',
    'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_group_member_role as enum (
    'leader',
    'secretary',
    'treasurer',
    'member'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_group_status as enum (
    'active',
    'inactive',
    'suspended',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_interest_method as enum (
    'flat_total',
    'flat_monthly',
    'manual'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_member_status as enum (
    'active',
    'inactive',
    'suspended',
    'closed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.savings_loan_schedule_status as enum (
    'scheduled',
    'partially_paid',
    'paid',
    'overdue',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.tenant_status as enum (
    'pending',
    'active',
    'suspended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.unit_capital_allocation_status as enum (
    'draft',
    'posted',
    'cancelled',
    'reversed'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.unit_status as enum (
    'aktif',
    'nonaktif'
  );
exception when duplicate_object then null;
end $$;

commit;
