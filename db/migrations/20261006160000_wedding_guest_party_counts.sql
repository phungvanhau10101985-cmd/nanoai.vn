-- Số người lớn / trẻ đi cùng trên RSVP thiệp. Bố mẹ tính 1 người ở số người lớn.
-- guest_count = người lớn + trẻ (tối đa 40).

alter table public.wedding_card_invited_guests
  add column if not exists adult_count integer not null default 0;

alter table public.wedding_card_invited_guests
  add column if not exists child_count integer not null default 0;

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'wedding_card_invited_guests'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%guest_count%'
      and pg_get_constraintdef(con.oid) not ilike '%adult_count%'
      and pg_get_constraintdef(con.oid) not ilike '%child_count%'
  loop
    execute format('alter table public.wedding_card_invited_guests drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.wedding_card_invited_guests
  drop constraint if exists wedding_card_invited_guests_guest_count_check;

alter table public.wedding_card_invited_guests
  add constraint wedding_card_invited_guests_guest_count_check
  check (guest_count >= 0 and guest_count <= 40);

alter table public.wedding_card_invited_guests
  drop constraint if exists wedding_card_invited_guests_adult_count_check;

alter table public.wedding_card_invited_guests
  add constraint wedding_card_invited_guests_adult_count_check
  check (adult_count >= 0 and adult_count <= 20);

alter table public.wedding_card_invited_guests
  drop constraint if exists wedding_card_invited_guests_child_count_check;

alter table public.wedding_card_invited_guests
  add constraint wedding_card_invited_guests_child_count_check
  check (child_count >= 0 and child_count <= 20);

alter table public.wedding_card_rsvps
  add column if not exists adult_count integer not null default 0;

alter table public.wedding_card_rsvps
  add column if not exists child_count integer not null default 0;

do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'wedding_card_rsvps'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%guest_count%'
      and pg_get_constraintdef(con.oid) not ilike '%adult_count%'
      and pg_get_constraintdef(con.oid) not ilike '%child_count%'
  loop
    execute format('alter table public.wedding_card_rsvps drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.wedding_card_rsvps
  drop constraint if exists wedding_card_rsvps_guest_count_check;

alter table public.wedding_card_rsvps
  add constraint wedding_card_rsvps_guest_count_check
  check (guest_count >= 0 and guest_count <= 40);

alter table public.wedding_card_rsvps
  drop constraint if exists wedding_card_rsvps_adult_count_check;

alter table public.wedding_card_rsvps
  add constraint wedding_card_rsvps_adult_count_check
  check (adult_count >= 0 and adult_count <= 20);

alter table public.wedding_card_rsvps
  drop constraint if exists wedding_card_rsvps_child_count_check;

alter table public.wedding_card_rsvps
  add constraint wedding_card_rsvps_child_count_check
  check (child_count >= 0 and child_count <= 20);

comment on column public.wedding_card_invited_guests.adult_count is
  'Số người lớn đi cùng. Bố mẹ tính là 1.';
comment on column public.wedding_card_invited_guests.child_count is
  'Số trẻ con đi cùng.';
