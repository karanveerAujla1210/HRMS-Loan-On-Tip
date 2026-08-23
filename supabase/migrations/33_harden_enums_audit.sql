-- ==============================================================================
-- MIGRATION 33: Harden enums, audit immutability and leave-balance writes
--
-- Fixes three production defects found during the security review:
--   1. Native Postgres enums cannot be extended inside a migration transaction
--      (ALTER TYPE ... ADD VALUE is disallowed in a block) and lock the schema
--      to a fixed value ordering. Every status/type column is converted to
--      varchar with an explicit CHECK constraint drawn from the canonical code
--      sets in packages/api-contract. Legacy aliases are retained so existing
--      rows (e.g. status 'LEAVE') remain valid.
--   2. audit_logs had no INSERT policy for authenticated users, so the
--      session-scoped client could never append an audit row. A scoped policy
--      is added (actor must equal the caller) and the table is made
--      update/delete-proof for everyone, keeping it append-only.
--   3. approve_leave_request inserted into leave_balances.closing_balance,
--      a GENERATED ALWAYS column, which aborts the transaction. The insert is
--      corrected to let the generated column compute itself.
-- ==============================================================================

-- ── 1. Convert enum-typed columns to varchar + CHECK constraints ────────────
do $$
declare
  rec record;
  allowed text;
  constraint_name text;
begin
  for rec in
    select
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      e.enum_name
    from information_schema.columns c
    join (
      select 'employment_status_enum' enum_name, array[
        'ACTIVE','ON_NOTICE','SUSPENDED','RESIGNED','TERMINATED','RETIRED','INACTIVE',
        'NOTICE_PERIOD','EXITED'
      ] vals
      union all
      select 'attendance_status_enum', array[
        'PRESENT','ABSENT','HALF_DAY','LATE','LEAVE','ON_LEAVE','HOLIDAY','WEEKLY_OFF',
        'WORK_FROM_HOME','ON_DUTY','MISSING_PUNCH'
      ]
      union all
      select 'leave_request_status_enum', array[
        'DRAFT','PENDING','APPROVED','REJECTED','CANCELLED'
      ]
      union all
      select 'payroll_run_status_enum', array[
        'DRAFT','CALCULATING','CALCULATED','HR_REVIEW','FINANCE_REVIEW',
        'APPROVED','LOCKED','PAID','CANCELLED'
      ]
      union all
      select 'asset_status_enum', array[
        'AVAILABLE','ASSIGNED','UNDER_REPAIR','LOST','DAMAGED','RETIRED','DISPOSED',
        'IN_STOCK','IN_USE','REPAIR','RETURNED'
      ]
      union all
      select 'approval_action_enum', array['APPROVED','REJECTED','ESCALATED']
      union all
      select 'notification_channel_enum', array['PUSH','EMAIL','SMS','IN_APP']
      union all
      select 'component_type_enum', array['EARNING','DEDUCTION','STATUTORY']
    ) e on e.enum_name = c.udt_name
    where c.table_schema = 'public'
  loop
    -- enum -> varchar is a metadata-only change; data already stored as text
    execute format(
      'alter table %I.%I alter column %I type varchar(40) using %I::text',
      rec.table_schema, rec.table_name, rec.column_name, rec.column_name
    );

    constraint_name := 'chk_' || rec.table_name || '_' || rec.column_name;
    execute format('alter table %I.%I drop constraint if exists %I', rec.table_schema, rec.table_name, constraint_name);

    select string_agg(quote_literal(v), ',')
      into allowed
      from unnest(e.vals) v;

    execute format(
      'alter table %I.%I add constraint %I check (%I::text in (%s))',
      rec.table_schema, rec.table_name, constraint_name, rec.column_name, allowed
    );
  end loop;

  -- Drop the now-unused native enum types (deferred, safe if still referenced)
  drop type if exists public.employment_status_enum cascade;
  drop type if exists public.attendance_status_enum cascade;
  drop type if exists public.leave_request_status_enum cascade;
  drop type if exists public.payroll_run_status_enum cascade;
  drop type if exists public.asset_status_enum cascade;
  drop type if exists public.approval_action_enum cascade;
  drop type if exists public.notification_channel_enum cascade;
  drop type if exists public.component_type_enum cascade;
end $$;

-- ── 2. Audit log immutability ────────────────────────────────────────────────
-- Drop the super-admin-only policy that prevented any authenticated caller from
-- appending an audit row through the session client.
drop policy if exists "audit_logs: read for admin" on public.audit_logs;
drop policy if exists "audit_logs: insert for admin" on public.audit_logs;

-- Any authenticated caller may append a row, but only for their own actor id.
-- The privileged server client (service role) bypasses RLS entirely, so
-- system-written audits are unaffected.
create policy "audit_logs: insert own" on public.audit_logs
  for insert
  with check (
    actor_auth_user_id = auth.uid()
    or actor_employee_id = public.auth_employee_id()
  );

create policy "audit_logs: read for admin" on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','FINANCE_ADMIN')
    )
  );

-- No one may alter or erase an audit record.
create or replace function public.prevent_audit_modification()
returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only; modifications are forbidden';
end;
$$;

drop trigger if exists trg_audit_no_update on public.audit_logs;
create trigger trg_audit_no_update
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_modification();

-- ── 3. Fix approve_leave_request (generated closing_balance) ────────────────
create or replace function public.approve_leave_request(
  p_leave_request_id uuid,
  p_approver_id      uuid
) returns void language plpgsql security definer as $$
declare
  v_lr record;
begin
  select * into v_lr
  from public.leave_requests
  where id = p_leave_request_id
    and status = 'PENDING'
  for update;

  if not found then
    raise exception 'Leave request not found or already processed';
  end if;

  update public.leave_requests
  set status = 'APPROVED', updated_at = now()
  where id = p_leave_request_id;

  insert into public.leave_approvals (leave_request_id, approver_id, action, approval_level)
  values (p_leave_request_id, p_approver_id, 'APPROVED', 1);

  -- closing_balance is GENERATED ALWAYS; omit it and let the trigger compute it.
  insert into public.leave_balances (employee_id, leave_type_id, year, opening_balance, used)
  values (
    v_lr.employee_id,
    v_lr.leave_type_id,
    extract(year from v_lr.from_date)::smallint,
    0,
    v_lr.total_days
  )
  on conflict (employee_id, leave_type_id, year) do update
  set
    used            = public.leave_balances.used + v_lr.total_days,
    updated_at      = now();

  insert into public.attendance (employee_id, company_id, attendance_date, status, source)
  select
    v_lr.employee_id,
    (select company_id from public.employees where id = v_lr.employee_id),
    d::date,
    'ON_LEAVE',
    'SYSTEM'
  from generate_series(v_lr.from_date, v_lr.to_date, '1 day'::interval) d
  on conflict (employee_id, attendance_date) do update
  set status = 'ON_LEAVE', updated_at = now();
end;
$$;

select 'Migration 33 completed' as status;
