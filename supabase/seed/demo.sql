-- Demo seed data for stakeholder review. Run after 001_hrms.sql.
-- Passwords are managed by Supabase Auth; these rows only seed profile metadata.

insert into public.locations (id, name, code, latitude, longitude) values
  ('11111111-0000-0000-0000-000000000001', 'Delhi HQ',   'DEL', 28.6139, 77.2090),
  ('11111111-0000-0000-0000-000000000002', 'Mumbai',     'MUM', 19.0760, 72.8777),
  ('11111111-0000-0000-0000-000000000003', 'Noida',      'NOI', 28.5355, 77.3910),
  ('11111111-0000-0000-0000-000000000004', 'Gurugram',   'GGN', 28.4595, 77.0266)
on conflict do nothing;
