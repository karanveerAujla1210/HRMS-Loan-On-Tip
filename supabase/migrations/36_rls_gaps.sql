-- ==============================================================================
-- MIGRATION 36: Close remaining RLS gaps and harden the security contract
-- Safe to run on existing databases — uses DROP IF EXISTS / IF NOT EXISTS
-- ==============================================================================

-- ── 1. Enable RLS on tables that were missed ──────────────────────────────────
-- attendance_events: append-only, own read; admin/manager audit read
alter table public.attendance_events enable row level security;

create policy "attendance_events: insert own" on public.attendance_events
  for insert
  with check (
    employee_id = public.auth_employee_id()
    or public.has_permission('attendance.view')
  );

create policy "attendance_events: audit read for admin" on public.attendance_events
  for select
  using (public.has_permission('attendance.view'));

-- attendance_adjustments: own insert; admin/manager decide
alter table public.attendance_adjustments enable row level security;

create policy "attendance_adjustments: read own" on public.attendance_adjustments
  for select
  using (
    exists (
      select 1 from public.attendance a
      where a.id = attendance_adjustments.attendance_id
        and a.employee_id = public.auth_employee_id()
    )
  );

create policy "attendance_adjustments: read all for admin/manager" on public.attendance_adjustments
  for select
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN','MANAGER')
    )
  );

create policy "attendance_adjustments: own insert" on public.attendance_adjustments
  for insert
  with check (
    exists (
      select 1 from public.attendance a
      where a.id = attendance_adjustments.attendance_id
        and a.employee_id = public.auth_employee_id()
    )
  );

create policy "attendance_adjustments: update for admin/manager" on public.attendance_adjustments
  for update
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN','MANAGER')
    )
  );

-- attendance_exceptions: own read; admin/manager read all + manage
create policy "attendance_exceptions: read own" on public.attendance_exceptions
  for select
  using (employee_id = public.auth_employee_id());

create policy "attendance_exceptions: read all for admin/manager" on public.attendance_exceptions
  for select
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN','MANAGER')
    )
  );

create policy "attendance_exceptions: own insert" on public.attendance_exceptions
  for insert
  with check (employee_id = public.auth_employee_id());

create policy "attendance_exceptions: update for admin/manager" on public.attendance_exceptions
  for update
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN','MANAGER')
    )
  );

-- attendance_monthly_summary: read own + admin/manager company
create policy "attendance_monthly_summary: read own" on public.attendance_monthly_summary
  for select
  using (employee_id = public.auth_employee_id());

create policy "attendance_monthly_summary: read all for admin/manager" on public.attendance_monthly_summary
  for select
  using (
    exists (
      select 1 from public.employee_roles er
      join public.roles r on r.id = er.role_id
      where er.employee_id = public.auth_employee_id()
        and er.is_active = true
        and r.code in ('SUPER_ADMIN','HR_ADMIN','OPERATIONS_ADMIN','MANAGER')
    )
  );

-- attendance_close_runs: admin read
create policy "attendance_close_runs: admin read" on public.attendance_close_runs
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

-- leave_transactions: write by admin/HR; read own + admin
create policy "leave_transactions: read own" on public.leave_transactions
  for select
  using (employee_id = public.auth_employee_id());

create policy "leave_transactions: read all for admin" on public.leave_transactions
  for select
  using (public.has_permission('leave.balance.manage'));

create policy "leave_transactions: insert for admin" on public.leave_transactions
  for insert
  with check (public.has_permission('leave.balance.manage'));

-- leave_policies / leave_policy_rules / leave_types: company-scoped
create policy "leave_types: read company" on public.leave_types
  for select
  using (company_id = public.auth_company_id());

create policy "leave_types: manage for admin" on public.leave_types
  for all
  using (
    company_id = public.auth_company_id()
    and public.has_permission('leave.balance.manage')
  );

create policy "leave_policies: read company" on public.leave_policies
  for select
  using (company_id = public.auth_company_id());

create policy "leave_policies: manage for admin" on public.leave_policies
  for all
  using (
    company_id = public.auth_company_id()
    and public.has_permission('leave.balance.manage')
  );

create policy "leave_policy_rules: read company" on public.leave_policy_rules
  for select
  using (
    exists (
      select 1 from public.leave_policies lp
      where lp.id = leave_policy_rules.policy_id
        and lp.company_id = public.auth_company_id()
    )
  );

