-- Reactions on friend milestone events (badge unlock, journey complete)

create table public.activity_milestone_reactions (
  id uuid primary key default gen_random_uuid(),
  reactor_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  milestone_event_id uuid not null references public.activity_events (id) on delete cascade,
  reaction_type text not null check (reaction_type in ('cheers', 'fire', 'nice')),
  created_at timestamptz not null default now(),
  unique (reactor_id, milestone_event_id),
  check (reactor_id <> target_user_id)
);

create index activity_milestone_reactions_event_idx
  on public.activity_milestone_reactions (milestone_event_id);

alter table public.activity_milestone_reactions enable row level security;

create policy activity_milestone_reactions_select on public.activity_milestone_reactions
  for select to authenticated
  using (
    public.are_friends(auth.uid(), target_user_id)
    or reactor_id = auth.uid()
  );

create policy activity_milestone_reactions_insert on public.activity_milestone_reactions
  for insert to authenticated
  with check (
    reactor_id = auth.uid()
    and reactor_id <> target_user_id
    and public.are_friends(reactor_id, target_user_id)
    and exists (
      select 1
      from public.activity_events ev
      where ev.id = milestone_event_id
        and ev.user_id = target_user_id
        and ev.event_type in ('badge_unlock', 'journey_complete')
    )
  );

create policy activity_milestone_reactions_update on public.activity_milestone_reactions
  for update to authenticated
  using (reactor_id = auth.uid())
  with check (reactor_id = auth.uid());

create policy activity_milestone_reactions_delete on public.activity_milestone_reactions
  for delete to authenticated
  using (reactor_id = auth.uid());
