-- Cô dâu / chú rể nhận email tổng số người đi và không đi.
alter table public.wedding_cards
  add column if not exists rsvp_notify_groom_email text not null default '',
  add column if not exists rsvp_notify_bride_email text not null default '',
  add column if not exists rsvp_notify_daily boolean not null default false,
  add column if not exists rsvp_notify_on_increase boolean not null default false,
  add column if not exists rsvp_notify_last_people integer not null default 0,
  add column if not exists rsvp_notify_baseline_set boolean not null default false,
  add column if not exists rsvp_notify_last_daily_on date;

comment on column public.wedding_cards.rsvp_notify_daily is
  'Gửi một thư tổng kết mỗi ngày (giờ VN) khi có email nhận.';
comment on column public.wedding_cards.rsvp_notify_on_increase is
  'Gửi thư ngay khi số người xác nhận đi tăng so với lần đã ghi.';
comment on column public.wedding_cards.rsvp_notify_last_people is
  'Mốc số người đi đã dùng để phát hiện lần tăng tiếp theo.';
