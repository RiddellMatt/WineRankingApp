-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- Cellar Rank: profiles, wines, friendships + Row Level Security

-- ── Tables ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  email text not null default '',
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
  notes text not null default '',
  purchased_at text not null default '',
  taste jsonb not null default '{}',
  taste_source text,
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
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Wine lover'),
    coalesce(new.email, '')
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
returns table (id uuid, display_name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.display_name, p.email
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

-- Profiles: read self + accepted friends; update own
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    auth.uid() = id
    or public.are_friends(auth.uid(), id)
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id);

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
