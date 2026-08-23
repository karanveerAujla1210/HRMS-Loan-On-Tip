-- ==============================================================================
-- MIGRATION 35: Attendance daily-close engine
--
-- Provides the idempotent, server-triggered job that the /api/v1/cron/attendance
-- endpoint invokes each morning. Server time is authoritative: it operates on a
-- business date supplied by the caller (the gateway computes the company's local
-- "yesterday") and never trusts a client-supplied clock.
--
-- Behaviour per employee scheduled on the target date:
--   * No attendance row at all and not on approved leave -> insert ABSENT.
--   * A row with check-in but no check-out past the close window -> flag a
--     MISSING_PUNCH exception and mark HALF_DAY (do not silently PRESENT).
--   * Recompute the row status only for SYSTEM-generated rows; manual
--     adjustments are respected.
-- ==============================================================================

create table if not exists public.attendance_close_runs (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies on delete cascade,
  business_date date not null,
  ran_at        timestamptz not null default now(),
  employees_seen integer not null default 0,
  absents_marked integer not null default 0,
  exceptions_raised integer not null default 0,
  created_by    uuid references public.employees on delete set null,
  unique (company_id, business_date)
);

create or replace function public.run_daily_attendance_close(
  p_company_id uuid,
  p_business_date date
) returns uuid language plpgsql security definer as $$
declare
  v_run_id uuid;
  v_emp record;
  v_existing record;
  v_on_leave boolean;
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

    if not found and v_existing is null and not v_on_leave then
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

-- Row Level Security for the close-run ledger: only admins may read it.
alter table public.attendance_close_runs enable row level security;
drop policy if exists "attendance_close_runs: admin" on public.attendance_close_runs;
create policy "attendance_close_runs: admin" on public.attendance_close_runs
  for select
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN')
    )
  );

select 'Migration 35 completed' as status;
