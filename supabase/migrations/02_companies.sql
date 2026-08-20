-- 02_companies.sql

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
  address_line2       text,
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