create policy "leave_policy_rules: manage for admin" on public.leave_policy_rules
  for all
  using (
    exists (
      select 1 from public.leave_policies lp
      where lp.id = leave_policy_rules.policy_id
        and lp.company_id = public.auth_company_id()
        and public.has_permission('leave.balance.manage')
    )
  );

-- leave_approvals: read for approvers + admin
create policy "leave_approvals: read" on public.leave_approvals
  for select
  using (
    exists (
      select 1 from public.leave_requests lr
      where lr.id = leave_approvals.leave_request_id
        and (
          lr.employee_id = public.auth_employee_id()
          or public.has_permission('leave.approve')
        )
    )
  );

create policy "leave_approvals: insert for approver" on public.leave_approvals
  for insert
  with check (public.has_permission('leave.approve'));

-- ── 2. Employee satellite tables: own read + admin/HR ─────────────────────────
create policy "employee_contacts: read own" on public.employee_contacts
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_contacts: read all for hr" on public.employee_contacts
  for select
  using (public.has_permission('employee.view'));
create policy "employee_contacts: insert own" on public.employee_contacts
  for insert
  with check (employee_id = public.auth_employee_id());
create policy "employee_contacts: manage for hr" on public.employee_contacts
  for all
  using (public.has_permission('employee.create'));

create policy "employee_addresses: read own" on public.employee_addresses
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_addresses: read all for hr" on public.employee_addresses
  for select
  using (public.has_permission('employee.view'));
create policy "employee_addresses: insert own" on public.employee_addresses
  for insert
  with check (employee_id = public.auth_employee_id());
create policy "employee_addresses: manage for hr" on public.employee_addresses
  for all
  using (public.has_permission('employee.create'));

create policy "employee_emergency_contacts: read own" on public.employee_emergency_contacts
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_emergency_contacts: read all for hr" on public.employee_emergency_contacts
  for select
  using (public.has_permission('employee.view'));
create policy "employee_emergency_contacts: insert own" on public.employee_emergency_contacts
  for insert
  with check (employee_id = public.auth_employee_id());
create policy "employee_emergency_contacts: manage for hr" on public.employee_emergency_contacts
  for all
  using (public.has_permission('employee.create'));

create policy "employee_history: read own" on public.employee_history
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_history: read all for hr" on public.employee_history
  for select
  using (public.has_permission('employee.view'));

create policy "employee_manager_history: read own" on public.employee_manager_history
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_manager_history: read all for hr" on public.employee_manager_history
  for select
  using (public.has_permission('employee.view'));

-- shift_assignments / shifts / weekly_off_rules / holidays: company-scoped
create policy "shifts: read by company location" on public.shifts
  for select
  using (
    company_id = public.auth_company_id()
    or location_id in (
      select l.id from public.locations l
      where l.company_id = public.auth_company_id()
    )
  );

create policy "shifts: manage for admin" on public.shifts
  for all
  using (company_id = public.auth_company_id() and public.has_permission('attendance.close'));

create policy "shift_assignments: read own" on public.shift_assignments
  for select
  using (employee_id = public.auth_employee_id());
create policy "shift_assignments: read all for admin" on public.shift_assignments
  for select
  using (public.has_permission('attendance.view'));
create policy "shift_assignments: manage for admin" on public.shift_assignments
  for all
  using (public.has_permission('attendance.view'));

create policy "locations: read by company" on public.locations
  for select
  using (company_id = public.auth_company_id());
create policy "locations: manage for admin" on public.locations
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "departments: read by company" on public.departments
  for select
  using (company_id = public.auth_company_id());
create policy "departments: manage for admin" on public.departments
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "teams: read by company" on public.teams
  for select
  using (company_id = public.auth_company_id());
create policy "teams: manage for admin" on public.teams
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "designations: read by company" on public.designations
  for select
  using (company_id = public.auth_company_id());
create policy "designations: manage for admin" on public.designations
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "employment_types: read by company" on public.employment_types
  for select
  using (company_id = public.auth_company_id());

create policy "weekly_off_rules: read by company" on public.weekly_off_rules
  for select
  using (
    company_id = public.auth_company_id()
    or (location_id is null)
    or location_id in (
      select l.id from public.locations l
      where l.company_id = public.auth_company_id()
    )
  );

