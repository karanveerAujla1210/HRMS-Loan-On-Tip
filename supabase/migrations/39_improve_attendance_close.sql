-- ==============================================================================
-- MIGRATION 37: Improve run_daily_attendance_close
--
-- Replaces the engine created in 35 with a version that skips weekly-off days and
-- company/location holidays before marking an employee ABSENT, instead of only
-- considering approved leave. Weekly-off rules are read from weekly_off_rules
-- (company-wide or location-scoped) and holidays from the holidays table. This
-- stops employees being marked ABSENT on their rostered days off.
-- ==============================================================================

create or replace function public.run_daily_attendance_close(
  p_company_id uuid,
  p_business_date date
) returns uuid language plpgsql security definer as $$
declare
  v_run_id uuid;
  v_emp record;
  v_existing record;
  v_on_leave boolean;
  v_is_off boolean;
  v_is_holiday boolean;
  v_absents integer := 0;
  v_exceptions integer := 0;
  v_seen integer := 0;
begin
  insert into public.attendance_close_runs (company_id, business_date, employees_seen)
  values (p_company_id, p_business_date, 0)
  on conflict (company_id, business_date) do update
    set ran_at = now(), employees_seen = 0, absents_marked = 0, exceptions_raised = 0
  returning id into v_run_id;

  for v_emp in
    select e.id as employee_id, e.location_id, coalesce(s.start_time, '09:30') as start_time
    from public.employees e
    left join public.shift_assignments es on es.employee_id = e.id and es.is_current = true
    left join public.shifts s on s.id = es.shift_id
    where e.company_id = p_company_id
      and e.employment_status in ('ACTIVE','ON_NOTICE','SUSPENDED','NOTICE_PERIOD')
  loop
    v_seen := v_seen + 1;

    -- Weekly-off rule (company-wide or for this employee's location).
    select exists (
      select 1 from public.weekly_off_rules w
      where w.company_id = p_company_id
        and (w.location_id is null or w.location_id = v_emp.location_id)
        and w.is_off
        and w.day_of_week = extract(dow from p_business_date)
        and p_business_date between w.effective_from and coalesce(w.effective_to, p_business_date)
    ) into v_is_off;

    -- Company / location holiday.
    select exists (
      select 1 from public.holidays h
      where h.company_id = p_company_id
        and h.holiday_date = p_business_date
        and (h.location_id is null or h.location_id = v_emp.location_id)
    ) into v_is_holiday;

    if v_is_off or v_is_holiday then
      continue; -- never mark absent on a rostered day off or holiday
    end if;

    select * into v_existing
    from public.attendance
    where employee_id = v_emp.employee_id and attendance_date = p_business_date;

    -- On approved leave for the whole day: leave any existing ON_LEAVE row alone.
    select exists (
      select 1 from public.leave_requests lr
      where lr.employee_id = v_emp.employee_id
        and lr.status = 'APPROVED'
        and p_business_date between lr.from_date and lr.to_date
    ) into v_on_leave;

    if v_existing is null and not v_on_leave then
      insert into public.attendance (
        employee_id, company_id, location_id, attendance_date, status, source
      ) values (
        v_emp.employee_id, p_company_id, v_emp.location_id, p_business_date, 'ABSENT', 'SYSTEM'
      );
      v_absents := v_absents + 1;
      continue;
    end if;

    if v_existing is not null and v_existing.check_in_at is not null and v_existing.check_out_at is null then
      if v_existing.source <> 'MANUAL' then
        update public.attendance
        set status = 'HALF_DAY', updated_at = now()
        where id = v_existing.id;
      end if;

      if not exists (
        select 1 from public.attendance_exceptions
        where attendance_id = v_existing.id and exception_type = 'MISSING_PUNCH' and status = 'OPEN'
      ) then
        insert into public.attendance_exceptions (
          attendance_id, employee_id, exception_type, description, severity, status
        ) values (
          v_existing.id, v_emp.employee_id, 'MISSING_PUNCH',
          'Checked in but no check-out recorded by the daily close window.', 'MEDIUM', 'OPEN'
        );
        v_exceptions := v_exceptions + 1;
      end if;
    end if;
  end loop;

  update public.attendance_close_runs
  set employees_seen = v_seen, absents_marked = v_absents, exceptions_raised = v_exceptions
  where id = v_run_id;

  return v_run_id;
end;
$$;

select 'Migration 37 completed' as status;
