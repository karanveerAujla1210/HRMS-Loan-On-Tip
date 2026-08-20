-- 14_functions.sql

-- Returns the employees.id for the currently authenticated user.
create or replace function public.auth_employee_id()
returns uuid language sql stable security definer as $$
  select employee_id from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Returns the company_id for the currently authenticated user.
create or replace function public.auth_company_id()
returns uuid language sql stable security definer as $$
  select company_id from public.profiles
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- Returns the primary role code for the current user.
create or replace function public.auth_role()
returns text language sql stable security definer as $$
  select r.code
  from public.employee_roles er
  join public.roles r on r.id = er.role_id
  where er.employee_id = public.auth_employee_id()
    and er.is_active = true
  order by r.is_system desc
  limit 1;
$$;

-- Checks whether the current user has a given permission code.
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

-- Returns direct-report employee IDs for the current user (manager view).
create or replace function public.auth_direct_report_ids()
returns setof uuid language sql stable security definer as $$
  select id from public.employees
  where manager_id = public.auth_employee_id()
    and employment_status = 'ACTIVE';
$$;

-- Inserts an audit log row; call from API layer or triggers.
create or replace function public.create_audit_log(
  p_action      text,
  p_entity_type text,
  p_entity_id   text,
  p_old_values  jsonb default null,
  p_new_values  jsonb default null,
  p_request_id  uuid  default null
) returns void language plpgsql security definer as $$
begin
  insert into public.audit_logs
    (company_id, actor_employee_id, actor_auth_user_id,
     action, entity_type, entity_id, old_values, new_values, request_id)
  values
    (public.auth_company_id(), public.auth_employee_id(), auth.uid(),
     p_action, p_entity_type, p_entity_id, p_old_values, p_new_values, p_request_id);
end;
$$;

-- Derives attendance status from worked minutes and late minutes.
create or replace function public.calculate_attendance_status(
  p_worked_minutes integer,
  p_late_minutes   integer,
  p_grace_minutes  integer default 15,
  p_half_day_mins  integer default 240,
  p_full_day_mins  integer default 360
) returns public.attendance_status_enum language plpgsql immutable as $$
begin
  if p_worked_minutes = 0 then return 'ABSENT'; end if;
  if p_worked_minutes < p_half_day_mins then return 'HALF_DAY'; end if;
  if p_late_minutes > p_grace_minutes   then return 'LATE'; end if;
  return 'PRESENT';
end;
$$;

-- Calculates leave balance closing figure (mirrors the generated column).
create or replace function public.calculate_leave_balance(p_employee_id uuid, p_leave_type_id uuid, p_year smallint)
returns numeric language sql stable as $$
  select coalesce(opening_balance,0) + coalesce(accrued,0) + coalesce(adjusted,0)
       - coalesce(used,0) - coalesce(encashed,0)
  from public.leave_balances
  where employee_id = p_employee_id
    and leave_type_id = p_leave_type_id
    and year = p_year;
$$;
