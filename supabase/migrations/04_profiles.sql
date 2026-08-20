-- 04_profiles.sql
-- Bridges auth.users → profiles → employees.
-- One profile per auth user; one employee record per profile.

create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  auth_user_id    uuid unique references auth.users on delete cascade,
  employee_id     uuid,                           -- FK added after employees table
  company_id      uuid references public.companies on delete cascade,
  email           varchar(255),
  phone           varchar(20),
  avatar_url      text,
  last_login_at   timestamptz,
  is_active       boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
