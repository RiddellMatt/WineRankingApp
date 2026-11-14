-- AI scan observability: latency, model, outcomes (no image storage).

create table if not exists public.ai_scan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_type text not null check (scan_type in ('label', 'menu')),
  status text not null check (status in ('success', 'no_data', 'error')),
  model text,
  fallback_attempts int not null default 0,
  duration_ms_total int,
  duration_ms_preflight int,
  duration_ms_image int,
  duration_ms_gemini int,
  image_bytes int,
  fields_extracted int,
  wines_count int,
  error_code text,
  created_at timestamptz not null default now()
);

create index if not exists ai_scan_events_user_created_idx
  on public.ai_scan_events (user_id, created_at desc);

create index if not exists ai_scan_events_type_created_idx
  on public.ai_scan_events (scan_type, created_at desc);

alter table public.ai_scan_events enable row level security;

create policy ai_scan_events_select_own on public.ai_scan_events
  for select to authenticated
  using (user_id = auth.uid());

-- Edge Functions insert with service role only.

create table if not exists public.ai_scan_corrections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  scan_type text not null check (scan_type in ('label', 'menu')),
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists ai_scan_corrections_user_created_idx
  on public.ai_scan_corrections (user_id, created_at desc);

alter table public.ai_scan_corrections enable row level security;

create policy ai_scan_corrections_select_own on public.ai_scan_corrections
  for select to authenticated
  using (user_id = auth.uid());