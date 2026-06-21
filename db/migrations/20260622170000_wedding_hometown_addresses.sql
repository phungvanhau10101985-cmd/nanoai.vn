-- Địa chỉ quê chú rể / cô dâu trên thiệp mời.
alter table public.wedding_cards
  add column if not exists groom_hometown text not null default '';

alter table public.wedding_cards
  add column if not exists bride_hometown text not null default '';
