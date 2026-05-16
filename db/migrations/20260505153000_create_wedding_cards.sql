-- AI wedding invitations: cards, generated images, RSVP and wishes.
create table if not exists public.wedding_cards (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null unique,
  groom_name text not null default '',
  bride_name text not null default '',
  wedding_date date null,
  wedding_time text not null default '',
  venue text not null default '',
  map_url text not null default '',
  invitation_text text not null default '',
  groom_parents text not null default '',
  bride_parents text not null default '',
  selected_style_id text not null default 'luxury',
  color_palette text not null default '',
  master_image_id uuid null,
  rsvp_enabled boolean not null default true,
  gift_qr_enabled boolean not null default false,
  gift_qr_image_url text not null default '',
  is_published boolean not null default false,
  published_at timestamp with time zone null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.wedding_card_ai_images (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  wedding_card_id uuid not null references public.wedding_cards(id) on delete cascade,
  type text not null check (type in ('master', 'cover', 'invitation', 'event', 'rsvp', 'album', 'gift_qr', 'thanks')),
  prompt text not null,
  reference_image_id uuid null references public.wedding_card_ai_images(id) on delete set null,
  image_url text not null default '',
  credit_cost numeric not null default 1,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  error_message text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_namespace n on n.oid = c.connamespace
    where n.nspname = 'public'
      and c.conname = 'wedding_cards_master_image_fk'
  ) then
    alter table public.wedding_cards
      add constraint wedding_cards_master_image_fk
      foreign key (master_image_id) references public.wedding_card_ai_images(id) on delete set null;
  end if;
end $$;

create table if not exists public.wedding_card_rsvps (
  id uuid default gen_random_uuid() primary key,
  wedding_card_id uuid not null references public.wedding_cards(id) on delete cascade,
  guest_name text not null,
  attending boolean not null,
  guest_count integer not null default 1 check (guest_count >= 0 and guest_count <= 20),
  message text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.wedding_card_wishes (
  id uuid default gen_random_uuid() primary key,
  wedding_card_id uuid not null references public.wedding_cards(id) on delete cascade,
  guest_name text not null,
  message text not null,
  is_approved boolean not null default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_wedding_cards_user_updated on public.wedding_cards(user_id, updated_at desc);
create index if not exists idx_wedding_card_ai_images_card_created on public.wedding_card_ai_images(wedding_card_id, created_at desc);
create index if not exists idx_wedding_card_rsvps_card_created on public.wedding_card_rsvps(wedding_card_id, created_at desc);
create index if not exists idx_wedding_card_wishes_card_created on public.wedding_card_wishes(wedding_card_id, created_at desc);

alter table public.wedding_cards enable row level security;
alter table public.wedding_card_ai_images enable row level security;
alter table public.wedding_card_rsvps enable row level security;
alter table public.wedding_card_wishes enable row level security;

drop policy if exists "Users manage own wedding cards." on public.wedding_cards;
create policy "Users manage own wedding cards." on public.wedding_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Published wedding cards are public." on public.wedding_cards;
create policy "Published wedding cards are public." on public.wedding_cards
  for select using (is_published = true or auth.uid() = user_id);

drop policy if exists "Users manage own wedding card images." on public.wedding_card_ai_images;
create policy "Users manage own wedding card images." on public.wedding_card_ai_images
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Published wedding card images are public." on public.wedding_card_ai_images;
create policy "Published wedding card images are public." on public.wedding_card_ai_images
  for select using (
    exists (
      select 1 from public.wedding_cards c
      where c.id = wedding_card_ai_images.wedding_card_id
        and (c.is_published = true or c.user_id = auth.uid())
    )
  );

drop policy if exists "Owners view wedding RSVPs." on public.wedding_card_rsvps;
create policy "Owners view wedding RSVPs." on public.wedding_card_rsvps
  for select using (
    exists (select 1 from public.wedding_cards c where c.id = wedding_card_rsvps.wedding_card_id and c.user_id = auth.uid())
  );

drop policy if exists "Guests create RSVP on published cards." on public.wedding_card_rsvps;
create policy "Guests create RSVP on published cards." on public.wedding_card_rsvps
  for insert with check (
    exists (select 1 from public.wedding_cards c where c.id = wedding_card_rsvps.wedding_card_id and c.is_published = true)
  );

drop policy if exists "Approved wishes visible on published cards." on public.wedding_card_wishes;
create policy "Approved wishes visible on published cards." on public.wedding_card_wishes
  for select using (
    is_approved = true and exists (
      select 1 from public.wedding_cards c where c.id = wedding_card_wishes.wedding_card_id and c.is_published = true
    )
  );

drop policy if exists "Owners view all wedding wishes." on public.wedding_card_wishes;
create policy "Owners view all wedding wishes." on public.wedding_card_wishes
  for select using (
    exists (select 1 from public.wedding_cards c where c.id = wedding_card_wishes.wedding_card_id and c.user_id = auth.uid())
  );

drop policy if exists "Guests create wishes on published cards." on public.wedding_card_wishes;
create policy "Guests create wishes on published cards." on public.wedding_card_wishes
  for insert with check (
    exists (select 1 from public.wedding_cards c where c.id = wedding_card_wishes.wedding_card_id and c.is_published = true)
  );
