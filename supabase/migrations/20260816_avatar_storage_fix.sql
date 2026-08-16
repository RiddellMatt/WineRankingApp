-- FIX: Run this entire script in Supabase Dashboard → SQL Editor → Run
-- Resolves "column profiles.avatar_url does not exist" and "bucket not found"

-- 1) Column (required first)
alter table public.profiles
  add column if not exists avatar_url text;

-- 2) Storage bucket (minimal insert — works on all Supabase versions)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- 3) Storage policies
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

-- 4) Email lookup RPC — must DROP first when return type changes
drop function if exists public.find_profile_by_email(text);

create function public.find_profile_by_email(lookup_email text)
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

-- 5) Verify (should return one row with public = true)
-- select id, public from storage.buckets where id = 'avatars';
-- select column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar_url';
