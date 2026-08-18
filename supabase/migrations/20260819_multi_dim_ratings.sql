-- Multi-dimensional wine ratings + profile ranking preference

alter table public.wines
  add column if not exists rating_enjoyment numeric,
  add column if not exists rating_value numeric,
  add column if not exists rating_buy_again numeric;

update public.wines
set rating_enjoyment = coalesce(rating_enjoyment, rating)
where rating_enjoyment is null;

alter table public.profiles
  add column if not exists ranking_preference text
  check (
    ranking_preference is null
    or ranking_preference in ('taste_first', 'balanced', 'value_first')
  );
