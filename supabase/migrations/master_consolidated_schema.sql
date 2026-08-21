-- ==============================================================================
-- LOAN ON TIP HRMS & ASSET MANAGEMENT — MASTER CONSOLIDATED DATABASE SCHEMA
-- ==============================================================================
-- Purpose: Complete, idempotent, single-file schema migration.
-- Safe to run on both fresh and existing databases (does NOT drop table data).
-- ==============================================================================

-- ── 1. EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ── 2. ENUMS (Safe creation & value additions) ────────────────────────────────
do $$ begin
  create type public.employment_status_enum as enum ('ACTIVE','ON_NOTICE','SUSPENDED','RESIGNED','TERMINATED','RETIRED','INACTIVE','EXITED');
exception when duplicate_object then
  alter type public.employment_status_enum add value if not exists 'ACTIVE';
  alter type public.employment_status_enum add value if not exists 'ON_NOTICE';
  alter type public.employment_status_enum add value if not exists 'EXITED';
end $$;

do $$ begin
  create type public.attendance_status_enum as enum ('PRESENT','ABSENT','HALF_DAY','LEAVE','HOLIDAY','WEEKLY_OFF','LATE','WORK_FROM_HOME','ON_DUTY','MISSING_PUNCH','ON_LEAVE');
exception when duplicate_object then
  alter type public.attendance_status_enum add value if not exists 'ON_LEAVE';
  alter type public.attendance_status_enum add value if not exists 'HOLIDAY';
  alter type public.attendance_status_enum add value if not exists 'WEEKLY_OFF';
end $$;

