alter table public.wines
  add column if not exists tasting_tags text[] not null default '{}';
