alter table public.wedding_cards
  add column if not exists guest_invite_venue text not null default ''
    check (guest_invite_venue in ('', 'groom_home', 'bride_home'));

comment on column public.wedding_cards.guest_invite_venue is
  'Địa điểm mời khách trên thiệp: groom_home (nhà trai) | bride_home (nhà gái) | rỗng.';
