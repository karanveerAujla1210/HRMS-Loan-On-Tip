-- ================================================================
-- FULL SCHEMA + SUPER ADMIN SETUP
-- Paste this entire file in Supabase Dashboard → SQL Editor → Run
-- ================================================================

-- 01: Extensions & Enums
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create type public.employment_status_enum as enum ('ACTIVE','ON_NOTICE','SUSPENDED','RESIGNED','TERMINATED','RETIRED','INACTIVE');
create type public.attendance_status_enum as enum ('PRESENT','ABSENT','HALF_DAY','LEAVE','HOLIDAY','WEEKLY_OFF','LATE','WORK_FROM_HOME','ON_DUTY','MISSING_PUNCH');
create type public.leave_request_status_enum as enum ('DRAFT','PENDING','APPROVED','REJECTED','CANCELLED');
create type public.payroll_run_status_enum as enum ('DRAFT','CALCULATING','CALCULATED','HR_REVIEW','FINANCE_REVIEW','APPROVED','LOCKED','PAID','CANCELLED');
create type public.asset_status_enum as enum ('AVAILABLE','ASSIGNED','UNDER_REPAIR','LOST','DAMAGED','RETIRED','DISPOSED');
create type public.approval_action_enum as enum ('APPROVED','REJECTED','ESCALATED');
create type public.notification_channel_enum as enum ('PUSH','EMAIL','SMS','IN_APP');
create type public.component_type_enum as enum ('EARNING','DEDUCTION','STATUTORY');

-- 02: Companies
create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  company_code        varchar(20)  not null unique,
  legal_name          varchar(255) not null,
  display_name        varchar(255) not null,
  registration_number varchar(100),
  gstin               varchar(20),
  pan                 varchar(20),
  email               varchar(255),
  phone               varchar(20),
  website             varchar(255),
  address_line1       text,
  city                varchar(100),
  state               varchar(100),
  pincode             varchar(20),
  country             varchar(100) not null default 'India',
  timezone            varchar(60)  not null default 'Asia/Kolkata',
  currency            varchar(10)  not null default 'INR',
  is_active           boolean      not null default true,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

-- 03: Organization
create table public.locations (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid not null references public.companies on delete cascade,
  location_code            varchar(20)  not null,
  name                     varchar(255) not null,
  location_type            varchar(50)  not null default 'OFFICE',
  address_line1            text,
  city                     varchar(100),
  state                    varchar(100),
  pincode                  varchar(20),
  latitude                 numeric(9,6),
  longitude                numeric(9,6),
  attendance_radius_meters integer      not null default 150 check (attendance_radius_meters between 25 and 5000),
  timezone                 varchar(60)  not null default 'Asia/Kolkata',
  contact_name             varchar(255),
  contact_phone            varchar(20),
  is_active                boolean      not null default true,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now(),
  unique (company_id, location_code)
);

create table public.departments (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  department_code  varchar(20)  not null,
  name             varchar(255) not null,
  description      text,
  head_employee_id uuid,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, department_code)
);

create table public.teams (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies on delete cascade,
  department_id       uuid references public.departments on delete set null,
  location_id         uuid references public.locations  on delete set null,
  team_code           varchar(20)  not null,
  name                varchar(255) not null,
  manager_employee_id uuid,
  is_active           boolean     not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (company_id, team_code)
);

create table public.designations (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  designation_code varchar(20)  not null,
  name             varchar(255) not null,
  level            integer,
  description      text,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (company_id, designation_code)
);

create table public.employment_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies on delete cascade,
  code        varchar(30)  not null,
  name        varchar(100) not null,
  description text,
  is_active   boolean     not null default true,
  unique (company_id, code)
);

create table public.shifts (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies on delete cascade,
  location_id             uuid references public.locations on delete set null,
  shift_code              varchar(20)  not null,
  name                    varchar(100) not null,
  start_time              time         not null,
  end_time                time         not null,
  break_minutes           integer      not null default 0,
  grace_minutes           integer      not null default 15,
  half_day_after_minutes  integer      not null default 240,
  full_day_after_minutes  integer      not null default 360,
  minimum_work_minutes    integer      not null default 240,
  overtime_after_minutes  integer      not null default 540,
  is_overnight            boolean      not null default false,
  is_active               boolean      not null default true,
  created_at              timestamptz  not null default now(),
  updated_at              timestamptz  not null default now(),
  unique (company_id, shift_code)
);

