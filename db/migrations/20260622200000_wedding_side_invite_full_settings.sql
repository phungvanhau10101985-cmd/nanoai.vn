-- Cài đặt thiệp mời cá nhân nhà trai / nhà gái (phần mở rộng).
alter table public.wedding_cards
  add column if not exists groom_invite_wedding_date date null;

alter table public.wedding_cards
  add column if not exists groom_invite_text text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_text_en text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_event_timeline text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_dress_code text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_contact text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_cover_image_url text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_default_personal_message text not null default '';

alter table public.wedding_cards
  add column if not exists groom_invite_thank_you_text text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_wedding_date date null;

alter table public.wedding_cards
  add column if not exists bride_invite_text text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_text_en text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_event_timeline text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_dress_code text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_contact text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_cover_image_url text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_default_personal_message text not null default '';

alter table public.wedding_cards
  add column if not exists bride_invite_thank_you_text text not null default '';
