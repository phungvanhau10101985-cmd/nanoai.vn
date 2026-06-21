alter table public.wedding_cards
  add column if not exists effects_enabled boolean not null default true;

comment on column public.wedding_cards.effects_enabled is
  'Bật/tắt hiệu ứng (tự động cuộn, nhạc nền, nhạc FAB) trên thiệp công khai.';
