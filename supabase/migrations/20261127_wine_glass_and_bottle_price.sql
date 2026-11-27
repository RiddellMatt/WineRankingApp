-- Optional glass and bottle prices. The original price column stays as the
-- primary number (bottle, otherwise glass) for older clients.

alter table public.wines
  add column if not exists glass_price numeric(10, 2),
  add column if not exists bottle_price numeric(10, 2);

alter table public.wines
  drop constraint if exists wines_glass_price_nonnegative;

alter table public.wines
  drop constraint if exists wines_bottle_price_nonnegative;

alter table public.wines
  add constraint wines_glass_price_nonnegative
    check (glass_price is null or glass_price >= 0);

alter table public.wines
  add constraint wines_bottle_price_nonnegative
    check (bottle_price is null or bottle_price >= 0);

comment on column public.wines.glass_price is
  'Optional price paid for a glass.';

comment on column public.wines.bottle_price is
  'Optional price paid for a bottle. Legacy single prices are copied here.';

update public.wines
set bottle_price = price
where bottle_price is null
  and glass_price is null
  and price is not null
  and price > 0;