create table public.shift_assignments (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null,
  shift_id       uuid not null references public.shifts on delete restrict,
  effective_from date not null,
  effective_to   date,
  is_current     boolean     not null default true,
  assigned_by    uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index uq_shift_assignment_current on public.shift_assignments (employee_id) where is_current = true;

create table public.holidays (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies on delete cascade,
  location_id  uuid references public.locations on delete set null,
  holiday_date date         not null,
  name         varchar(255) not null,
  holiday_type varchar(50)  not null default 'NATIONAL',
  is_optional  boolean      not null default false,
  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now(),
  unique (company_id, location_id, holiday_date)
);

create table public.weekly_off_rules (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  location_id    uuid references public.locations on delete set null,
  day_of_week    smallint not null check (day_of_week between 0 and 6),
  week_number    smallint check (week_number between 1 and 5),
  is_off         boolean  not null default true,
  effective_from date     not null,
  effective_to   date
);

-- 04: Profiles
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users on delete cascade,
  employee_id     uuid,
  company_id      uuid references public.companies on delete cascade,
  email           varchar(255),
  phone           varchar(20),
  avatar_url      text,
  last_login_at   timestamptz,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 05: Employees
create sequence public.employee_code_seq start 1;

create or replace function public.trg_employee_codes()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null or new.employee_code = '' then
    new.employee_code := 'EMP-' || lpad(nextval('public.employee_code_seq')::text, 6, '0');
  end if;
  new.display_name := trim(new.first_name || ' ' || coalesce(new.middle_name || ' ', '') || coalesce(new.last_name, ''));
  return new;
end; $$;

create table public.employees (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null references public.companies on delete cascade,
  employee_code        varchar(20),
  first_name           varchar(100) not null,
  middle_name          varchar(100),
  last_name            varchar(100) not null,
  display_name         varchar(255),
  gender               varchar(20),
  date_of_birth        date,
  profile_photo_url    text,
  joining_date         date,
  confirmation_date    date,
  employment_type_id   uuid references public.employment_types on delete set null,
  department_id        uuid references public.departments       on delete set null,
  designation_id       uuid references public.designations      on delete set null,
  team_id              uuid references public.teams             on delete set null,
  location_id          uuid references public.locations         on delete set null,
  manager_id           uuid references public.employees         on delete set null,
  hr_manager_id        uuid references public.employees         on delete set null,
  employment_status    public.employment_status_enum not null default 'ACTIVE',
  probation_end_date   date,
  notice_period_days   integer,
  last_working_date    date,
  official_email       varchar(255) unique,
  personal_email       varchar(255),
  official_mobile      varchar(20),
  personal_mobile      varchar(20),
  nationality          varchar(100) default 'Indian',
  marital_status       varchar(30),
  created_at           timestamptz  not null default now(),
  updated_at           timestamptz  not null default now()
);

create trigger trg_employees_codes
  before insert or update on public.employees
  for each row execute function public.trg_employee_codes();

create unique index uq_employee_code on public.employees (company_id, employee_code) where employee_code is not null;

alter table public.departments    add constraint fk_dept_head      foreign key (head_employee_id)    references public.employees on delete set null;
alter table public.teams          add constraint fk_team_manager   foreign key (manager_employee_id) references public.employees on delete set null;
alter table public.shift_assignments add constraint fk_shift_emp   foreign key (employee_id)         references public.employees on delete cascade;
alter table public.shift_assignments add constraint fk_shift_by    foreign key (assigned_by)         references public.employees on delete set null;
alter table public.profiles       add constraint fk_profile_emp    foreign key (employee_id)         references public.employees on delete set null;

create table public.employee_history (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  change_type    varchar(50) not null,
  old_value      jsonb,
  new_value      jsonb,
  effective_date date        not null,
  reason         text,
  changed_by     uuid references public.employees on delete set null,
  created_at     timestamptz not null default now()
);

create table public.employee_manager_history (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  manager_id     uuid references public.employees on delete set null,
  effective_from date        not null,
  effective_to   date,
  is_current     boolean     not null default true,
  changed_by     uuid references public.employees on delete set null,
  created_at     timestamptz not null default now()
);
create unique index uq_manager_history_current on public.employee_manager_history (employee_id) where is_current = true;

-- 06: Attendance
create table public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees  on delete cascade,
  company_id           uuid not null references public.companies  on delete cascade,
  location_id          uuid references public.locations           on delete set null,
  attendance_date      date not null,
  shift_id             uuid references public.shifts              on delete set null,
  scheduled_start      timestamptz,
  scheduled_end        timestamptz,
  check_in_at          timestamptz,
  check_out_at         timestamptz,
  check_in_latitude    numeric(9,6),
  check_in_longitude   numeric(9,6),
  check_in_accuracy    numeric(8,2),
  check_out_latitude   numeric(9,6),
  check_out_longitude  numeric(9,6),
  check_out_accuracy   numeric(8,2),
  worked_minutes       integer not null default 0,
  break_minutes        integer not null default 0,
  overtime_minutes     integer not null default 0,
  late_minutes         integer not null default 0,
  early_exit_minutes   integer not null default 0,
  status               public.attendance_status_enum not null default 'ABSENT',
  source               varchar(30) not null default 'MOBILE',
  is_manual_adjustment boolean     not null default false,
  adjustment_reason    text,
  approved_by          uuid references public.employees on delete set null,
  approved_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (employee_id, attendance_date)
);

