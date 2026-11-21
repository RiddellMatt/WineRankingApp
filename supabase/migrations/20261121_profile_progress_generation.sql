-- Marks a full progress reset so signed-in devices drop their cached cellar,
-- badges, and journeys instead of uploading them again.
-- The wipe itself is scripts/reset-profile.sql (or npm run profile:reset).

alter table public.profiles
  add column if not exists progress_generation bigint not null default 0;

comment on column public.profiles.progress_generation is
  'Bumped by scripts/reset-profile.sql. A newer value tells the app to drop cached cellar, badges, and journeys instead of uploading them.';

-- Same shape as the is_pro guard: the signed-in user cannot bump or rewind the marker.
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_pro is not distinct from (
      select p.is_pro from public.profiles p where p.id = auth.uid()
    )
    and progress_generation is not distinct from (
      select p.progress_generation from public.profiles p where p.id = auth.uid()
    )
  );