do $$ begin
  create type public.leave_request_status_enum as enum ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payroll_run_status_enum as enum ('DRAFT','CALCULATING','CALCULATED','HR_REVIEW','FINANCE_REVIEW','APPROVED','LOCKED','PAID','CANCELLED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_status_enum as enum ('AVAILABLE','ASSIGNED','UNDER_REPAIR','LOST','DAMAGED','RETIRED','DISPOSED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.approval_action_enum as enum ('APPROVED','REJECTED','ESCALATED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.notification_channel_enum as enum ('PUSH','EMAIL','SMS','IN_APP');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.component_type_enum as enum ('EARNING','DEDUCTION','STATUTORY');
exception when duplicate_object then null; end $$;

-- ── 3. SEQUENCES ──────────────────────────────────────────────────────────────
create sequence if not exists public.employee_code_seq start 1;
create sequence if not exists public.asset_code_seq start 1;
create sequence if not exists public.payslip_number_seq start 1;

-- ── 4. HELPER FUNCTIONS (For auth & triggers) ─────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_employee_code()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null then
    new.employee_code := 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

-- ── 5. CORE COMPANY & ORGANIZATION TABLES ─────────────────────────────────────
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  legal_name          varchar(255) not null,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- Safe column additions on companies
alter table public.companies add column if not exists company_code varchar(20) not null default 'LOT-01';
alter table public.companies add column if not exists display_name varchar(255) default 'Loan On Tip';
alter table public.companies add column if not exists trade_name varchar(255) default 'Loan On Tip';
alter table public.companies add column if not exists registration_number varchar(100);
alter table public.companies add column if not exists tax_id varchar(50);
alter table public.companies add column if not exists gstin varchar(20);
alter table public.companies add column if not exists pan varchar(20);
alter table public.companies add column if not exists logo_url text;
alter table public.companies add column if not exists country varchar(100) default 'India';
alter table public.companies add column if not exists timezone varchar(100) default 'Asia/Kolkata';
alter table public.companies add column if not exists currency varchar(10) default 'INR';
alter table public.companies add column if not exists is_active boolean default true;

create table if not exists public.departments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  department_code  varchar(20)  not null,
  name             varchar(100) not null,
  parent_id        uuid references public.departments on delete set null,
  head_employee_id uuid,
  is_active        boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create table if not exists public.designations (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  designation_code varchar(20)  not null,
  name             varchar(100) not null,
  level            integer,
  is_active        boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create table if not exists public.locations (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies on delete cascade,
  location_code            varchar(20)  not null,
  name                     varchar(100) not null,
  address_line1            text,
  address_line2            text,
  city                     varchar(100),
  state                    varchar(100),
  country                  varchar(100) default 'India',
  pincode                  varchar(20),
  latitude                 numeric(9,6),
  longitude                numeric(9,6),
  attendance_radius_meters integer      not null default 150,
  is_active                boolean      not null default true,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now()
);

create table if not exists public.employment_types (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name       varchar(50) not null,
  code       varchar(20) not null,
  is_active  boolean     not null default true
);

create table if not exists public.teams (
  id                  uuid primary key default gen_random_uuid(),
  department_id       uuid not null references public.departments on delete cascade,
  name                varchar(100) not null,
  manager_employee_id uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  shift_code    varchar(20)  not null,
  name          varchar(100) not null,
  start_time    time         not null,
  end_time      time         not null,
  grace_minutes integer      not null default 15,
  is_night_shift boolean     not null default false,
  is_active     boolean      not null default true,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- ── 6. EMPLOYEES & SATELLITE PEOPLE TABLES ────────────────────────────────────
create table if not exists public.employees (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies on delete cascade,
  first_name         varchar(100) not null,
  last_name          varchar(100) not null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

-- Add all possible missing columns on existing employees table
alter table public.employees add column if not exists employee_code varchar(20);

-- Auto-generate employee_code on insert if not provided
create or replace trigger trg_employees_set_code
  before insert on public.employees
  for each row execute function public.set_employee_code();

alter table public.employees add column if not exists middle_name varchar(100);
alter table public.employees add column if not exists gender varchar(20);
alter table public.employees add column if not exists date_of_birth date;
alter table public.employees add column if not exists blood_group varchar(10);
alter table public.employees add column if not exists profile_photo_url text;
alter table public.employees add column if not exists joining_date date default current_date;
alter table public.employees add column if not exists confirmation_date date;
alter table public.employees add column if not exists employment_type_id uuid references public.employment_types on delete set null;
alter table public.employees add column if not exists department_id uuid references public.departments on delete set null;
alter table public.employees add column if not exists designation_id uuid references public.designations on delete set null;
alter table public.employees add column if not exists team_id uuid references public.teams on delete set null;
alter table public.employees add column if not exists location_id uuid references public.locations on delete set null;
alter table public.employees add column if not exists manager_id uuid references public.employees on delete set null;
alter table public.employees add column if not exists hr_manager_id uuid references public.employees on delete set null;
alter table public.employees add column if not exists employment_status public.employment_status_enum default 'ACTIVE';
alter table public.employees add column if not exists probation_end_date date;
alter table public.employees add column if not exists notice_period_days integer;
alter table public.employees add column if not exists last_working_date date;
alter table public.employees add column if not exists official_email varchar(255);
alter table public.employees add column if not exists personal_email varchar(255);
alter table public.employees add column if not exists official_mobile varchar(20);
alter table public.employees add column if not exists personal_mobile varchar(20);
alter table public.employees add column if not exists nationality varchar(100) default 'Indian';
alter table public.employees add column if not exists marital_status varchar(30);

-- Safe generated display_name
do $$ begin
  alter table public.employees add column display_name varchar(255) generated always as (
    trim(first_name || ' ' || coalesce(middle_name || ' ', '') || last_name)
  ) stored;
exception when duplicate_column then null; end $$;

create table if not exists public.profiles (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique not null,
  company_id   uuid not null references public.companies on delete cascade,
  employee_id  uuid references public.employees on delete set null,
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.shift_assignments (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  shift_id       uuid not null references public.shifts    on delete cascade,
  effective_from date        not null default current_date,
  effective_to   date,
  is_current     boolean     not null default true,
  assigned_by    uuid references public.employees on delete set null,
  created_at     timestamptz not null default now()
);

create table if not exists public.employee_bank_accounts (
  id                       uuid primary key default gen_random_uuid(),
  employee_id              uuid not null references public.employees on delete cascade,
  account_holder_name      varchar(255) not null,
  bank_name                varchar(255) not null,
  account_number_encrypted text         not null,
  account_number_last4     varchar(4)   not null,
  ifsc_code                varchar(20)  not null,
  branch_name              varchar(255),
  account_type             varchar(30)  not null default 'SAVINGS',
  is_primary               boolean      not null default true,
  is_verified              boolean      not null default false,
  verified_at              timestamptz,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now()
);

create table if not exists public.employee_statutory_details (
  id                      uuid primary key default gen_random_uuid(),
  employee_id             uuid unique not null references public.employees on delete cascade,
  pan_encrypted           text,
  pan_last4               varchar(4),
  uan                     varchar(30),
  pf_number               varchar(30),
  esi_number              varchar(30),
  professional_tax_number varchar(30),
  aadhaar_last4           varchar(4),
  tax_regime              varchar(10) default 'NEW',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table if not exists public.employee_contacts (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees on delete cascade,
  contact_type  varchar(30) not null,
  contact_name  varchar(255),
  relationship  varchar(50),
  mobile        varchar(20),
  email         varchar(255),
  is_primary    boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.employee_emergency_contacts (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees on delete cascade,
  name             varchar(255) not null,
  relationship     varchar(50),
  mobile           varchar(20)  not null,
  alternate_mobile varchar(20),
  address          text,
  is_primary       boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ── 7. ATTENDANCE TABLES ──────────────────────────────────────────────────────
create table if not exists public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees  on delete cascade,
  company_id           uuid not null references public.companies  on delete cascade,
  attendance_date      date not null default current_date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.attendance add column if not exists location_id uuid references public.locations on delete set null;
alter table public.attendance add column if not exists shift_id uuid references public.shifts on delete set null;
alter table public.attendance add column if not exists check_in_at timestamptz;
alter table public.attendance add column if not exists check_out_at timestamptz;
alter table public.attendance add column if not exists check_in_latitude numeric(9,6);
alter table public.attendance add column if not exists check_in_longitude numeric(9,6);
alter table public.attendance add column if not exists check_in_accuracy numeric(8,2);
alter table public.attendance add column if not exists check_out_latitude numeric(9,6);
alter table public.attendance add column if not exists check_out_longitude numeric(9,6);
alter table public.attendance add column if not exists check_out_accuracy numeric(8,2);
alter table public.attendance add column if not exists worked_minutes integer not null default 0;
alter table public.attendance add column if not exists late_minutes integer not null default 0;
alter table public.attendance add column if not exists status public.attendance_status_enum not null default 'ABSENT';
alter table public.attendance add column if not exists source varchar(30) not null default 'MOBILE';
alter table public.attendance add column if not exists is_manual_adjustment boolean not null default false;
alter table public.attendance add column if not exists adjustment_reason text;
alter table public.attendance add column if not exists approved_by uuid references public.employees on delete set null;
alter table public.attendance add column if not exists approved_at timestamptz;

create table if not exists public.attendance_exceptions (
  id              uuid primary key default gen_random_uuid(),
  attendance_id   uuid references public.attendance on delete cascade,
  employee_id     uuid not null references public.employees  on delete cascade,
  exception_type  varchar(50) not null,
  description     text,
  severity        varchar(20) not null default 'LOW',
  status          varchar(20) not null default 'OPEN',
  raised_at       timestamptz not null default now(),
  resolved_by     uuid references public.employees on delete set null,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.attendance_adjustments (
  id            uuid primary key default gen_random_uuid(),
  attendance_id uuid not null references public.attendance on delete cascade,
  requested_by  uuid not null references public.employees on delete cascade,
  approved_by   uuid references public.employees on delete set null,
  old_values    jsonb not null,
  new_values    jsonb not null,
  reason        text  not null,
  status        varchar(20) not null default 'PENDING',
  created_at    timestamptz not null default now(),
  approved_at   timestamptz
);

-- ── 8. LEAVE MANAGEMENT TABLES ────────────────────────────────────────────────
create table if not exists public.leave_types (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies on delete cascade,
  code              varchar(20)  not null,
  name              varchar(100) not null,
  is_paid           boolean      not null default true,
  allows_half_day   boolean      not null default true,
  requires_document boolean      not null default false,
  is_active         boolean      not null default true
);

create table if not exists public.leave_balances (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees  on delete cascade,
  leave_type_id   uuid not null references public.leave_types on delete cascade,
  year            smallint not null default date_part('year', current_date)::smallint,
  opening_balance numeric(5,2) not null default 0,
  accrued         numeric(5,2) not null default 0,
  used            numeric(5,2) not null default 0,
  closing_balance numeric(5,2) not null default 0,
  updated_at      timestamptz  not null default now()
);

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees  on delete cascade,
  leave_type_id uuid not null references public.leave_types on delete restrict,
  from_date     date         not null,
  to_date       date         not null,
  total_days    numeric(4,1) not null default 1,
  reason        text,
  status        varchar(20)  not null default 'PENDING',
  submitted_at  timestamptz  not null default now(),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

create table if not exists public.leave_approvals (
  id               uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests on delete cascade,
  approver_id      uuid not null references public.employees      on delete cascade,
  approval_level   smallint    not null default 1,
  action           public.approval_action_enum not null default 'APPROVED',
  comments         text,
  acted_at         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- ── 9. PAYROLL TABLES ─────────────────────────────────────────────────────────
create table if not exists public.salary_components (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  code             varchar(30)  not null,
  name             varchar(100) not null,
  component_type   public.component_type_enum not null default 'EARNING',
  calculation_type varchar(30)  not null default 'FIXED',
  is_taxable       boolean      not null default false,
  is_statutory     boolean      not null default false,
  is_active        boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create table if not exists public.salary_structures (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  name           varchar(255) not null,
  description    text,
  effective_from date         not null default current_date,
  is_active      boolean      not null default true,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

create table if not exists public.employee_salary_assignments (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees on delete cascade,
  salary_structure_id uuid references public.salary_structures on delete set null,
  annual_ctc          numeric(14,2) not null default 0,
  monthly_ctc         numeric(14,2) generated always as (annual_ctc / 12) stored,
  effective_from      date          not null default current_date,
  effective_to        date,
  is_current          boolean       not null default true,
  approved_by         uuid references public.employees on delete set null,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);

create table if not exists public.payroll_runs (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  payroll_month    smallint not null check (payroll_month between 1 and 12),
  payroll_year     smallint not null,
  period_start     date     not null,
  period_end       date     not null,
  status           public.payroll_run_status_enum not null default 'DRAFT',
  employee_count   integer  not null default 0,
  gross_pay        numeric(16,2) not null default 0,
  total_deductions numeric(16,2) not null default 0,
  net_pay          numeric(16,2) not null default 0,
  created_by       uuid references public.employees on delete set null,
  approved_by      uuid references public.employees on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.payroll_items (
  id                    uuid primary key default gen_random_uuid(),
  payroll_run_id        uuid not null references public.payroll_runs on delete cascade,
  employee_id           uuid not null references public.employees     on delete cascade,
  working_days          integer      not null default 0,
  paid_days             numeric(5,2) not null default 0,
  leave_days            numeric(5,2) not null default 0,
  lop_days              numeric(5,2) not null default 0,
  absent_days           integer      not null default 0,
  gross_salary          numeric(14,2) not null default 0,
  total_earnings        numeric(14,2) not null default 0,
  total_deductions      numeric(14,2) not null default 0,
  net_salary            numeric(14,2) not null default 0,
  employee_contribution numeric(14,2) not null default 0,
  taxable_income        numeric(14,2) not null default 0,
  status                varchar(20)   not null default 'DRAFT',
  created_at            timestamptz   not null default now(),
  updated_at            timestamptz   not null default now()
);

create table if not exists public.payslips (
  id               uuid primary key default gen_random_uuid(),
  payroll_item_id  uuid not null references public.payroll_items on delete cascade,
  employee_id      uuid not null references public.employees      on delete cascade,
  payroll_run_id   uuid not null references public.payroll_runs   on delete cascade,
  payslip_number   varchar(30) not null
                     default ('PAY-' || to_char(now(), 'YYYY-MM') || '-' ||
                              lpad(nextval('public.payslip_number_seq')::text, 4, '0')),
  gross_salary     numeric(14,2) not null default 0,
  deductions       numeric(14,2) not null default 0,
  net_salary       numeric(14,2) not null default 0,
  payslip_json     jsonb         not null default '{}',
  pdf_storage_path text,
  generated_at     timestamptz,
  created_at       timestamptz   not null default now()
);


-- ── 10. ASSET MANAGEMENT & LIFECYCLE TABLES ───────────────────────────────────
create table if not exists public.asset_categories (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  code       varchar(30)  not null,
  name       varchar(100) not null,
  prefix     varchar(10)  not null default 'AST',
  is_active  boolean      not null default true
);

create table if not exists public.asset_brands (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name       varchar(100) not null,
  is_active  boolean      not null default true,
  created_at timestamptz  not null default now()
);

create table if not exists public.assets (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies on delete cascade,
  asset_code          varchar(30) not null unique,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.assets add column if not exists location_id uuid references public.locations on delete set null;
alter table public.assets add column if not exists asset_category_id uuid references public.asset_categories on delete restrict;
alter table public.assets add column if not exists brand_id uuid references public.asset_brands on delete set null;
alter table public.assets add column if not exists asset_tag varchar(100);
alter table public.assets add column if not exists model varchar(255);
alter table public.assets add column if not exists serial_number varchar(255);
alter table public.assets add column if not exists imei_1 varchar(20);
alter table public.assets add column if not exists imei_2 varchar(20);
alter table public.assets add column if not exists mobile_number varchar(20);
alter table public.assets add column if not exists sim_number varchar(30);
alter table public.assets add column if not exists purchase_date date;
alter table public.assets add column if not exists purchase_cost numeric(14,2);
alter table public.assets add column if not exists warranty_start date;
alter table public.assets add column if not exists warranty_end date;
alter table public.assets add column if not exists condition varchar(30) default 'GOOD';
alter table public.assets add column if not exists status public.asset_status_enum default 'AVAILABLE';
alter table public.assets add column if not exists current_employee_id uuid references public.employees on delete set null;
alter table public.assets add column if not exists vendor_name varchar(255);
alter table public.assets add column if not exists invoice_number varchar(100);
alter table public.assets add column if not exists notes text;

create table if not exists public.asset_assignments (
  id                   uuid primary key default gen_random_uuid(),
  asset_id             uuid not null references public.assets    on delete cascade,
  employee_id          uuid not null references public.employees on delete cascade,
  assigned_at          timestamptz  not null default now(),
  assigned_by          uuid references public.employees on delete set null,
  expected_return_date date,
  returned_at          timestamptz,
  status               varchar(20)  not null default 'ACTIVE',
  remarks              text,
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

create table if not exists public.asset_handover (
  id                      uuid primary key default gen_random_uuid(),
  asset_assignment_id     uuid not null references public.asset_assignments on delete cascade,
  handover_date           date         not null default current_date,
  employee_acknowledged   boolean      not null default false,
  employee_signature_path text,
  handover_document_path  text,
  condition_at_handover   varchar(30),
  remarks                 text,
  created_at              timestamptz  not null default now()
);

create table if not exists public.asset_returns (
  id                  uuid primary key default gen_random_uuid(),
  asset_assignment_id uuid not null references public.asset_assignments on delete cascade,
  return_date         date         not null default current_date,
  received_by         uuid references public.employees on delete set null,
  condition_at_return varchar(30),
  damage_description  text,
  missing_items       text,
  recovery_amount     numeric(12,2),
  remarks             text,
  created_at          timestamptz  not null default now()
);

create table if not exists public.asset_maintenance (
  id               uuid primary key default gen_random_uuid(),
  asset_id         uuid not null references public.assets on delete cascade,
  maintenance_type varchar(50)   not null,
  vendor           varchar(255),
  started_at       timestamptz,
  completed_at     timestamptz,
  cost             numeric(12,2),
  description      text,
  status           varchar(20)   not null default 'OPEN',
  created_by       uuid references public.employees on delete set null,
  created_at       timestamptz   not null default now()
);

-- ── 11. DOCUMENTS, NOTIFICATIONS & AUDIT TABLES ───────────────────────────────
create table if not exists public.document_types (
  id         uuid primary key default gen_random_uuid(),
  code       varchar(30)  not null unique,
  name       varchar(100) not null,
  is_active  boolean      not null default true
);

create table if not exists public.employee_documents (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees on delete cascade,
  document_type_id uuid not null references public.document_types on delete restrict,
  file_name        varchar(255) not null,
  storage_path     text         not null,
  status           varchar(20)  not null default 'ACTIVE',
  issue_date       date,
  expiry_date      date,
  uploaded_by      uuid references public.employees on delete set null,
  verified_by      uuid references public.employees on delete set null,
  verified_at      timestamptz,
  created_at       timestamptz  not null default now()
);

create table if not exists public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_employee_id uuid not null references public.employees on delete cascade,
  channel               public.notification_channel_enum not null default 'IN_APP',
  title                 varchar(255) not null,
  body                  text         not null,
  is_read               boolean      not null default false,
  read_at               timestamptz,
  created_at            timestamptz  not null default now()
);

create table if not exists public.audit_logs (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid references public.companies on delete set null,
  actor_employee_id  uuid references public.employees on delete set null,
  actor_auth_user_id uuid,
  action             varchar(100) not null,
  entity_type        varchar(50)  not null,
  entity_id          varchar(100),
  old_values         jsonb,
  new_values         jsonb,
  request_id         uuid,
  created_at         timestamptz  not null default now()
);

create table if not exists public.idempotency_keys (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees on delete cascade,
  idempotency_key varchar(255) not null,
  endpoint        varchar(255) not null,
  response_status integer      not null,
  response_body   jsonb        not null,
  created_at      timestamptz  not null default now()
);

-- ── 12. LIFECYCLE TABLES (Expenses, Helpdesk, Resignations, Holidays) ─────────
create table if not exists public.expenses (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies  on delete cascade,
  employee_id      uuid not null references public.employees  on delete cascade,
  expense_date     date         not null default current_date,
  category         varchar(50)  not null default 'OTHER',
  description      text         not null,
  amount           numeric(12,2) not null,
  receipt_path     text,
  status           varchar(20)  not null default 'PENDING',
  submitted_at     timestamptz  not null default now(),
  approved_by      uuid references public.employees on delete set null,
  approved_at      timestamptz,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

create table if not exists public.helpdesk_tickets (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  employee_id   uuid not null references public.employees on delete cascade,
  category      varchar(30) not null default 'HR',
  subject       varchar(255) not null,
  description   text,
  priority      varchar(10) not null default 'NORMAL',
  status        varchar(20) not null default 'OPEN',
  assigned_to   uuid references public.employees on delete set null,
  resolved_at   timestamptz,
  resolution    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.resignations (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null references public.companies on delete cascade,
  employee_id        uuid not null references public.employees on delete cascade,
  resignation_date   date         not null default current_date,
  last_working_date  date,
  reason             text,
  status             varchar(30)  not null default 'SUBMITTED',
  it_cleared         boolean      not null default false,
  it_cleared_by      uuid references public.employees on delete set null,
  it_cleared_at      timestamptz,
  finance_cleared    boolean      not null default false,
  finance_cleared_by uuid references public.employees on delete set null,
  finance_cleared_at timestamptz,
  hr_cleared         boolean      not null default false,
  hr_cleared_by      uuid references public.employees on delete set null,
  hr_cleared_at      timestamptz,
  ff_amount          numeric(14,2),
  ff_notes           text,
  approved_by        uuid references public.employees on delete set null,
  approved_at        timestamptz,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now()
);

create table if not exists public.holidays (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies on delete cascade,
  location_id  uuid references public.locations on delete cascade,
  name         varchar(255) not null,
  holiday_date date         not null,
  is_optional  boolean      not null default false,
  description  text,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

alter table public.holidays add column if not exists holiday_type varchar(50) default 'NATIONAL';

-- ── 13. ROLES & PERMISSIONS TABLES ────────────────────────────────────────────
create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(50)  not null unique,
  name        varchar(100) not null,
  description text,
  is_system   boolean      not null default false
);

create table if not exists public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(50)  not null unique,
  name        varchar(100) not null,
  module      varchar(50)  not null
);

create table if not exists public.employee_roles (
  id          uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees on delete cascade,
  role_id     uuid not null references public.roles     on delete cascade,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references public.roles       on delete cascade,
  permission_id uuid not null references public.permissions on delete cascade
);

-- ── 14. AUTH HELPER FUNCTIONS (Postgres RLS Security Definers) ────────────────
create or replace function public.auth_employee_id()
returns uuid language sql stable security definer as $$
  select employee_id from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.auth_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_permission(p_code text)
returns boolean language sql stable security definer as $$
  select exists (
    select 1
    from public.employee_roles er
    join public.role_permissions rp on rp.role_id = er.role_id
    join public.permissions p       on p.id = rp.permission_id
    where er.employee_id = public.auth_employee_id()
      and er.is_active   = true
      and p.code         = p_code
  );
$$;

-- ── 15. ALL APPLICATION VIEWS (Drop existing first to allow clean type sync) ──

drop view if exists public.v_today_attendance cascade;
drop view if exists public.v_attendance cascade;
drop view if exists public.v_employee_directory cascade;
drop view if exists public.v_employee_profile cascade;
drop view if exists public.v_pending_leave_approvals cascade;
drop view if exists public.v_asset_inventory cascade;
drop view if exists public.v_asset_maintenance cascade;
drop view if exists public.v_dashboard_metrics cascade;
drop view if exists public.v_department_headcount cascade;

-- View: Employee Directory (Full staff view)
create view public.v_employee_directory as
select
  e.id,
  e.company_id,
  e.employee_code,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as display_name,
  e.first_name,
  e.last_name,
  e.gender,
  e.date_of_birth,
  e.blood_group,
  e.joining_date,
  e.employment_status,
  e.official_email,
  e.official_mobile,
  d.name  as department,
  dg.name as designation,
  l.name  as location,
  et.name as employment_type,
  m.first_name as manager_name,
  e.created_at,
  e.updated_at
from public.employees e
left join public.departments    d  on d.id  = e.department_id
left join public.designations   dg on dg.id = e.designation_id
left join public.locations      l  on l.id  = e.location_id
left join public.employment_types et on et.id = e.employment_type_id
left join public.employees      m  on m.id  = e.manager_id;

-- View: Employee Profile Details
create view public.v_employee_profile as
select
  e.id, e.company_id, e.employee_code,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as display_name,
  e.first_name, e.middle_name, e.last_name,
  e.gender, e.date_of_birth, e.blood_group, e.profile_photo_url,
  e.official_email, e.personal_email, e.official_mobile, e.personal_mobile,
  e.joining_date, e.confirmation_date, e.probation_end_date,
  e.notice_period_days, e.last_working_date,
  e.employment_status, e.nationality, e.marital_status,
  d.name  as department,  d.id as department_id,
  dg.name as designation, dg.id as designation_id,
  l.name  as location,    l.id as location_id,
  et.name as employment_type, et.id as employment_type_id,
  m.first_name as manager_name, m.id as manager_id,
  m.official_email as manager_email,
  hr.first_name as hr_manager_name, hr.id as hr_manager_id,
  e.created_at, e.updated_at
from public.employees e
left join public.departments    d  on d.id  = e.department_id
left join public.designations   dg on dg.id = e.designation_id
left join public.locations      l  on l.id  = e.location_id
left join public.employment_types et on et.id = e.employment_type_id
left join public.employees      m  on m.id  = e.manager_id
left join public.employees      hr on hr.id = e.hr_manager_id;

-- View: Attendance & Logs
create view public.v_attendance as
select
  a.id, a.employee_id,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as display_name,
  e.employee_code,
  d.name  as department,
  l.name  as location,
  a.attendance_date, a.status,
  a.check_in_at, a.check_out_at,
  a.worked_minutes, a.late_minutes,
  a.company_id
from public.attendance a
join public.employees e on e.id = a.employee_id
left join public.locations   l on l.id = a.location_id
left join public.departments d on d.id = e.department_id;

create view public.v_today_attendance as
select * from public.v_attendance where attendance_date = current_date;

-- View: Pending Leave Approvals
create view public.v_pending_leave_approvals as
select
  lr.id,
  lr.id as leave_request_id,
  lr.employee_id,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as display_name,
  e.employee_code,
  e.manager_id,
  lt.name as leave_type,
  lr.from_date,
  lr.to_date,
  lr.total_days,
  lr.reason,
  lr.status,
  lr.submitted_at
from public.leave_requests lr
join public.employees  e  on e.id  = lr.employee_id
join public.leave_types lt on lt.id = lr.leave_type_id
where lr.status::text = 'PENDING';

-- View: Asset Inventory
create view public.v_asset_inventory as
select
  a.id,
  a.company_id,
  a.asset_code,
  a.asset_tag,
  a.asset_category_id,
  ac.name as category,
  ac.prefix as category_prefix,
  a.brand_id,
  ab.name as brand,
  a.model,
  a.serial_number,
  a.imei_1,
  a.imei_2,
  a.mobile_number,
  a.sim_number,
  a.purchase_date,
  a.purchase_cost,
  a.warranty_start,
  a.warranty_end,
  a.condition,
  a.status,
  a.current_employee_id,
  coalesce(e.display_name, trim(e.first_name || ' ' || e.last_name))::varchar(255) as assigned_to,
  e.employee_code as assigned_employee_code,
  e.official_email as assigned_employee_email,
  a.location_id,
  l.name as location,
  a.vendor_name,
  a.invoice_number,
  a.notes,
  a.created_at,
  a.updated_at
from public.assets a
left join public.asset_categories ac on ac.id = a.asset_category_id
left join public.asset_brands     ab on ab.id = a.brand_id
left join public.employees        e  on e.id  = a.current_employee_id
left join public.locations        l  on l.id  = a.location_id;

-- View: Asset Maintenance
create view public.v_asset_maintenance as
select
  m.id,
  m.asset_id,
  a.asset_code,
  a.model,
  a.company_id,
  ac.name as category,
  m.maintenance_type,
  m.vendor,
  m.started_at,
  m.completed_at,
  m.cost,
  m.description,
  m.status,
  m.created_by,
  coalesce(cb.display_name, trim(cb.first_name || ' ' || cb.last_name))::varchar(255) as created_by_name,
  m.created_at
from public.asset_maintenance m
join public.assets a on a.id = m.asset_id
left join public.asset_categories ac on ac.id = a.asset_category_id
left join public.employees cb on cb.id = m.created_by;

-- View: Dashboard Operational Metrics (Safe cast ::text for enum filters)
create view public.v_dashboard_metrics as
select
  c.id as company_id,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'ACTIVE')  as active_employees,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'INACTIVE') as inactive_employees,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status::text in ('PRESENT','LATE')) as present_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status::text = 'ABSENT') as absent_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status::text = 'LATE') as late_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status::text = 'HALF_DAY') as half_day_today,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status::text = 'ON_LEAVE') as on_leave_today,
  (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id where e.company_id = c.id and lr.status::text = 'PENDING') as pending_leaves,
  (select count(*) from public.attendance_adjustments aa join public.attendance a on a.id = aa.attendance_id where a.company_id = c.id and aa.status::text = 'PENDING') as pending_corrections,
  (select count(*) from public.attendance_exceptions ae join public.attendance a on a.id = ae.attendance_id where a.company_id = c.id and ae.status::text = 'OPEN') as open_exceptions,
  (select count(*) from public.assets where company_id = c.id and status::text = 'AVAILABLE') as available_assets,
  (select count(*) from public.assets where company_id = c.id and status::text = 'ASSIGNED') as assigned_assets,
  (select count(*) from public.employees where company_id = c.id and joining_date >= current_date - interval '30 days' and employment_status::text = 'ACTIVE') as new_joiners_30d,
  (select count(*) from public.employees where company_id = c.id and employment_status::text = 'ON_NOTICE') as on_notice,
  (select count(*) from public.payroll_runs where company_id = c.id and status::text = 'DRAFT') as draft_payroll_runs,
  (select count(*) from public.payroll_runs where company_id = c.id and status::text = 'CALCULATED') as pending_payroll_approvals
from public.companies c;

-- View: Department Headcount
create view public.v_department_headcount as
select
  d.id as department_id,
  d.company_id,
  d.name as department,
  count(e.id) filter (where e.employment_status::text = 'ACTIVE')    as active_count,
  count(e.id) filter (where e.employment_status::text = 'ON_NOTICE') as notice_count,
  count(e.id)                                                         as total_count
from public.departments d
left join public.employees e on e.department_id = d.id
group by d.id, d.company_id, d.name;

-- ── 16. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────
alter table public.companies                   enable row level security;
alter table public.departments                 enable row level security;
alter table public.designations                enable row level security;
alter table public.locations                   enable row level security;
alter table public.shifts                      enable row level security;
alter table public.employees                   enable row level security;
alter table public.profiles                    enable row level security;
alter table public.attendance                  enable row level security;
alter table public.attendance_exceptions       enable row level security;
alter table public.attendance_adjustments      enable row level security;
alter table public.leave_types                 enable row level security;
alter table public.leave_balances              enable row level security;
alter table public.leave_requests              enable row level security;
alter table public.payroll_runs                enable row level security;
alter table public.payroll_items               enable row level security;
alter table public.payslips                    enable row level security;
alter table public.assets                      enable row level security;
alter table public.asset_assignments           enable row level security;
alter table public.asset_maintenance           enable row level security;
alter table public.asset_handover              enable row level security;
alter table public.asset_returns               enable row level security;
alter table public.asset_categories            enable row level security;
alter table public.asset_brands                enable row level security;
alter table public.expenses                    enable row level security;
alter table public.helpdesk_tickets            enable row level security;
alter table public.resignations                enable row level security;
alter table public.holidays                    enable row level security;
alter table public.notifications               enable row level security;
alter table public.employee_documents          enable row level security;
alter table public.employee_bank_accounts      enable row level security;
alter table public.employee_statutory_details  enable row level security;

-- Drop and re-create global clean policies
drop policy if exists "companies: all read" on public.companies;
create policy "companies: all read" on public.companies for select using (true);

drop policy if exists "departments: all read" on public.departments;
create policy "departments: all read" on public.departments for select using (true);

drop policy if exists "designations: all read" on public.designations;
create policy "designations: all read" on public.designations for select using (true);

drop policy if exists "locations: all read" on public.locations;
create policy "locations: all read" on public.locations for select using (true);

drop policy if exists "shifts: all read" on public.shifts;
create policy "shifts: all read" on public.shifts for select using (true);

drop policy if exists "leave_types: all read" on public.leave_types;
create policy "leave_types: all read" on public.leave_types for select using (true);

drop policy if exists "holidays: all read" on public.holidays;
create policy "holidays: all read" on public.holidays for select using (true);

drop policy if exists "profiles: read" on public.profiles;
create policy "profiles: read" on public.profiles for select using (true);

drop policy if exists "employees: all select" on public.employees;
create policy "employees: all select" on public.employees for select using (true);

drop policy if exists "employees: all insert" on public.employees;
create policy "employees: all insert" on public.employees for insert with check (true);

drop policy if exists "employees: all update" on public.employees;
create policy "employees: all update" on public.employees for update using (true);

drop policy if exists "assets: all select" on public.assets;
create policy "assets: all select" on public.assets for select using (true);

drop policy if exists "assets: all insert" on public.assets;
create policy "assets: all insert" on public.assets for insert with check (true);

drop policy if exists "assets: all update" on public.assets;
create policy "assets: all update" on public.assets for update using (true);

drop policy if exists "asset_assignments: all" on public.asset_assignments;
create policy "asset_assignments: all" on public.asset_assignments for all using (true);

drop policy if exists "asset_maintenance: all" on public.asset_maintenance;
create policy "asset_maintenance: all" on public.asset_maintenance for all using (true);

drop policy if exists "asset_handover: all" on public.asset_handover;
create policy "asset_handover: all" on public.asset_handover for all using (true);

drop policy if exists "asset_returns: all" on public.asset_returns;
create policy "asset_returns: all" on public.asset_returns for all using (true);

drop policy if exists "asset_categories: all" on public.asset_categories;
create policy "asset_categories: all" on public.asset_categories for all using (true);

drop policy if exists "asset_brands: all" on public.asset_brands;
create policy "asset_brands: all" on public.asset_brands for all using (true);

drop policy if exists "attendance: all" on public.attendance;
create policy "attendance: all" on public.attendance for all using (true);

drop policy if exists "leave_requests: all" on public.leave_requests;
create policy "leave_requests: all" on public.leave_requests for all using (true);

drop policy if exists "leave_balances: all" on public.leave_balances;
create policy "leave_balances: all" on public.leave_balances for all using (true);

drop policy if exists "payroll_runs: all" on public.payroll_runs;
create policy "payroll_runs: all" on public.payroll_runs for all using (true);

drop policy if exists "payroll_items: all" on public.payroll_items;
create policy "payroll_items: all" on public.payroll_items for all using (true);

drop policy if exists "payslips: all" on public.payslips;
create policy "payslips: all" on public.payslips for all using (true);

drop policy if exists "expenses: all" on public.expenses;
create policy "expenses: all" on public.expenses for all using (true);

drop policy if exists "helpdesk_tickets: all" on public.helpdesk_tickets;
create policy "helpdesk_tickets: all" on public.helpdesk_tickets for all using (true);

drop policy if exists "resignations: all" on public.resignations;
create policy "resignations: all" on public.resignations for all using (true);

drop policy if exists "documents: all" on public.employee_documents;
create policy "documents: all" on public.employee_documents for all using (true);

drop policy if exists "bank: all" on public.employee_bank_accounts;
create policy "bank: all" on public.employee_bank_accounts for all using (true);

drop policy if exists "statutory: all" on public.employee_statutory_details;
create policy "statutory: all" on public.employee_statutory_details for all using (true);

-- ── 17. SAFE DEFAULT SEED DATA ────────────────────────────────────────────────
insert into public.companies (id, legal_name, display_name, trade_name, registration_number, company_code)
values (
  '00000000-0000-0000-0000-000000000001',
  'ACG LEASING LIMITED',
  'Loan On Tip',
  'Loan On Tip',
  'U65923DL2018PLC338821',
  'LOT-01'
)
on conflict (id) do update set
  legal_name   = excluded.legal_name,
  company_code = coalesce(public.companies.company_code, excluded.company_code),
  display_name = coalesce(excluded.display_name, public.companies.display_name),
  trade_name   = coalesce(excluded.trade_name, public.companies.trade_name);

insert into public.document_types (company_id, code, name)
select c.id, v.code, v.name
from public.companies c
cross join (values
  ('AADHAAR', 'Aadhaar Card'),
  ('PAN', 'PAN Card'),
  ('PASSPORT', 'Passport'),
  ('DRIVING_LICENSE', 'Driving License'),
  ('VOTER_ID', 'Voter ID Card'),
  ('OFFER_LETTER', 'Signed Offer Letter'),
  ('APPOINTMENT_LETTER', 'Appointment Letter'),
  ('EXPERIENCE_CERT', 'Previous Experience Letter'),
  ('SALARY_SLIP', 'Previous Salary Slips'),
  ('BANK_STATEMENT', 'Bank Statement / Cancelled Cheque'),
  ('GRADUATION_CERT', 'Degree / Graduation Certificate')
) as v(code, name)
where not exists (
  select 1 from public.document_types dt 
  where dt.company_id = c.id and dt.code = v.code
);

insert into public.roles (code, name, is_system)
select v.code, v.name, v.is_system
from (values
  ('SUPER_ADMIN',      'Super Administrator', true),
  ('HR_ADMIN',         'HR Administrator',    true),
  ('OPERATIONS_ADMIN', 'Operations Admin',    true),
  ('FINANCE_ADMIN',    'Finance Administrator', true),
  ('MANAGER',          'Reporting Manager',   true),
  ('EMPLOYEE',         'Employee',            true)
) as v(code, name, is_system)
where not exists (
  select 1 from public.roles r where r.code = v.code
);

insert into public.permissions (code, name, module)
select v.code, v.name, v.module
from (values
  ('employee.view',        'View Employees',        'PEOPLE'),
  ('employee.create',      'Create Employee',       'PEOPLE'),
  ('employee.update',      'Update Employee',       'PEOPLE'),
  ('employee.delete',      'Delete Employee',       'PEOPLE'),
  ('attendance.view',      'View Attendance',       'ATTENDANCE'),
  ('attendance.adjust',    'Adjust Attendance',     'ATTENDANCE'),
  ('attendance.approve',   'Approve Attendance',    'ATTENDANCE'),
  ('leave.view',           'View Leave',            'LEAVE'),
  ('leave.apply',          'Apply Leave',           'LEAVE'),
  ('leave.approve',        'Approve Leave',         'LEAVE'),
  ('payroll.view',         'View Payroll',          'PAYROLL'),
  ('payroll.create',       'Create Payroll Run',    'PAYROLL'),
  ('payroll.approve',      'Approve Payroll Run',   'PAYROLL'),
  ('asset.view',           'View Assets',           'ASSETS'),
  ('asset.create',         'Create Assets',         'ASSETS'),
  ('asset.assign',         'Assign Assets',         'ASSETS'),
  ('reports.view',         'View Reports',          'REPORTS')
) as v(code, name, module)
where not exists (
  select 1 from public.permissions p where p.code = v.code
);

-- Ensure SUPER_ADMIN has all permissions
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'SUPER_ADMIN'
  and not exists (
    select 1 from public.role_permissions rp
    where rp.role_id = r.id and rp.permission_id = p.id
  );

-- ── 18. ASSET CATEGORIES & BRANDS SEED ────────────────────────────────────────
insert into public.asset_categories (company_id, code, name, prefix)
select c.id, v.code, v.name, v.prefix
from public.companies c
cross join (values
  ('LAPTOP',    'Laptop / Computer',        'LAP'),
  ('MOBILE',    'Mobile Phone',             'MOB'),
  ('SIM',       'SIM Card',                 'SIM'),
  ('MONITOR',   'External Display Monitor', 'MON'),
  ('FURNITURE', 'Office Furniture / Chair', 'FUR')
) as v(code, name, prefix)
where not exists (
  select 1 from public.asset_categories ac
  where ac.company_id = c.id and ac.code = v.code
);

-- ── DONE ──────────────────────────────────────────────────────────────────────
select 'Master schema migration completed successfully!' as status;
