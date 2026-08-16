-- ═══════════════════════════════════════════════════════════════════════════
-- Cellar Rank — database upgrades (copy/paste into Supabase SQL Editor)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- HOW TO RUN:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Copy ALL of this file's contents and paste into the editor
--   3. Click Run
--
-- NOTE: Supabase cannot "load" files from your computer or GitHub.
--       You must paste the SQL text manually (or use Supabase CLI linked to
--       a local clone of this repo on branch cursor/supabase-auth-friends-29b9).
--
-- If you have NOT run any setup yet, run supabase/schema.sql first, then this.
-- Safe to run more than once (uses IF NOT EXISTS / OR REPLACE).
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1) Friend request names + signup display names ───────────────────────

create or replace function public.can_view_profile(viewer uuid, profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer = profile_id
    or public.are_friends(viewer, profile_id)
    or exists (
      select 1
      from public.friendships f
      where f.status = 'pending'
        and (
          (f.requester_id = viewer and f.addressee_id = profile_id)
          or (f.requester_id = profile_id and f.addressee_id = viewer)
        )
    );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_profile(auth.uid(), id));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := nullif(trim(new.raw_user_meta_data->>'display_name'), '');
  email_name text := nullif(split_part(new.email, '@', 1), '');
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(meta_name, email_name, 'Wine lover'),
    coalesce(new.email, '')
  );
  return new;
end;
$$;


-- ── 2) Profile photos (avatar_url + storage bucket) ──────────────────────

alter table public.profiles
  add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

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


-- ── 3) AI menu scan (Pro flag + usage tracking) ──────────────────────────

alter table public.profiles
  add column if not exists is_pro boolean not null default false;

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_pro is not distinct from (
      select p.is_pro from public.profiles p where p.id = auth.uid()
    )
  );

create table if not exists public.menu_scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists menu_scan_usage_user_created_idx
  on public.menu_scan_usage (user_id, created_at desc);

alter table public.menu_scan_usage enable row level security;

drop policy if exists menu_scan_usage_select on public.menu_scan_usage;
create policy menu_scan_usage_select on public.menu_scan_usage
  for select to authenticated
  using (auth.uid() = user_id);


-- ── 4) Stripe subscription tracking ──────────────────────────────────────

alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text;

create index if not exists profiles_stripe_customer_id_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_stripe_subscription_id_idx
  on public.profiles (stripe_subscription_id)
  where stripe_subscription_id is not null;
