-- Xưng hô khách mời (Chú, Cô, Anh, …) — tách riêng khỏi tên để sinh lời mời cá nhân.
alter table public.wedding_card_invited_guests
  add column if not exists guest_honorific text not null default '';

comment on column public.wedding_card_invited_guests.guest_honorific is
  'Xưng hô khách (Chú, Cô, Anh, …) — ghép với guest_name để sinh lời mời cá nhân.';
