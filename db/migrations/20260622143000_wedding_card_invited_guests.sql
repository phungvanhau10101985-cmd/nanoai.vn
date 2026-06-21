-- Danh sách khách mời do chủ thiệp quản lý (link cá nhân, trạng thái, lời chúc).
create table if not exists public.wedding_card_invited_guests (
  id uuid default gen_random_uuid() primary key,
  wedding_card_id uuid not null references public.wedding_cards(id) on delete cascade,
  guest_name text not null,
  invite_venue text not null default '',
  personal_invite text not null default '',
  status text not null default 'pending' check (status in ('pending', 'attending', 'declined')),
  guest_count integer not null default 1 check (guest_count >= 0 and guest_count <= 20),
  wish_message text not null default '',
  notes text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_wedding_card_invited_guests_card_updated
  on public.wedding_card_invited_guests(wedding_card_id, updated_at desc);

alter table public.wedding_card_invited_guests enable row level security;

drop policy if exists "Owners manage wedding invited guests." on public.wedding_card_invited_guests;
create policy "Owners manage wedding invited guests." on public.wedding_card_invited_guests
  for all using (
    exists (
      select 1 from public.wedding_cards c
      where c.id = wedding_card_invited_guests.wedding_card_id and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.wedding_cards c
      where c.id = wedding_card_invited_guests.wedding_card_id and c.user_id = auth.uid()
    )
  );
