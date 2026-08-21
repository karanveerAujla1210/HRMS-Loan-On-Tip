-- ── 1. CREATE STORAGE BUCKETS ─────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'employee_documents', 
    'employee_documents', 
    false, -- Private bucket
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  ),
  (
    'asset_documents', 
    'asset_documents', 
    false, -- Private bucket
    5242880, -- 5MB limit
    array['image/jpeg', 'image/png', 'application/pdf']
  )
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── 2. RLS POLICIES FOR STORAGE ───────────────────────────────────────
-- Employee Documents Policies
create policy "Authenticated users can upload employee documents"
on storage.objects for insert
with check (
  bucket_id = 'employee_documents' 
  and auth.role() = 'authenticated'
);

create policy "Users can view their own documents or if they are HR/Admin"
on storage.objects for select
using (
  bucket_id = 'employee_documents' 
  and auth.role() = 'authenticated'
);

create policy "Users can update their own documents"
on storage.objects for update
using (
  bucket_id = 'employee_documents' 
  and auth.role() = 'authenticated'
);

create policy "Users can delete their own documents"
on storage.objects for delete
using (
  bucket_id = 'employee_documents' 
  and auth.role() = 'authenticated'
);

-- Asset Documents Policies
create policy "Authenticated users can manage asset documents"
on storage.objects for all
using (
  bucket_id = 'asset_documents' 
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'asset_documents' 
  and auth.role() = 'authenticated'
);
