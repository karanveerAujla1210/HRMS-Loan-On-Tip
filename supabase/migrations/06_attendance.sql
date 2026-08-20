-- 06_attendance.sql

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

create table public.attendance_events (
  id               uuid primary key default gen_random_uuid(),
  attendance_id    uuid not null references public.attendance on delete cascade,
  employee_id      uuid not null references public.employees  on delete cascade,
  event_type       varchar(30) not null,
  event_at         timestamptz not null,
  server_timestamp timestamptz not null default now(),
  latitude         numeric(9,6),
  longitude        numeric(9,6),
  accuracy         numeric(8,2),
  device_id        varchar(255),
  ip_address       inet,
  source           varchar(30),
  metadata         jsonb,
  created_at       timestamptz not null default now()
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

create table public.attendance_monthly_summary (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid    not null references public.employees on delete cascade,
  company_id        uuid    not null references public.companies  on delete cascade,
  year              smallint not null,
  month             smallint not null check (month between 1 and 12),
  working_days      integer not null default 0,
  present_days      numeric(5,2) not null default 0,
  absent_days       integer not null default 0,
  leave_days        numeric(5,2) not null default 0,
  holiday_days      integer not null default 0,
  late_count        integer not null default 0,
  total_worked_mins integer not null default 0,
  overtime_mins     integer not null default 0,
  updated_at        timestamptz not null default now(),
  unique (employee_id, year, month)
);
