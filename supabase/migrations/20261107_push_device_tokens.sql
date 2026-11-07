-- Device tokens for iOS (APNs) and Android (FCM) push delivery.

alter table public.profiles
  add column if not exists push_notification_prefs jsonb not null default jsonb_build_object(
    'enabled', true,
    'friend_requests', true,
    'friend_accepted', true,
    'reactions', true,
    'friend_milestones', false
  );

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint push_device_tokens_token_key unique (token)
);

create index if not exists push_device_tokens_user_idx
  on public.push_device_tokens (user_id);

alter table public.push_device_tokens enable row level security;

create policy push_device_tokens_select on public.push_device_tokens
  for select to authenticated
  using (user_id = auth.uid());

-- Inserts/updates/deletes go through the register-push-token Edge Function (service role).

comment on table public.push_device_tokens is
  'Native push tokens; dispatch-notification-push sends via APNs (ios) or FCM (android).';

comment on column public.profiles.push_notification_prefs is
  'Opt-in flags for push categories; in-app bell still respects types separately.';
