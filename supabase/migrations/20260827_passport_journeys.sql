-- Passport journeys, cloud badge tiers, and social milestone feed events

-- ── Earned badge tiers (permanent, never downgraded) ───────────────────────

create table public.user_badge_tiers (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null,
  tier text not null check (tier in ('locked', 'bronze', 'silver', 'gold', 'diamond')),
  updated_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index user_badge_tiers_user_idx on public.user_badge_tiers (user_id);

alter table public.user_badge_tiers enable row level security;

create policy user_badge_tiers_select on public.user_badge_tiers
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
  );

create policy user_badge_tiers_insert on public.user_badge_tiers
  for insert to authenticated
  with check (user_id = auth.uid());

create policy user_badge_tiers_update on public.user_badge_tiers
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Completed passport journeys (permanent) ───────────────────────────────

create table public.user_journey_completions (
  user_id uuid not null references auth.users (id) on delete cascade,
  journey_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, journey_id)
);

create index user_journey_completions_user_idx on public.user_journey_completions (user_id);

alter table public.user_journey_completions enable row level security;

create policy user_journey_completions_select on public.user_journey_completions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
  );

create policy user_journey_completions_insert on public.user_journey_completions
  for insert to authenticated
  with check (user_id = auth.uid());

-- ── Social milestone events (badges, journeys) ────────────────────────────

create table public.activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  event_type text not null check (event_type in ('badge_unlock', 'journey_complete')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_events_user_created_idx
  on public.activity_events (user_id, created_at desc);

create index activity_events_created_idx
  on public.activity_events (created_at desc);

alter table public.activity_events enable row level security;

create policy activity_events_select on public.activity_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.are_friends(auth.uid(), user_id)
  );

create policy activity_events_insert on public.activity_events
  for insert to authenticated
  with check (user_id = auth.uid());
