-- Guest email reminders before wedding day (days_before + guest_email).
create table if not exists public.wedding_card_reminders (
  id uuid default gen_random_uuid() primary key,
  wedding_card_id uuid not null references public.wedding_cards(id) on delete cascade,
  guest_email text not null,
  guest_name text not null default '',
  invite_venue text not null default '' check (invite_venue in ('', 'groom_home', 'bride_home')),
  days_before integer not null check (days_before >= 1 and days_before <= 90),
  locale text not null default 'vi',
  sent_at timestamp with time zone null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_wedding_card_reminders_card_created
  on public.wedding_card_reminders(wedding_card_id, created_at desc);

create index if not exists idx_wedding_card_reminders_pending
  on public.wedding_card_reminders(wedding_card_id, days_before)
  where sent_at is null;

create unique index if not exists idx_wedding_card_reminders_unique_pending
  on public.wedding_card_reminders (wedding_card_id, guest_email, days_before)
  where sent_at is null;

alter table public.wedding_card_reminders enable row level security;

drop policy if exists "Owners view wedding reminders." on public.wedding_card_reminders;
create policy "Owners view wedding reminders." on public.wedding_card_reminders
  for select using (
    exists (
      select 1 from public.wedding_cards c
      where c.id = wedding_card_reminders.wedding_card_id and c.user_id = auth.uid()
    )
  );

drop policy if exists "Guests create reminders on published cards." on public.wedding_card_reminders;
create policy "Guests create reminders on published cards." on public.wedding_card_reminders
  for insert with check (
    exists (
      select 1 from public.wedding_cards c
      where c.id = wedding_card_reminders.wedding_card_id and c.is_published = true
    )
  );
