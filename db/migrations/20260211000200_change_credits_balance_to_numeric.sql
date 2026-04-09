-- Allow decimal credit balances (e.g., 1.2, 0.8) for flexible pricing.
alter table public.credits
alter column balance type numeric(10,1)
using balance::numeric(10,1);

alter table public.credits
alter column balance set default 0;
