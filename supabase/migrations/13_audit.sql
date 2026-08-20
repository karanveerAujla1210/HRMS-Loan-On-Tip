-- 13_audit.sql

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
  request_id         uuid,
  created_at         timestamptz  not null default now()
);

create table public.idempotency_keys (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees on delete cascade,
  idempotency_key varchar(255) not null,
  endpoint        varchar(255) not null,
  request_hash    varchar(64),
  response_status smallint,
  response_body   jsonb,
  created_at      timestamptz  not null default now(),
  expires_at      timestamptz  not null default (now() + interval '24 hours'),
  unique (employee_id, idempotency_key)
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

create table public.api_logs (
  id          bigint generated always as identity primary key,
  request_id  uuid,
  user_id     uuid references auth.users    on delete set null,
  employee_id uuid references public.employees on delete set null,
  method      varchar(10)  not null,
  endpoint    varchar(500) not null,
  status_code smallint,
  duration_ms integer,
  ip_address  inet,
  user_agent  text,
  error_code  varchar(100),
  created_at  timestamptz  not null default now()
);
