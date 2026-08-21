-- ================================================================
-- Super Admin: admin@loanontip.com / Admin@123
-- Run this entire script in:
--   Supabase Dashboard → SQL Editor → New query → Run
-- ================================================================

-- 1. Create auth user (email confirmed, no verification email sent)
do $$
declare
  v_user_id uuid;
begin
  -- Skip if already exists
  if exists (select 1 from auth.users where email = 'admin@loanontip.com') then
    raise notice 'Auth user already exists, skipping creation.';
    return;
  end if;

  insert into auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
  ) values (
    gen_random_uuid(),
    '00000000-0000-0000-0000-000000000000',
    'admin@loanontip.com',
    crypt('Admin@123', gen_salt('bf')),
    now(),
    '{"full_name": "Super Admin", "role": "SUPER_ADMIN"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now()
  );

  raise notice 'Auth user created: admin@loanontip.com';
end $$;

-- 2. Create employee record
insert into public.employees (
  company_id,
  first_name,
  last_name,
  official_email,
  joining_date,
  employment_status
)
select
  '00000000-0000-0000-0000-000000000001',
  'Super',
  'Admin',
  'admin@loanontip.com',
  current_date,
  'ACTIVE'
where not exists (
  select 1 from public.employees where official_email = 'admin@loanontip.com'
);

-- 3. Create profile linking auth user → company → employee
insert into public.profiles (auth_user_id, company_id, email, employee_id, is_active)
select
  u.id,
  '00000000-0000-0000-0000-000000000001',
  u.email,
  e.id,
  true
from auth.users u
cross join public.employees e
where u.email = 'admin@loanontip.com'
  and e.official_email = 'admin@loanontip.com'
on conflict (auth_user_id) do update
  set employee_id = excluded.employee_id,
      company_id  = excluded.company_id,
      is_active   = true;

-- 4. Assign SUPER_ADMIN role
insert into public.employee_roles (employee_id, role_id, company_id, effective_from, is_active)
select
  e.id,
  r.id,
  '00000000-0000-0000-0000-000000000001',
  current_date,
  true
from public.employees e
cross join public.roles r
where e.official_email = 'admin@loanontip.com'
  and r.code = 'SUPER_ADMIN'
on conflict do nothing;

-- 5. Verify — should return 1 row
select
  u.email,
  u.email_confirmed_at is not null as email_confirmed,
  e.display_name,
  e.employment_status,
  r.code as role,
  p.is_active
from auth.users u
join public.profiles p on p.auth_user_id = u.id
join public.employees e on e.id = p.employee_id
join public.employee_roles er on er.employee_id = e.id and er.is_active = true
join public.roles r on r.id = er.role_id
where u.email = 'admin@loanontip.com';