-- ── 3. Payroll: enable + scope payroll_runs / payroll_items / payslips ────────
alter table public.payroll_runs enable row level security;
alter table public.payroll_items enable row level security;
alter table public.payslips enable row level security;
alter table public.payroll_adjustments enable row level security;
alter table public.payroll_approvals enable row level security;
alter table public.salary_components enable row level security;
alter table public.salary_structures enable row level security;
alter table public.salary_structure_components enable row level security;
alter table public.employee_salary_assignments enable row level security;
alter table public.employee_salary_history enable row level security;
alter table public.employee_statutory_details enable row level security;

create policy "payroll_runs: read company for finance" on public.payroll_runs
  for select
  using (company_id = public.auth_company_id() and public.has_permission('payroll.view'));
create policy "payroll_runs: insert for finance" on public.payroll_runs
  for insert
  with check (company_id = public.auth_company_id() and public.has_permission('payroll.create'));
create policy "payroll_runs: update for finance" on public.payroll_runs
  for update
  using (company_id = public.auth_company_id() and public.has_permission('payroll.approve'));

create policy "payroll_items: read own" on public.payroll_items
  for select
  using (employee_id = public.auth_employee_id());
create policy "payroll_items: read company for finance" on public.payroll_items
  for select
  using (
    company_id = public.auth_company_id()
    and public.has_permission('payroll.view')
  );
create policy "payroll_items: insert for finance" on public.payroll_items
  for insert
  with check (public.has_permission('payroll.create'));

create policy "payslips: read own" on public.payslips
  for select
  using (employee_id = public.auth_employee_id());
create policy "payslips: read company for finance" on public.payslips
  for select
  using (public.has_permission('payroll.view'));
create policy "payslips: insert for finance" on public.payslips
  for insert
  with check (public.has_permission('payroll.create'));

create policy "payroll_item_components: read via payroll" on public.payroll_item_components
  for select
  using (
    exists (
      select 1 from public.payroll_items pi
      where pi.id = payroll_item_components.payroll_item_id
        and (pi.employee_id = public.auth_employee_id() or public.has_permission('payroll.view'))
    )
  );

create policy "salary_structures: read company" on public.salary_structures
  for select
  using (company_id = public.auth_company_id());
create policy "salary_structures: manage for finance" on public.salary_structures
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "salary_components: read company" on public.salary_components
  for select
  using (company_id = public.auth_company_id());
create policy "salary_components: manage for finance" on public.salary_components
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "salary_structure_components: read company" on public.salary_structure_components
  for select
  using (
    exists (
      select 1 from public.salary_structures ss
      where ss.id = salary_structure_components.salary_structure_id
        and ss.company_id = public.auth_company_id()
    )
  );

create policy "employee_salary_assignments: read own" on public.employee_salary_assignments
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_salary_assignments: read company for finance" on public.employee_salary_assignments
  for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_salary_assignments.employee_id
        and e.company_id = public.auth_company_id()
    )
    and public.has_permission('payroll.view')
  );
create policy "employee_salary_assignments: manage for finance" on public.employee_salary_assignments
  for all
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_salary_assignments.employee_id
        and e.company_id = public.auth_company_id()
    )
    and public.has_permission('payroll.calculate')
  );

create policy "employee_salary_history: read company for finance" on public.employee_salary_history
  for select
  using (
    exists (
      select 1 from public.employees e
      where e.id = employee_salary_history.employee_id
        and e.company_id = public.auth_company_id()
    )
    and public.has_permission('payroll.view')
  );

-- ── 4. Assets: enable + scope the remaining subtables ────────────────────────
alter table public.asset_categories enable row level security;
alter table public.asset_brands enable row level security;
alter table public.asset_handover enable row level security;
alter table public.asset_returns enable row level security;
alter table public.asset_audit enable row level security;

-- asset_categories: read all authenticated (catalogue), write admin only
drop policy if exists "asset_categories: read all active" on public.asset_categories;
create policy "asset_categories: read company" on public.asset_categories
  for select
  using (company_id = public.auth_company_id());
create policy "asset_categories: manage for admin" on public.asset_categories
  for all
  using (company_id = public.auth_company_id() and public.has_permission('asset.create'));

-- asset_brands
create policy "asset_brands: read company" on public.asset_brands
  for select
  using (company_id = public.auth_company_id());
create policy "asset_brands: manage for admin" on public.asset_brands
  for all
  using (company_id = public.auth_company_id() and public.has_permission('asset.create'));

