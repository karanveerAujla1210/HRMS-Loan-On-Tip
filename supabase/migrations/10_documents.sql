-- 10_documents.sql

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
  id                       uuid primary key default gen_random_uuid(),
  employee_id              uuid not null references public.employees     on delete cascade,
  document_type_id         uuid not null references public.document_types on delete restrict,
  storage_path             text         not null,
  file_name                varchar(255) not null,
  mime_type                varchar(100),
  file_size                integer,
  document_number_encrypted text,
  issue_date               date,
  expiry_date              date,
  status                   varchar(20)  not null default 'ACTIVE',
  uploaded_by              uuid references public.employees on delete set null,
  verified_by              uuid references public.employees on delete set null,
  verified_at              timestamptz,
  created_at               timestamptz  not null default now(),
  updated_at               timestamptz  not null default now()
);

-- Back-fill leave_requests.attachment_document_id FK
alter table public.leave_requests add constraint fk_leave_attachment
  foreign key (attachment_document_id) references public.employee_documents on delete set null;

create table public.asset_documents (
  id            uuid primary key default gen_random_uuid(),
  asset_id      uuid not null references public.assets on delete cascade,
  document_type varchar(50)  not null,
  storage_path  text         not null,
  file_name     varchar(255) not null,
  mime_type     varchar(100),
  uploaded_by   uuid references public.employees on delete set null,
  created_at    timestamptz  not null default now()
);

create table public.document_access_logs (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null,
  accessed_by  uuid references public.employees on delete set null,
  access_type  varchar(20) not null default 'VIEW',
  ip_address   inet,
  user_agent   text,
  accessed_at  timestamptz not null default now()
);
