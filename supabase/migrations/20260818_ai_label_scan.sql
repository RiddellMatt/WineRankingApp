-- AI label scan: usage tracking (Pro gating uses profiles.is_pro from menu scan migration)

create table if not exists public.label_scan_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists label_scan_usage_user_created_idx
  on public.label_scan_usage (user_id, created_at desc);

alter table public.label_scan_usage enable row level security;

create policy label_scan_usage_select on public.label_scan_usage
  for select to authenticated
  using (auth.uid() = user_id);

-- Inserts happen from Edge Functions via service role only.
