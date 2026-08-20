-- 01_extensions.sql
-- Extensions and shared enum types used across the entire schema.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";   -- fuzzy search on names

-- ── Enums ────────────────────────────────────────────────────────────────────

create type public.employment_status_enum as enum (
  'ACTIVE','ON_NOTICE','SUSPENDED','RESIGNED','TERMINATED','RETIRED','INACTIVE'
);

create type public.attendance_status_enum as enum (
  'PRESENT','ABSENT','HALF_DAY','LEAVE','HOLIDAY','WEEKLY_OFF',
  'LATE','WORK_FROM_HOME','ON_DUTY','MISSING_PUNCH'
);

create type public.leave_request_status_enum as enum (
  'DRAFT','PENDING','APPROVED','REJECTED','CANCELLED'
);

create type public.payroll_run_status_enum as enum (
  'DRAFT','CALCULATING','CALCULATED','HR_REVIEW','FINANCE_REVIEW',
  'APPROVED','LOCKED','PAID','CANCELLED'
);

create type public.asset_status_enum as enum (
  'AVAILABLE','ASSIGNED','UNDER_REPAIR','LOST','DAMAGED','RETIRED','DISPOSED'
);

create type public.approval_action_enum as enum ('APPROVED','REJECTED','ESCALATED');

create type public.notification_channel_enum as enum ('PUSH','EMAIL','SMS','IN_APP');

create type public.component_type_enum as enum ('EARNING','DEDUCTION','STATUTORY');