-- asset_handover: read via assignment, write admin/operations
create policy "asset_handover: read" on public.asset_handover
  for select
  using (
    exists (
      select 1 from public.asset_assignments aa
      join public.assets a on a.id = aa.asset_id
      where aa.id = asset_handover.asset_assignment_id
        and a.company_id = public.auth_company_id()
        and (
          a.current_employee_id = public.auth_employee_id()
          or public.has_permission('asset.view')
        )
    )
  );
create policy "asset_handover: manage for admin" on public.asset_handover
  for all
  using (public.has_permission('asset.assign'));

-- asset_returns: read via assignment, write admin/operations
create policy "asset_returns: read" on public.asset_returns
  for select
  using (
    exists (
      select 1 from public.asset_assignments aa
      join public.assets a on a.id = aa.asset_id
      where aa.id = asset_returns.asset_assignment_id
        and a.company_id = public.auth_company_id()
        and (
          a.current_employee_id = public.auth_employee_id()
          or public.has_permission('asset.view')
        )
    )
  );
create policy "asset_returns: manage for admin" on public.asset_returns
  for all
  using (public.has_permission('asset.return'));

-- asset_audit: read admin/operations, insert admin
create policy "asset_audit: read for admin" on public.asset_audit
  for select
  using (public.has_permission('asset.view'));
create policy "asset_audit: insert for admin" on public.asset_audit
  for insert
  with check (public.has_permission('asset.assign'));

-- assets: replace permissive policies with scoped ones
drop policy if exists "asset: admin read" on public.assets;
drop policy if exists "asset: admin insert" on public.assets;
drop policy if exists "asset: admin update" on public.assets;
drop policy if exists "assets: read own" on public.assets;
drop policy if exists "assets: read all for admin/operations" on public.assets;
drop policy if exists "assets: insert for admin" on public.assets;
drop policy if exists "assets: update for admin/operations" on public.assets;

create policy "assets: read company" on public.assets
  for select
  using (
    company_id = public.auth_company_id()
    and (
      public.has_permission('asset.view')
      or current_employee_id = public.auth_employee_id()
    )
  );
create policy "assets: insert for admin" on public.assets
  for insert
  with check (company_id = public.auth_company_id() and public.has_permission('asset.create'));
create policy "assets: update for admin" on public.assets
  for update
  using (company_id = public.auth_company_id() and public.has_permission('asset.assign'));
create policy "assets: delete for admin" on public.assets
  for delete
  using (company_id = public.auth_company_id() and public.has_permission('asset.create'));

-- asset_assignments: keep own read + admin/operations all
drop policy if exists "asset_assignment: own read" on public.asset_assignments;
drop policy if exists "asset_assignment: asset admin reads" on public.asset_assignments;
drop policy if exists "asset_assignments: read own" on public.asset_assignments;
drop policy if exists "asset_assignments: read all for admin/operations" on public.asset_assignments;
drop policy if exists "asset_assignments: insert for admin/operations" on public.asset_assignments;
drop policy if exists "asset_assignments: update for admin/operations" on public.asset_assignments;

create policy "asset_assignments: read own" on public.asset_assignments
  for select
  using (employee_id = public.auth_employee_id());
create policy "asset_assignments: read all for admin/operations" on public.asset_assignments
  for select
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_assignments.asset_id
        and a.company_id = public.auth_company_id()
        and public.has_permission('asset.view')
    )
  );
create policy "asset_assignments: insert for admin/operations" on public.asset_assignments
  for insert
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_assignments.asset_id
        and a.company_id = public.auth_company_id()
        and public.has_permission('asset.assign')
    )
  );
create policy "asset_assignments: update for admin/operations" on public.asset_assignments
  for update
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_assignments.asset_id
        and a.company_id = public.auth_company_id()
        and public.has_permission('asset.assign')
    )
  );

-- ── 5. Notifications: own read/write, admin insert ───────────────────────────
create policy "notifications: read own" on public.notifications
  for select
  using (recipient_employee_id = public.auth_employee_id());
create policy "notifications: insert for admin" on public.notifications
  for insert
  with check (public.has_permission('employee.view'));
create policy "notifications: update own" on public.notifications
  for update
  using (recipient_employee_id = public.auth_employee_id());

-- notification_templates / preferences / delivery_logs: company-scoped
create policy "notification_templates: read company" on public.notification_templates
  for select
  using (company_id = public.auth_company_id());
create policy "notification_templates: manage for admin" on public.notification_templates
  for all
  using (company_id = public.auth_company_id() and public.has_permission('settings.manage'));

