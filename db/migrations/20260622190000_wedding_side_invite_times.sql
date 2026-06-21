-- Giờ đón khách và giờ khai tiệc riêng cho thiệp mời nhà trai / nhà gái.
alter table public.wedding_cards
  add column if not exists groom_invite_reception_time text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_party_start_time text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_reception_time text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_party_start_time text not null default '';
