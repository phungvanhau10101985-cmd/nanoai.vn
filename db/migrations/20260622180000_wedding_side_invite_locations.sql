-- Địa chỉ và Google Maps riêng cho thiệp mời nhà trai / nhà gái.
alter table public.wedding_cards
  add column if not exists groom_invite_address text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_map_url text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_address text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_map_url text not null default '';
