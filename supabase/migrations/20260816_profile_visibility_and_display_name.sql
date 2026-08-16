-- Run in Supabase Dashboard → SQL Editor (after initial schema.sql)
-- Fixes: pending friend requests show requester name; signup display names from metadata

-- Allow reading profiles for self, accepted friends, and pending friend requests.
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

-- Prefer display_name from sign-up metadata; fall back to email local-part.
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
