-- 15_rls_policies.sql
-- Enable RLS and define policies.
-- Privileged writes always go through Next.js API with service-role key.

-- ── Enable RLS ────────────────────────────────────────────────────────────────
alter table public.profiles                  enable row level security;
alter table public.employees                 enable row level security;
alter table public.employee_contacts         enable row level security;
alter table public.employee_addresses        enable row level security;
alter table public.employee_emergency_contacts enable row level security;
alter table public.employee_bank_accounts    enable row level security;
alter table public.employee_statutory_details enable row level security;
alter table public.attendance                enable row level security;
alter table public.attendance_events         enable row level security;
alter table public.attendance_exceptions     enable row level security;
alter table public.attendance_adjustments    enable row level security;
alter table public.leave_requests            enable row level security;
alter table public.leave_approvals           enable row level security;
alter table public.leave_balances            enable row level security;
alter table public.leave_transactions        enable row level security;
alter table public.payroll_items             enable row level security;
alter table public.payslips                  enable row level security;
alter table public.asset_assignments         enable row level security;
alter table public.employee_documents        enable row level security;
alter table public.notifications             enable row level security;
alter table public.audit_logs                enable row level security;

-- ── profiles ─────────────────────────────────────────────────────────────────
create policy "profile: own read"
  on public.profiles for select
  using (auth_user_id = auth.uid());

-- ── employees ────────────────────────────────────────────────────────────────
create policy "employee: own read"
  on public.employees for select
  using (id = public.auth_employee_id());

create policy "employee: manager reads direct reports"
  on public.employees for select
  using (id in (select public.auth_direct_report_ids()));

create policy "employee: hr reads company"
  on public.employees for select
  using (
    company_id = public.auth_company_id()
    and public.has_permission('employee.view')
  );

-- ── attendance ───────────────────────────────────────────────────────────────
create policy "attendance: own read"
  on public.attendance for select
  using (employee_id = public.auth_employee_id());

create policy "attendance: manager reads direct reports"
  on public.attendance for select
  using (employee_id in (select public.auth_direct_report_ids()));

create policy "attendance: hr reads company"
  on public.attendance for select
  using (
    company_id = public.auth_company_id()
    and public.has_permission('attendance.view')
  );

-- ── leave_requests ───────────────────────────────────────────────────────────
create policy "leave: own read"
  on public.leave_requests for select
  using (employee_id = public.auth_employee_id());

create policy "leave: own insert"
  on public.leave_requests for insert
  with check (employee_id = public.auth_employee_id());

create policy "leave: manager reads direct reports"
  on public.leave_requests for select
  using (employee_id in (select public.auth_direct_report_ids()));

create policy "leave: hr reads company"
  on public.leave_requests for select
  using (public.has_permission('leave.view'));

-- ── leave_balances ───────────────────────────────────────────────────────────
create policy "leave_balance: own read"
  on public.leave_balances for select
  using (employee_id = public.auth_employee_id());

-- ── payslips ─────────────────────────────────────────────────────────────────
create policy "payslip: own read"
  on public.payslips for select
  using (employee_id = public.auth_employee_id());

create policy "payslip: finance reads company"
  on public.payslips for select
  using (public.has_permission('payroll.view'));

-- ── payroll_items ────────────────────────────────────────────────────────────
create policy "payroll_item: finance reads"
  on public.payroll_items for select
  using (public.has_permission('payroll.view'));

-- ── asset_assignments ────────────────────────────────────────────────────────
create policy "asset_assignment: own read"
  on public.asset_assignments for select
  using (employee_id = public.auth_employee_id());

create policy "asset_assignment: asset admin reads"
  on public.asset_assignments for select
  using (public.has_permission('asset.view'));

-- ── employee_documents ───────────────────────────────────────────────────────
create policy "document: own read"
  on public.employee_documents for select
  using (employee_id = public.auth_employee_id());

create policy "document: hr reads company"
  on public.employee_documents for select
  using (public.has_permission('employee.view'));

-- ── notifications ────────────────────────────────────────────────────────────
create policy "notification: own read"
  on public.notifications for select
  using (recipient_employee_id = public.auth_employee_id());

-- ── audit_logs ───────────────────────────────────────────────────────────────
create policy "audit: super admin reads"
  on public.audit_logs for select
  using (public.has_permission('audit.view'));
