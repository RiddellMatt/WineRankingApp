-- Scores move from half stars out of 5 to quarter steps out of 10.
-- Existing rows stay on the legacy scale until the updated app saves them.
-- The app doubles a row while rating_scale is 5, then writes 10.

alter table public.wines
  add column if not exists rating_scale smallint not null default 5;

comment on column public.wines.rating_scale is
  '5 = legacy half-star scores out of 5. 10 = quarter-step scores out of 10.';
