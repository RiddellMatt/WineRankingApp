-- AI menu scan: server-side Pro flag + usage tracking
-- Run in Supabase Dashboard → SQL Editor

alter table public.profiles
  add column if not exists is_pro boolean not null default false;

-- Prevent users from granting themselves Pro via direct profile update.
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

-- Users can read their own scan history (for quota display).
create policy menu_scan_usage_select on public.menu_scan_usage
  for select to authenticated
  using (auth.uid() = user_id);

-- Inserts happen from Edge Functions via service role only.
