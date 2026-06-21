-- Email người gửi (chủ thiệp) và email từng khách mời.
alter table public.wedding_cards
  add column if not exists invite_sender_email text not null default '';

alter table public.wedding_card_invited_guests
  add column if not exists guest_email text not null default '';
