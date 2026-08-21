-- ================================================================
-- Fix Super Admin Login (500 error)
-- Run in Supabase Dashboard → SQL Editor
-- ================================================================

-- Step 1: Delete broken user if exists (no identities row)
delete from auth.users where email = 'admin@loanontip.com';

-- Step 2: Re-create with proper identities row
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_now timestamptz := now();
begin
  -- Insert auth user
  insert into auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, created_at, updated_at,
    last_sign_in_at, confirmation_token, recovery_token,
    email_change_token_new, email_change
  ) values (
    v_uid,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin@loanontip.com',
    crypt('Admin@123', gen_salt('bf')),
    v_now,
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Super Admin","role":"SUPER_ADMIN"}'::jsonb,
    false,
    v_now, v_now, v_now,
    '', '', '', ''
  );

  -- Insert identity row (required for email login to work)
  insert into auth.identities (
    id, user_id, provider_id, provider,
    identity_data, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_uid,
    'admin@loanontip.com',
    'email',
    json_build_object(
      'sub', v_uid::text,
      'email', 'admin@loanontip.com',
      'email_verified', true
    )::jsonb,
    v_now, v_now, v_now
  );

  raise notice 'Auth user created with identity: %', v_uid;
end $$;

-- Step 3: Update profile to link new auth user
update public.profiles p
set auth_user_id = u.id
from auth.users u
where u.email = 'admin@loanontip.com'
  and p.email = 'admin@loanontip.com';

-- If no profile exists yet, create it
insert into public.profiles (auth_user_id, company_id, email, employee_id, is_active)
select u.id, '00000000-0000-0000-0000-000000000001', u.email, e.id, true
from auth.users u
cross join public.employees e
where u.email = 'admin@loanontip.com'
  and e.official_email = 'admin@loanontip.com'
on conflict (auth_user_id) do update
  set employee_id = excluded.employee_id, is_active = true;

-- Step 4: Verify — should show 1 row with confirmed = true
select
  u.email,
  u.email_confirmed_at is not null as confirmed,
  (select count(*) from auth.identities where user_id = u.id) as identity_count,
  e.display_name,
  r.code as role
from auth.users u
join public.profiles p on p.auth_user_id = u.id
join public.employees e on e.id = p.employee_id
join public.employee_roles er on er.employee_id = e.id
join public.roles r on r.id = er.role_id
where u.email = 'admin@loanontip.com';
