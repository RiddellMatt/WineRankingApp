-- Feed reactions on friend activity events (logged / saved_to_try)

create table public.activity_reactions (
  id uuid primary key default gen_random_uuid(),
  reactor_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  target_wine_id uuid not null references public.wines (id) on delete cascade,
  event_type text not null check (event_type in ('logged', 'saved_to_try')),
  reaction_type text not null check (reaction_type in ('cheers', 'fire', 'nice')),
  created_at timestamptz not null default now(),
  unique (reactor_id, target_user_id, target_wine_id, event_type),
  check (reactor_id <> target_user_id)
);

create index activity_reactions_target_idx
  on public.activity_reactions (target_user_id, target_wine_id, event_type);

alter table public.activity_reactions enable row level security;

create policy activity_reactions_select on public.activity_reactions
  for select to authenticated
  using (
    public.are_friends(auth.uid(), target_user_id)
    or reactor_id = auth.uid()
  );

create policy activity_reactions_insert on public.activity_reactions
  for insert to authenticated
  with check (
    reactor_id = auth.uid()
    and reactor_id <> target_user_id
    and public.are_friends(reactor_id, target_user_id)
    and exists (
      select 1
      from public.wines w
      where w.id = target_wine_id
        and w.user_id = target_user_id
    )
  );

create policy activity_reactions_update on public.activity_reactions
  for update to authenticated
  using (reactor_id = auth.uid())
  with check (reactor_id = auth.uid());

create policy activity_reactions_delete on public.activity_reactions
  for delete to authenticated
  using (reactor_id = auth.uid());
