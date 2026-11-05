-- Temporary uploads for AI menu/label scans (small invoke body; image fetched in Edge Function).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ai-scan-uploads',
  'ai-scan-uploads',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy ai_scan_uploads_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ai-scan-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ai_scan_uploads_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ai-scan-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy ai_scan_uploads_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ai-scan-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
