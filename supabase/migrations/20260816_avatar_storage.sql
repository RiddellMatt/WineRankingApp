-- Run in Supabase Dashboard → SQL Editor (after prior migrations)
-- Profile photos: avatar_url column + public avatars storage bucket

alter table public.profiles
  add column if not exists avatar_url text;

-- Public bucket so friends can load avatars via URL (paths are user-id scoped).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Anyone can view avatars (public bucket URLs).
drop policy if exists avatars_select on storage.objects;
create policy avatars_select on storage.objects
  for select
  using (bucket_id = 'avatars');

drop policy if exists avatars_insert on storage.objects;
create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_update on storage.objects;
create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Include avatar in email lookup RPC.
create or replace function public.find_profile_by_email(lookup_email text)
returns table (id uuid, display_name text, email text, avatar_url text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email, p.avatar_url
  from public.profiles p
  where lower(p.email) = lower(trim(lookup_email))
    and p.id <> auth.uid()
  limit 1;
$$;

grant execute on function public.find_profile_by_email(text) to authenticated;
