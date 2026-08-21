-- Fix RLS for bank accounts and statutory details (needed for CSV import)
alter table public.employee_bank_accounts enable row level security;
alter table public.employee_statutory_details enable row level security;

create policy "bank: own read" on public.employee_bank_accounts for select using (employee_id = public.auth_employee_id());
create policy "bank: hr read"  on public.employee_bank_accounts for select using (public.has_permission('employee.view'));
create policy "bank: hr insert" on public.employee_bank_accounts for insert with check (public.has_permission('employee.create'));
create policy "bank: hr update" on public.employee_bank_accounts for update using (public.has_permission('employee.update'));

create policy "statutory: own read"  on public.employee_statutory_details for select using (employee_id = public.auth_employee_id());
create policy "statutory: hr read"   on public.employee_statutory_details for select using (public.has_permission('employee.view'));
create policy "statutory: hr insert" on public.employee_statutory_details for insert with check (public.has_permission('employee.create'));
create policy "statutory: hr update" on public.employee_statutory_details for update using (public.has_permission('employee.update'));
