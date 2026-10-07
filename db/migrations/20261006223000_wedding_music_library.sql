-- Kho nhạc nền thiệp cưới dùng chung. Bài khách tải lên vào đây để mọi người chọn.
create table if not exists public.wedding_music_library (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  audio_url text not null,
  source text not null default 'upload' check (source in ('seed', 'upload')),
  credit text not null default '',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists wedding_music_library_audio_url_key
  on public.wedding_music_library (audio_url);

create index if not exists idx_wedding_music_library_created
  on public.wedding_music_library (created_at desc);

insert into public.wedding_music_library (title, audio_url, source, credit)
values
  ('Ấm áp', '/wedding-music/heartwarming.mp3', 'seed', 'Kevin MacLeod (incompetech.com) — CC BY 4.0'),
  ('Nhẹ nhàng', '/wedding-music/a-little-faith.mp3', 'seed', 'Kevin MacLeod (incompetech.com) — CC BY 4.0'),
  ('Hoa nước', '/wedding-music/water-lily.mp3', 'seed', 'Kevin MacLeod (incompetech.com) — CC BY 4.0'),
  ('Valse', '/wedding-music/frost-waltz.mp3', 'seed', 'Kevin MacLeod (incompetech.com) — CC BY 4.0')
on conflict (audio_url) do nothing;

insert into public.wedding_music_library (title, audio_url, source, created_at)
select distinct on (music_url)
  coalesce(
    nullif(left(regexp_replace(regexp_replace(music_url, '^.*/', ''), '\.[^.]+$', ''), 80), ''),
    'Nhạc thiệp'
  ),
  music_url,
  'upload',
  timezone('utc'::text, now())
from public.wedding_cards
where music_url <> ''
  and music_url not like '/wedding-music/%'
order by music_url
on conflict (audio_url) do nothing;

alter table public.wedding_music_library enable row level security;

drop policy if exists "Wedding music library is readable." on public.wedding_music_library;
create policy "Wedding music library is readable."
  on public.wedding_music_library
  for select
  using (true);