create table public.attendance_exceptions (
  id              uuid primary key default gen_random_uuid(),
  attendance_id   uuid not null references public.attendance on delete cascade,
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

create table public.attendance_adjustments (
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

-- 07: Leave
create table public.leave_types (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies on delete cascade,
  code                  varchar(20)  not null,
  name                  varchar(100) not null,
  description           text,
  is_paid               boolean not null default true,
  requires_document     boolean not null default false,
  allows_half_day       boolean not null default true,
  max_consecutive_days  integer,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (company_id, code)
);

create table public.leave_balances (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid     not null references public.employees  on delete cascade,
  leave_type_id    uuid     not null references public.leave_types on delete cascade,
  year             smallint not null,
  opening_balance  numeric(6,2) not null default 0,
  accrued          numeric(6,2) not null default 0,
  used             numeric(6,2) not null default 0,
  adjusted         numeric(6,2) not null default 0,
  encashed         numeric(6,2) not null default 0,
  closing_balance  numeric(6,2) generated always as (opening_balance + accrued + adjusted - used - encashed) stored,
  updated_at       timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create table public.leave_requests (
  id                     uuid primary key default gen_random_uuid(),
  employee_id            uuid not null references public.employees  on delete cascade,
  leave_type_id          uuid not null references public.leave_types on delete cascade,
  from_date              date not null,
  to_date                date not null,
  total_days             numeric(5,2) not null,
  half_day_type          varchar(10),
  reason                 text,
  attachment_document_id uuid,
  status                 public.leave_request_status_enum not null default 'PENDING',
  submitted_at           timestamptz not null default now(),
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (to_date >= from_date)
);

create table public.leave_approvals (
  id               uuid primary key default gen_random_uuid(),
  leave_request_id uuid not null references public.leave_requests on delete cascade,
  approver_id      uuid not null references public.employees       on delete cascade,
  approval_level   smallint    not null default 1,
  action           public.approval_action_enum not null,
  comments         text,
  acted_at         timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

-- 08: Payroll
create sequence public.payslip_number_seq start 1;

create table public.salary_components (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references public.companies on delete cascade,
  code             varchar(30)  not null,
  name             varchar(100) not null,
  component_type   public.component_type_enum not null,
  calculation_type varchar(30)  not null default 'FIXED',
  is_taxable       boolean      not null default false,
  is_statutory     boolean      not null default false,
  is_active        boolean      not null default true,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now(),
  unique (company_id, code)
);

create table public.salary_structures (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies on delete cascade,
  name           varchar(255) not null,
  description    text,
  effective_from date         not null,
  effective_to   date,
  is_active      boolean      not null default true,
  created_at     timestamptz  not null default now(),
  updated_at     timestamptz  not null default now()
);

-- Components that belong to a salary structure (e.g. Basic 40%, HRA 20%, PF fixed)
create table public.salary_structure_components (
  id                  uuid primary key default gen_random_uuid(),
  salary_structure_id uuid not null references public.salary_structures  on delete cascade,
  salary_component_id uuid not null references public.salary_components   on delete restrict,
  calculation_type    varchar(20)   not null default 'FIXED',  -- FIXED | PERCENTAGE_OF_BASIC | PERCENTAGE_OF_GROSS
  value               numeric(10,4) not null,                  -- amount or percentage
  sequence            smallint      not null default 1,
  is_active           boolean       not null default true,
  created_at          timestamptz   not null default now(),
  unique (salary_structure_id, salary_component_id)
);

-- Which structure is assigned to an employee, with their CTC and effective dates
create table public.employee_salary_assignments (
  id                  uuid primary key default gen_random_uuid(),
  employee_id         uuid not null references public.employees        on delete cascade,
  salary_structure_id uuid not null references public.salary_structures on delete restrict,
  annual_ctc          numeric(14,2) not null,
  effective_from      date          not null,
  effective_to        date,
  is_current          boolean       not null default true,
  revised_by          uuid references public.employees on delete set null,
  revision_reason     text,
  created_at          timestamptz   not null default now(),
  updated_at          timestamptz   not null default now()
);
create unique index uq_salary_assignment_current on public.employee_salary_assignments (employee_id) where is_current = true;

create table public.payroll_runs (
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
  updated_at       timestamptz not null default now(),
  unique (company_id, payroll_year, payroll_month)
);

create table public.payroll_items (
  id               uuid primary key default gen_random_uuid(),
  payroll_run_id   uuid not null references public.payroll_runs on delete cascade,
  employee_id      uuid not null references public.employees     on delete cascade,
  working_days     integer      not null default 0,
  paid_days        numeric(5,2) not null default 0,
  gross_salary     numeric(14,2) not null default 0,
  total_earnings   numeric(14,2) not null default 0,
  total_deductions numeric(14,2) not null default 0,
  net_salary       numeric(14,2) not null default 0,
  status           varchar(20)   not null default 'DRAFT',
  created_at       timestamptz   not null default now(),
  updated_at       timestamptz   not null default now(),
  unique (payroll_run_id, employee_id)
);

create table public.payslips (
  id               uuid primary key default gen_random_uuid(),
  payroll_item_id  uuid not null references public.payroll_items on delete cascade,
  employee_id      uuid not null references public.employees      on delete cascade,
  payroll_run_id   uuid not null references public.payroll_runs   on delete cascade,
  payslip_number   varchar(30) not null unique default ('PAY-' || to_char(now(), 'YYYY-MM') || '-' || lpad(nextval('public.payslip_number_seq')::text, 4, '0')),
  gross_salary     numeric(14,2) not null,
  deductions       numeric(14,2) not null,
  net_salary       numeric(14,2) not null,
  payslip_json     jsonb         not null default '{}',
  pdf_storage_path text,
  generated_at     timestamptz,
  published_at     timestamptz,
  created_at       timestamptz   not null default now(),
  unique (payroll_run_id, employee_id)
);

-- 09: Assets
create sequence public.asset_code_seq start 1;

create table public.asset_categories (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  code       varchar(30)  not null,
  name       varchar(100) not null,
  prefix     varchar(10)  not null,
  is_active  boolean      not null default true,
  unique (company_id, code)
);

create table public.asset_brands (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies on delete cascade,
  name       varchar(100) not null,
  is_active  boolean      not null default true,
  created_at timestamptz  not null default now()
);

create table public.assets (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null references public.companies        on delete cascade,
  location_id         uuid references public.locations                 on delete set null,
  asset_category_id   uuid not null references public.asset_categories on delete restrict,
  brand_id            uuid references public.asset_brands              on delete set null,
  asset_code          varchar(30) not null unique,
  asset_tag           varchar(100),
  model               varchar(255),
  serial_number       varchar(255) unique,
  imei_1              varchar(20)  unique,
  mobile_number       varchar(20)  unique,
  purchase_date       date,
  purchase_cost       numeric(14,2),
  warranty_start      date,
  warranty_end        date,
  condition           varchar(30)  not null default 'GOOD',
  status              public.asset_status_enum not null default 'AVAILABLE',
  current_employee_id uuid references public.employees on delete set null,
  notes               text,
  created_at          timestamptz  not null default now(),
  updated_at          timestamptz  not null default now()
);

create table public.asset_assignments (
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
create unique index uq_asset_assignment_active on public.asset_assignments (asset_id) where status = 'ACTIVE';

-- 10: Documents
create table public.document_types (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies on delete cascade,
  code        varchar(50)  not null,
  name        varchar(100) not null,
  description text,
  is_active   boolean      not null default true,
  unique (company_id, code)
);

create table public.employee_documents (
  id               uuid primary key default gen_random_uuid(),
  employee_id      uuid not null references public.employees      on delete cascade,
  document_type_id uuid not null references public.document_types on delete restrict,
  storage_path     text         not null,
  file_name        varchar(255) not null,
  mime_type        varchar(100),
  file_size        integer,
  issue_date       date,
  expiry_date      date,
  status           varchar(20)  not null default 'ACTIVE',
  uploaded_by      uuid references public.employees on delete set null,
  verified_by      uuid references public.employees on delete set null,
  verified_at      timestamptz,
  created_at       timestamptz  not null default now(),
  updated_at       timestamptz  not null default now()
);

alter table public.leave_requests add constraint fk_leave_attachment
  foreign key (attachment_document_id) references public.employee_documents on delete set null;

-- 11: Notifications
create table public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_employee_id uuid not null references public.employees on delete cascade,
  notification_type     varchar(50)  not null,
  title                 varchar(255) not null,
  body                  text         not null,
  data                  jsonb,
  priority              varchar(10)  not null default 'NORMAL',
  read_at               timestamptz,
  created_at            timestamptz  not null default now()
);

-- 12: Roles & Permissions
create table public.roles (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies on delete cascade,
  code        varchar(50)  not null,
  name        varchar(100) not null,
  description text,
  is_system   boolean      not null default false,
  is_active   boolean      not null default true,
  created_at  timestamptz  not null default now(),
  unique (company_id, code)
);

create table public.permissions (
  id          uuid primary key default gen_random_uuid(),
  code        varchar(100) not null unique,
  name        varchar(100) not null,
  module      varchar(50)  not null,
  description text,
  created_at  timestamptz  not null default now()
);

create table public.role_permissions (
  id            uuid primary key default gen_random_uuid(),
  role_id       uuid not null references public.roles       on delete cascade,
  permission_id uuid not null references public.permissions on delete cascade,
  created_at    timestamptz not null default now(),
  unique (role_id, permission_id)
);

create table public.employee_roles (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees on delete cascade,
  role_id        uuid not null references public.roles     on delete cascade,
  company_id     uuid not null references public.companies on delete cascade,
  location_id    uuid references public.locations          on delete set null,
  effective_from date         not null,
  effective_to   date,
  is_active      boolean      not null default true,
  assigned_by    uuid references public.employees on delete set null,
  created_at     timestamptz  not null default now()
);

-- 13: Audit
create table public.audit_logs (
  id                 bigint generated always as identity primary key,
  company_id         uuid references public.companies  on delete set null,
  actor_employee_id  uuid references public.employees  on delete set null,
  actor_auth_user_id uuid references auth.users        on delete set null,
  action             varchar(100) not null,
  entity_type        varchar(100) not null,
  entity_id          text,
  old_values         jsonb,
  new_values         jsonb,
  ip_address         inet,
  user_agent         text,
  created_at         timestamptz  not null default now()
);

create table public.system_settings (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid references public.companies on delete cascade,
  setting_key   varchar(100) not null,
  setting_value text         not null,
  data_type     varchar(20)  not null default 'STRING',
  description   text,
  is_public     boolean      not null default false,
  updated_by    uuid references public.employees on delete set null,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (company_id, setting_key)
);

-- 14: Functions
create or replace function public.auth_employee_id() returns uuid language sql stable security definer as $$
  select employee_id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_company_id() returns uuid language sql stable security definer as $$
  select company_id from public.profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.auth_role() returns text language sql stable security definer as $$
  select r.code from public.employee_roles er join public.roles r on r.id = er.role_id
  where er.employee_id = public.auth_employee_id() and er.is_active = true order by r.is_system desc limit 1;
$$;

create or replace function public.has_permission(p_code text) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.employee_roles er
    join public.role_permissions rp on rp.role_id = er.role_id
    join public.permissions p on p.id = rp.permission_id
    where er.employee_id = public.auth_employee_id() and er.is_active = true and p.code = p_code
  );
$$;

create or replace function public.auth_direct_report_ids() returns setof uuid language sql stable security definer as $$
  select id from public.employees where manager_id = public.auth_employee_id() and employment_status = 'ACTIVE';
$$;

-- 15: RLS
alter table public.profiles                    enable row level security;
alter table public.employees                   enable row level security;
alter table public.attendance                  enable row level security;
alter table public.leave_requests              enable row level security;
alter table public.leave_balances              enable row level security;
alter table public.payroll_items               enable row level security;
alter table public.payslips                    enable row level security;
alter table public.asset_assignments           enable row level security;
alter table public.employee_documents          enable row level security;
alter table public.notifications               enable row level security;
alter table public.audit_logs                  enable row level security;

create policy "profile: own read"    on public.profiles    for select using (auth_user_id = auth.uid());
create policy "employee: own read"   on public.employees   for select using (id = public.auth_employee_id());
create policy "employee: hr read"    on public.employees   for select using (company_id = public.auth_company_id() and public.has_permission('employee.view'));
create policy "attendance: own read" on public.attendance  for select using (employee_id = public.auth_employee_id());
create policy "attendance: hr read"  on public.attendance  for select using (company_id = public.auth_company_id() and public.has_permission('attendance.view'));
create policy "leave: own read"      on public.leave_requests for select using (employee_id = public.auth_employee_id());
create policy "leave: own insert"    on public.leave_requests for insert with check (employee_id = public.auth_employee_id());
create policy "leave: hr read"       on public.leave_requests for select using (public.has_permission('leave.view'));
create policy "leave_balance: own"   on public.leave_balances  for select using (employee_id = public.auth_employee_id());
create policy "payslip: own read"    on public.payslips        for select using (employee_id = public.auth_employee_id());
create policy "payslip: finance"     on public.payslips        for select using (public.has_permission('payroll.view'));
create policy "payroll_item: finance" on public.payroll_items  for select using (public.has_permission('payroll.view'));
create policy "asset_assign: own"    on public.asset_assignments for select using (employee_id = public.auth_employee_id());
create policy "asset_assign: admin"  on public.asset_assignments for select using (public.has_permission('asset.view'));
create policy "document: own read"   on public.employee_documents for select using (employee_id = public.auth_employee_id());
create policy "document: hr read"    on public.employee_documents for select using (public.has_permission('employee.view'));
create policy "notification: own"    on public.notifications for select using (recipient_employee_id = public.auth_employee_id());
create policy "audit: super admin"   on public.audit_logs    for select using (public.has_permission('audit.view'));

-- 16: Indexes
create index idx_attendance_emp_date  on public.attendance (employee_id, attendance_date desc);
create index idx_attendance_company   on public.attendance (company_id,  attendance_date desc);
create index idx_leave_req_emp_date   on public.leave_requests (employee_id, from_date desc);
create index idx_leave_req_status     on public.leave_requests (status, from_date);
create index idx_asset_company_status on public.assets (company_id, status);
create index idx_asset_current_emp    on public.assets (current_employee_id);
create index idx_employee_company     on public.employees (company_id, employment_status);
create index idx_employee_name_trgm   on public.employees using gin (display_name gin_trgm_ops);
create index idx_notif_recipient      on public.notifications (recipient_employee_id, created_at desc);

-- 17: Triggers
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

do $$ declare t text; begin
  foreach t in array array['companies','locations','departments','teams','designations','shifts',
    'profiles','employees','attendance','leave_types','leave_balances','leave_requests',
    'salary_structures','salary_structure_components','employee_salary_assignments',
    'payroll_runs','payroll_items','asset_categories','assets',
    'asset_assignments','document_types','employee_documents','system_settings']
  loop
    execute format('create trigger trg_%s_updated_at before update on public.%s for each row execute function public.set_updated_at()', t, t);
  end loop;
end; $$;

create or replace function public.trg_attendance_calc() returns trigger language plpgsql as $$
begin
  if new.check_in_at is not null and new.check_out_at is not null then
    new.worked_minutes := greatest(0, extract(epoch from (new.check_out_at - new.check_in_at))::integer / 60 - new.break_minutes);
  end if;
  return new;
end; $$;
create trigger trg_attendance_calc before insert or update on public.attendance for each row execute function public.trg_attendance_calc();

-- 18: Seed data
insert into public.companies (id, company_code, legal_name, display_name, timezone, currency) values
  ('00000000-0000-0000-0000-000000000001','LOT','ACG Leasing Limited','Loan On Tip','Asia/Kolkata','INR')
on conflict do nothing;

insert into public.locations (id, company_id, location_code, name, city, state, latitude, longitude, attendance_radius_meters) values
  ('11111111-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','DEL-HO','Delhi Head Office','Delhi','Delhi',28.6139,77.2090,150),
  ('11111111-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','MUM-BR','Mumbai Branch','Mumbai','Maharashtra',19.0760,72.8777,150),
  ('11111111-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','NOI-BR','Noida Branch','Noida','Uttar Pradesh',28.5355,77.3910,150),
  ('11111111-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','GGN-BR','Gurugram Branch','Gurugram','Haryana',28.4595,77.0266,150)
on conflict do nothing;

insert into public.departments (company_id, department_code, name) values
  ('00000000-0000-0000-0000-000000000001','HR','Human Resources'),
  ('00000000-0000-0000-0000-000000000001','CREDIT','Credit'),
  ('00000000-0000-0000-0000-000000000001','SALES','Sales'),
  ('00000000-0000-0000-0000-000000000001','FINANCE','Finance'),
  ('00000000-0000-0000-0000-000000000001','OPERATIONS','Operations'),
  ('00000000-0000-0000-0000-000000000001','TECHNOLOGY','Technology')
on conflict do nothing;

insert into public.designations (company_id, designation_code, name, level) values
  ('00000000-0000-0000-0000-000000000001','EXEC','Executive',1),
  ('00000000-0000-0000-0000-000000000001','AM','Assistant Manager',3),
  ('00000000-0000-0000-0000-000000000001','MGR','Manager',5),
  ('00000000-0000-0000-0000-000000000001','VP','VP',8)
on conflict do nothing;

insert into public.employment_types (company_id, code, name) values
  ('00000000-0000-0000-0000-000000000001','FULL_TIME','Full Time'),
  ('00000000-0000-0000-0000-000000000001','CONTRACT','Contract'),
  ('00000000-0000-0000-0000-000000000001','INTERN','Intern')
on conflict do nothing;

insert into public.shifts (company_id, shift_code, name, start_time, end_time, grace_minutes) values
  ('00000000-0000-0000-0000-000000000001','GENERAL','General Shift','09:30','18:30',15)
on conflict do nothing;

insert into public.leave_types (company_id, code, name, is_paid, allows_half_day) values
  ('00000000-0000-0000-0000-000000000001','CL','Casual Leave',true,true),
  ('00000000-0000-0000-0000-000000000001','SL','Sick Leave',true,true),
  ('00000000-0000-0000-0000-000000000001','PL','Privilege Leave',true,false),
  ('00000000-0000-0000-0000-000000000001','LWP','Leave Without Pay',false,true)
on conflict do nothing;

insert into public.asset_categories (company_id, code, name, prefix) values
  ('00000000-0000-0000-0000-000000000001','LAPTOP','Laptop','LAP'),
  ('00000000-0000-0000-0000-000000000001','MOBILE','Mobile','MOB'),
  ('00000000-0000-0000-0000-000000000001','SIM','SIM Card','SIM'),
  ('00000000-0000-0000-0000-000000000001','OTHER','Other','OTH')
on conflict do nothing;

insert into public.document_types (company_id, code, name) values
  ('00000000-0000-0000-0000-000000000001','AADHAAR','Aadhaar Card'),
  ('00000000-0000-0000-0000-000000000001','PAN','PAN Card'),
  ('00000000-0000-0000-0000-000000000001','OFFER_LETTER','Offer Letter')
on conflict do nothing;

insert into public.system_settings (company_id, setting_key, setting_value, data_type, description, is_public) values
  ('00000000-0000-0000-0000-000000000001','attendance.radius','150','INTEGER','Geo-fence radius in metres',true),
  ('00000000-0000-0000-0000-000000000001','attendance.grace_minutes','15','INTEGER','Late grace period in minutes',true)
on conflict do nothing;

-- Roles
insert into public.roles (company_id, code, name, is_system) values
  (null,'SUPER_ADMIN','Super Admin',true),
  (null,'HR_ADMIN','HR Admin',true),
  (null,'FINANCE_ADMIN','Finance Admin',true),
  (null,'MANAGER','Manager',true),
  (null,'EMPLOYEE','Employee',true)
on conflict do nothing;

-- Permissions
insert into public.permissions (code, name, module) values
  ('employee.view','View Employees','PEOPLE'),
  ('employee.create','Create Employee','PEOPLE'),
  ('employee.update','Update Employee','PEOPLE'),
  ('employee.delete','Delete Employee','PEOPLE'),
  ('attendance.view','View Attendance','ATTENDANCE'),
  ('attendance.adjust','Adjust Attendance','ATTENDANCE'),
  ('attendance.approve','Approve Attendance','ATTENDANCE'),
  ('leave.view','View Leaves','LEAVE'),
  ('leave.apply','Apply Leave','LEAVE'),
  ('leave.approve','Approve Leave','LEAVE'),
  ('payroll.view','View Payroll','PAYROLL'),
  ('payroll.create','Create Payroll','PAYROLL'),
  ('payroll.approve','Approve Payroll','PAYROLL'),
  ('asset.view','View Assets','ASSETS'),
  ('asset.create','Create Asset','ASSETS'),
  ('asset.assign','Assign Asset','ASSETS'),
  ('reports.view','View Reports','REPORTS'),
  ('audit.view','View Audit Logs','SYSTEM'),
  ('settings.manage','Manage Settings','SYSTEM')
on conflict do nothing;

-- Grant all permissions to SUPER_ADMIN
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'SUPER_ADMIN'
on conflict do nothing;

-- Views
create or replace view public.v_employee_directory as
select e.id, e.company_id, e.employee_code, e.display_name,
  e.official_email, e.official_mobile,
  d.name as department, dg.name as designation, l.name as location,
  m.display_name as manager_name, e.employment_status, e.joining_date
from public.employees e
left join public.departments  d  on d.id  = e.department_id
left join public.designations dg on dg.id = e.designation_id
left join public.locations    l  on l.id  = e.location_id
left join public.employees    m  on m.id  = e.manager_id;

create or replace view public.v_today_attendance as
select a.id, a.employee_id, e.display_name, e.employee_code,
  l.name as location, a.attendance_date, a.status,
  a.check_in_at, a.check_out_at, a.worked_minutes, a.late_minutes
from public.attendance a
join public.employees e on e.id = a.employee_id
left join public.locations l on l.id = a.location_id
where a.attendance_date = current_date;

create or replace view public.v_pending_leave_approvals as
select lr.id, lr.employee_id, e.display_name, e.employee_code,
  lt.name as leave_type, lr.from_date, lr.to_date, lr.total_days, lr.reason, lr.submitted_at
from public.leave_requests lr
join public.employees  e  on e.id  = lr.employee_id
join public.leave_types lt on lt.id = lr.leave_type_id
where lr.status = 'PENDING';

create or replace view public.v_asset_inventory as
select a.id, a.company_id, a.asset_code, a.asset_tag,
  ac.name as category, ab.name as brand,
  a.model, a.serial_number, a.status, a.condition,
  e.display_name as assigned_to, l.name as location, a.warranty_end
from public.assets a
join public.asset_categories ac on ac.id = a.asset_category_id
left join public.asset_brands  ab on ab.id = a.brand_id
left join public.employees     e  on e.id  = a.current_employee_id
left join public.locations     l  on l.id  = a.location_id;

create or replace view public.v_dashboard_metrics as
select c.id as company_id,
  (select count(*) from public.employees where company_id = c.id and employment_status = 'ACTIVE') as active_employees,
  (select count(*) from public.attendance where company_id = c.id and attendance_date = current_date and status in ('PRESENT','LATE')) as present_today,
  (select count(*) from public.leave_requests lr join public.employees e on e.id = lr.employee_id where e.company_id = c.id and lr.status = 'PENDING') as pending_leaves,
  (select count(*) from public.assets where company_id = c.id and status = 'AVAILABLE') as available_assets
from public.companies c;

-- ================================================================
-- SUPER ADMIN USER: admin@loanontip.com / Admin@123
-- ================================================================
do $$
declare v_uid uuid := gen_random_uuid();
begin
  if exists (select 1 from auth.users where email = 'admin@loanontip.com') then
    raise notice 'User already exists'; return;
  end if;
  insert into auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, role, aud, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'admin@loanontip.com', crypt('Admin@123', gen_salt('bf')), now(), '{"full_name":"Super Admin","role":"SUPER_ADMIN"}'::jsonb, 'authenticated', 'authenticated', now(), now());
  raise notice 'Auth user created: %', v_uid;
end $$;

insert into public.employees (company_id, first_name, last_name, official_email, employment_status)
select '00000000-0000-0000-0000-000000000001','Super','Admin','admin@loanontip.com','ACTIVE'
where not exists (select 1 from public.employees where official_email = 'admin@loanontip.com');

insert into public.profiles (auth_user_id, company_id, email, employee_id, is_active)
select u.id, '00000000-0000-0000-0000-000000000001', u.email, e.id, true
from auth.users u cross join public.employees e
where u.email = 'admin@loanontip.com' and e.official_email = 'admin@loanontip.com'
on conflict (auth_user_id) do update set employee_id = excluded.employee_id, is_active = true;

insert into public.employee_roles (employee_id, role_id, company_id, effective_from, is_active)
select e.id, r.id, '00000000-0000-0000-0000-000000000001', current_date, true
from public.employees e cross join public.roles r
where e.official_email = 'admin@loanontip.com' and r.code = 'SUPER_ADMIN'
on conflict do nothing;

-- Final verification
select u.email, e.display_name, r.code as role, u.email_confirmed_at is not null as confirmed
from auth.users u
join public.profiles p on p.auth_user_id = u.id
join public.employees e on e.id = p.employee_id
join public.employee_roles er on er.employee_id = e.id
join public.roles r on r.id = er.role_id
where u.email = 'admin@loanontip.com';
