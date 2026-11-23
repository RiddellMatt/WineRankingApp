-- Later tastings of a bottle already in the cellar. The first date stays in tried_on.
alter table public.wines
  add column if not exists pours jsonb not null default '[]'::jsonb;
