-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- Decanti: profiles, wines, friendships + Row Level Security

-- ── Tables ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
  avatar_url text,
  is_pro boolean not null default false,
  stripe_customer_id text,
  stripe_subscription_id text,
  ranking_preference text check (
    ranking_preference is null
    or ranking_preference in ('taste_first', 'balanced', 'value_first')
  ),
  created_at timestamptz not null default now()
);

create table public.wines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  winery text not null default '',
  vintage integer,
  type text not null,
  varietal text not null default '',
  region text not null default '',
  price numeric,
  rating numeric not null,
  rating_enjoyment numeric,
  rating_value numeric,
  rating_buy_again numeric,
  notes text not null default '',
  purchased_at text not null default '',
  taste jsonb not null default '{}',
  taste_source text,
  status text not null default 'tried' check (status in ('tried', 'wishlist')),
  added_at bigint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create index wines_user_id_idx on public.wines (user_id);
create index friendships_requester_idx on public.friendships (requester_id);
create index friendships_addressee_idx on public.friendships (addressee_id);

-- ── Profile on sign-up ────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_name text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), '')
  );
  meta_avatar text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data->>'picture'), '')
  );
  email_name text := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
begin
  insert into public.profiles (id, display_name, email, avatar_url)
  values (
    new.id,
    coalesce(meta_name, email_name, 'Wine lover'),
    coalesce(new.email, ''),
    meta_avatar
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helpers ───────────────────────────────────────────────────────────────

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b)
        or (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

-- Look up a user by email to send a friend request (does not expose all profiles).
create or replace function public.find_profile_by_email(lookup_email text)
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

-- ── Row Level Security ────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.wines enable row level security;
alter table public.friendships enable row level security;

-- Profiles: read self, accepted friends, and pending friend-request parties
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

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_profile(auth.uid(), id));

create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_pro is not distinct from (
      select p.is_pro from public.profiles p where p.id = auth.uid()
    )
  );

-- Wines: full access to own; read-only for friends
create policy wines_select on public.wines
  for select to authenticated
  using (
    auth.uid() = user_id
    or public.are_friends(auth.uid(), user_id)
  );

create policy wines_insert on public.wines
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy wines_update on public.wines
  for update to authenticated
  using (auth.uid() = user_id);

create policy wines_delete on public.wines
  for delete to authenticated
  using (auth.uid() = user_id);

-- Friendships: visible to both parties; requester creates; addressee accepts
create policy friendships_select on public.friendships
  for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');

create policy friendships_update on public.friendships
  for update to authenticated
  using (auth.uid() = addressee_id or auth.uid() = requester_id);

create policy friendships_delete on public.friendships
  for delete to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ── Activity feed reactions ─────────────────────────────────────────────

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

-- ── Avatar storage ────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

create policy avatars_select on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy avatars_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
