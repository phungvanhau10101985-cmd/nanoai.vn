-- Loại thiệp trên cùng bảng wedding_cards. Mặc định wedding để thiệp cũ không đổi.
alter table public.wedding_cards
  add column if not exists occasion_key text not null default 'wedding';

comment on column public.wedding_cards.occasion_key is
  'wedding | engagement | full_month | first_birthday | birthday | longevity | grand_opening | housewarming | gathering | graduation | anniversary | ceremony';
