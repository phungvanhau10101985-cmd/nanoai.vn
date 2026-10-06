-- Ai xác nhận trạng thái đi / không đi: khách tự RSVP, hay nhà trai/nhà gái ghi giúp.
alter table public.wedding_card_invited_guests
  add column if not exists status_confirmed_by text not null default '';

alter table public.wedding_card_invited_guests
  drop constraint if exists wedding_card_invited_guests_status_confirmed_by_check;

alter table public.wedding_card_invited_guests
  add constraint wedding_card_invited_guests_status_confirmed_by_check
  check (status_confirmed_by in ('', 'guest', 'host'));

comment on column public.wedding_card_invited_guests.status_confirmed_by is
  'guest = khách tự xác nhận trên thiệp (khóa sửa). host = chú rể/cô dâu bấm Xác nhận. trống = chưa chốt.';
