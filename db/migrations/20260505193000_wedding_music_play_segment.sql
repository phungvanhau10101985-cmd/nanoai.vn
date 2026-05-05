alter table public.wedding_cards
  add column if not exists music_play_start_sec double precision,
  add column if not exists music_play_end_sec double precision;

comment on column public.wedding_cards.music_play_start_sec is 'Thời điểm bắt đầu phát (giây); null = từ đầu file.';
comment on column public.wedding_cards.music_play_end_sec is 'Thời điểm dừng phát / lặp lại (giây); null = đến hết file.';