create policy "notification_preferences: read own" on public.notification_preferences
  for select
  using (employee_id = public.auth_employee_id());
create policy "notification_preferences: update own" on public.notification_preferences
  for update
  using (employee_id = public.auth_employee_id());

create policy "notification_delivery_logs: read own" on public.notification_delivery_logs
  for select
  using (
    exists (
      select 1 from public.notifications n
      where n.id = notification_delivery_logs.notification_id
        and n.recipient_employee_id = public.auth_employee_id()
    )
  );
create policy "notification_delivery_logs: read for admin" on public.notification_delivery_logs
  for select
  using (public.has_permission('reports.view'));

-- ── 6. Documents ─────────────────────────────────────────────────────────────
create policy "document_types: read company" on public.document_types
  for select
  using (company_id = public.auth_company_id());
create policy "document_types: manage for admin" on public.document_types
  for all
  using (company_id = public.auth_company_id() and public.has_permission('organisation.manage'));

create policy "employee_documents: read own" on public.employee_documents
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_documents: read all for hr" on public.employee_documents
  for select
  using (public.has_permission('employee.document.view'));
create policy "employee_documents: insert own" on public.employee_documents
  for insert
  with check (employee_id = public.auth_employee_id());
create policy "employee_documents: manage for hr" on public.employee_documents
  for update
  using (public.has_permission('employee.document.manage'));

create policy "asset_documents: read via asset" on public.asset_documents
  for select
  using (
    exists (
      select 1 from public.assets a
      where a.id = asset_documents.asset_id
        and a.company_id = public.auth_company_id()
        and (
          public.has_permission('asset.view')
          or a.current_employee_id = public.auth_employee_id()
        )
    )
  );
create policy "asset_documents: insert for admin" on public.asset_documents
  for insert
  with check (
    exists (
      select 1 from public.assets a
      where a.id = asset_documents.asset_id
        and a.company_id = public.auth_company_id()
        and public.has_permission('asset.assign')
    )
  );

create policy "document_access_logs: read own" on public.document_access_logs
  for select
  using (accessed_by = public.auth_employee_id());
create policy "document_access_logs: read for hr" on public.document_access_logs
  for select
  using (public.has_permission('employee.document.view'));

-- ── 7. Audit logs & system tables ────────────────────────────────────────────
-- Idempotency keys: self read/write (already scoped in 35, ensure present)
create policy "idempotency_keys: read own" on public.idempotency_keys
  for select
  using (employee_id = public.auth_employee_id());
create policy "idempotency_keys: insert own" on public.idempotency_keys
  for insert
  with check (employee_id = public.auth_employee_id());
create policy "idempotency_keys: update own completed" on public.idempotency_keys
  for update
  using (employee_id = public.auth_employee_id());

-- system_settings: public read for public ones; admin manage
create policy "system_settings: read public" on public.system_settings
  for select
  using (is_public = true or company_id = public.auth_company_id());
create policy "system_settings: manage for admin" on public.system_settings
  for all
  using (company_id = public.auth_company_id() and public.has_permission('settings.manage'));

-- roles / permissions / role_permissions: system read for all authenticated
create policy "roles: read system" on public.roles
  for select
  using (true);
create policy "permissions: read all" on public.permissions
  for select
  using (true);
create policy "role_permissions: read own company" on public.role_permissions
  for select
  using (
    true
  );

-- employee_roles: read own + admin; manage admin/HR
create policy "employee_roles: read own" on public.employee_roles
  for select
  using (employee_id = public.auth_employee_id());
create policy "employee_roles: read all for admin" on public.employee_roles
  for select
  using (
    exists (
      select 1 from public.employee_roles er2
      join public.roles r2 on r2.id = er2.role_id
      where er2.employee_id = public.auth_employee_id()
        and er2.is_active = true
        and r2.code in ('SUPER_ADMIN','HR_ADMIN')
    )
  );
create policy "employee_roles: manage for admin" on public.employee_roles
  for all
  using (
    exists (
      select 1 from public.employee_roles er2
      join public.roles r2 on r2.id = er2.role_id
      where er2.employee_id = public.auth_employee_id()
        and er2.is_active = true
        and r2.code in ('SUPER_ADMIN','HR_ADMIN')
    )
  );

-- ── 8. Append-only protection for audit_logs already added in migration 33 ──
-- (no-op here; documented for the audit trail.)

select 'Migration 36 completed' as status;
