-- 11_notifications.sql

create table public.notification_templates (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  code          varchar(50)  not null,
  channel       public.notification_channel_enum not null,
  subject       varchar(255),
  body_template text         not null,
  is_active     boolean      not null default true,
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now(),
  unique (company_id, code, channel)
);

create table public.notifications (
  id                    uuid primary key default gen_random_uuid(),
  recipient_employee_id uuid not null references public.employees on delete cascade,
  notification_type     varchar(50) not null,
  title                 varchar(255) not null,
  body                  text         not null,
  data                  jsonb,
  priority              varchar(10)  not null default 'NORMAL',
  read_at               timestamptz,
  created_at            timestamptz  not null default now()
);

create table public.notification_preferences (
  id                uuid primary key default gen_random_uuid(),
  employee_id       uuid not null references public.employees on delete cascade,
  notification_type varchar(50) not null,
  push_enabled      boolean     not null default true,
  email_enabled     boolean     not null default true,
  sms_enabled       boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (employee_id, notification_type)
);

create table public.notification_delivery_logs (
  id                  uuid primary key default gen_random_uuid(),
  notification_id     uuid not null references public.notifications on delete cascade,
  channel             public.notification_channel_enum not null,
  provider            varchar(50),
  provider_message_id varchar(255),
  status              varchar(20) not null default 'PENDING',
  sent_at             timestamptz,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  error_message       text,
  created_at          timestamptz not null default now()
);
