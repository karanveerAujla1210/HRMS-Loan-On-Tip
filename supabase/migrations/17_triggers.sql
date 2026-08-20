-- 17_triggers.sql

-- ── Generic updated_at trigger ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies','locations','departments','teams','designations',
    'shifts','shift_assignments','holidays',
    'profiles','employees','employee_contacts','employee_addresses',
    'employee_emergency_contacts','employee_bank_accounts','employee_statutory_details',
    'attendance','attendance_exceptions','attendance_adjustments',
    'leave_types','leave_policies','leave_policy_rules','leave_balances',
    'leave_requests',
    'salary_components','salary_structures','salary_structure_components',
    'employee_salary_assignments','payroll_runs','payroll_items',
    'asset_categories','assets','asset_assignments',
    'document_types','employee_documents',
    'notification_templates','notification_preferences',
    'system_settings'
  ]
  loop
    execute format(
      'create trigger trg_%s_updated_at before update on public.%s
       for each row execute function public.set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ── Attendance: auto-populate worked_minutes on check-out ─────────────────────
create or replace function public.trg_attendance_calc()
returns trigger language plpgsql as $$
begin
  if new.check_in_at is not null and new.check_out_at is not null then
    new.worked_minutes := greatest(0,
      extract(epoch from (new.check_out_at - new.check_in_at))::integer / 60
      - new.break_minutes
    );
  end if;
  return new;
end;
$$;

create trigger trg_attendance_calc
  before insert or update on public.attendance
  for each row execute function public.trg_attendance_calc();

-- ── Employee: write history row on key field changes ─────────────────────────
create or replace function public.trg_employee_history()
returns trigger language plpgsql security definer as $$
declare
  v_fields text[] := array['designation_id','department_id','location_id','manager_id','employment_status'];
  v_field  text;
begin
  foreach v_field in array v_fields loop
    if row_to_json(old)->>v_field is distinct from row_to_json(new)->>v_field then
      insert into public.employee_history
        (employee_id, change_type, old_value, new_value, effective_date)
      values
        (new.id,
         upper(v_field),
         jsonb_build_object(v_field, row_to_json(old)->>v_field),
         jsonb_build_object(v_field, row_to_json(new)->>v_field),
         current_date);
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_employee_history
  after update on public.employees
  for each row execute function public.trg_employee_history();

-- ── Idempotency: purge expired keys daily (called by scheduled job) ───────────
create or replace function public.purge_expired_idempotency_keys()
returns void language sql security definer as $$
  delete from public.idempotency_keys where expires_at < now();
$$;
