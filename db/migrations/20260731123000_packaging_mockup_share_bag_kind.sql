-- Bag mockup 3D share — same table, distinguish box vs bag viewer payload

alter table public.packaging_mockup_shares
  add column if not exists mockup_kind text not null default 'box';

alter table public.packaging_mockup_shares
  drop constraint if exists packaging_mockup_shares_mockup_kind_check;

alter table public.packaging_mockup_shares
  add constraint packaging_mockup_shares_mockup_kind_check
  check (mockup_kind in ('box', 'bag'));
