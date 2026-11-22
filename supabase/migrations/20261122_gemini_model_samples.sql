-- Recent Gemini vision attempts. The scan functions read this to decide which
-- model is most likely to finish, and how quickly, before sending a photo.
-- No client access: the rows are written by Edge Functions with the service role.

create table if not exists public.gemini_model_samples (
  id bigint generated always as identity primary key,
  model text not null,
  outcome text not null check (outcome in ('success', 'overload', 'timeout', 'error', 'unavailable')),
  duration_ms int not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists gemini_model_samples_created_idx
  on public.gemini_model_samples (created_at desc);

alter table public.gemini_model_samples enable row level security;

revoke all on table public.gemini_model_samples from anon, authenticated;
