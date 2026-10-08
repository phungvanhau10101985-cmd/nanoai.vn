-- Kho khung AI dùng chung. Tạo mới trừ credit; khách sau chọn khung đã có thì không.
create table if not exists public.wedding_cover_frame_library (
  id uuid default gen_random_uuid() primary key,
  image_url text not null,
  hole jsonb not null,
  panel text not null default '#fffaf2',
  ink text not null default 'dark' check (ink in ('dark', 'light')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index if not exists wedding_cover_frame_library_image_url_key
  on public.wedding_cover_frame_library (image_url);

create index if not exists idx_wedding_cover_frame_library_created
  on public.wedding_cover_frame_library (created_at desc);

insert into public.wedding_cover_frame_library (image_url, hole, panel, ink)
select distinct on (section_config->>'coverAiFrameUrl')
  section_config->>'coverAiFrameUrl',
  section_config->'coverAiFrameHole',
  case
    when coalesce(section_config->>'coverAiFramePanel', '') ~ '^#[0-9A-Fa-f]{6}$'
      then section_config->>'coverAiFramePanel'
    else '#fffaf2'
  end,
  case when section_config->>'coverAiFrameInk' = 'light' then 'light' else 'dark' end
from public.wedding_cards
where coalesce(section_config->>'coverAiFrameUrl', '') <> ''
  and (section_config#>>'{coverAiFrameHole,w}') ~ '^[0-9]+(\.[0-9]+)?$'
  and (section_config#>>'{coverAiFrameHole,h}') ~ '^[0-9]+(\.[0-9]+)?$'
  and (section_config#>>'{coverAiFrameHole,w}')::numeric >= 18
  and (section_config#>>'{coverAiFrameHole,h}')::numeric >= 18
order by section_config->>'coverAiFrameUrl'
on conflict (image_url) do nothing;

alter table public.wedding_cover_frame_library enable row level security;

drop policy if exists "Wedding cover frame library is readable." on public.wedding_cover_frame_library;
create policy "Wedding cover frame library is readable."
  on public.wedding_cover_frame_library
  for select
  using (true);
